import { requestUrl } from "obsidian";
import { GoodreadsBook, GoodreadsHighlight } from "./types";

export class GoodreadsService {
  /**
   * Cleans and extracts user ID from direct number or full Goodreads profile/shelf URL
   */
  static extractUserId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";

    const urlMatch = trimmed.match(
      /(?:goodreads\.com\/(?:user\/show|review\/list|review\/list_rss|notes)\/)([0-9]+)/i
    );
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }

    const directMatch = trimmed.match(/^([0-9]+)/);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }

    return trimmed;
  }

  /**
   * Fetches books from Goodreads RSS feed for a specific shelf
   */
  static async fetchShelf(
    userId: string,
    shelf: string = "all",
    maxItems: number = 100
  ): Promise<{ books: GoodreadsBook[]; shelfTitle: string }> {
    const cleanUserId = this.extractUserId(userId);
    if (!cleanUserId) {
      throw new Error(
        "Invalid Goodreads User ID. Please check your User ID in settings."
      );
    }

    const books: GoodreadsBook[] = [];
    let shelfTitle = `Bookshelf: ${shelf}`;
    let page = 1;
    const maxPages = Math.min(Math.ceil(maxItems / 100), 5);

    while (page <= maxPages && books.length < maxItems) {
      let url = `https://www.goodreads.com/review/list_rss/${encodeURIComponent(cleanUserId)}?page=${page}`;
      if (shelf && shelf !== "all") {
        url += `&shelf=${encodeURIComponent(shelf)}`;
      }

      let responseText = "";
      try {
        const response = await requestUrl({
          url,
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianGoodreadsBookshelf/1.0",
            Accept: "application/rss+xml, application/xml, text/xml, */*"
          }
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: Failed to fetch feed.`);
        }
        responseText = response.text;
      } catch (err: any) {
        if (page === 1) {
          throw new Error(
            `Could not fetch Goodreads bookshelf for user "${cleanUserId}". Check your User ID and make sure your profile is public. Details: ${err.message}`
          );
        }
        break;
      }

      const parsed = this.parseRssXml(responseText, shelf);
      if (parsed.shelfTitle) {
        shelfTitle = parsed.shelfTitle;
      }

      if (parsed.books.length === 0) {
        break;
      }

      for (const book of parsed.books) {
        if (!books.some((b) => b.bookId === book.bookId)) {
          books.push(book);
          if (books.length >= maxItems) break;
        }
      }

      if (parsed.books.length < 100) {
        break;
      }

      page++;
    }

    return { books, shelfTitle };
  }

  /**
   * Fetches Kindle Highlights & Notes for a specific book on Goodreads
   */
  static async fetchBookHighlights(
    userId: string,
    bookId: string,
    cookie?: string
  ): Promise<GoodreadsHighlight[]> {
    const cleanUserId = this.extractUserId(userId);
    const cleanBookId =
      String(bookId).trim().match(/^([0-9]+)/)?.[1] || String(bookId).trim();
    if (!cleanUserId || !cleanBookId) return [];

    const url = `https://www.goodreads.com/notes/${encodeURIComponent(cleanBookId)}/${encodeURIComponent(cleanUserId)}`;

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    };

    if (cookie && cookie.trim()) {
      let cleanCookie = cookie.trim();
      if (!cleanCookie.includes("=")) {
        cleanCookie = `_session_id2=${cleanCookie}`;
      }
      headers["Cookie"] = cleanCookie;
    }

    try {
      const response = await requestUrl({
        url,
        method: "GET",
        headers
      });

      if (response.status !== 200) {
        console.warn(
          `[Goodreads Bookshelf] Highlights request returned status ${response.status} for ${url}`
        );
        return [];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(response.text, "text/html");
      const noteEls = Array.from(
        doc.querySelectorAll(
          ".js-readingNote, .readingNote, [data-reading-note-id], .readingNotes__note, .noteHighlightContainer, .readingNote__container"
        )
      );

      const highlights: GoodreadsHighlight[] = [];

      for (const el of noteEls) {
        const id =
          el.getAttribute("data-reading-note-id") ||
          el.getAttribute("id") ||
          "";
        const isSpoiler = el.getAttribute("data-is-spoiler") === "true";

        const locEl =
          el.querySelector(".noteHighlightContainer__location a") ||
          el.querySelector(".noteHighlightContainer__location") ||
          el.querySelector(".readingNote__location") ||
          el.querySelector(".readingNotes__location") ||
          el.querySelector(".noteLocation") ||
          el.querySelector(".location");
        const location = locEl?.textContent?.trim() || "";

        const textEl =
          el.querySelector(".noteHighlightTextContainer__highlightText span") ||
          el.querySelector(".noteHighlightTextContainer__highlightText") ||
          el.querySelector(".readingNote__highlightText") ||
          el.querySelector(".readingNotes__highlight") ||
          el.querySelector(".highlightText") ||
          el.querySelector(".js-highlightText") ||
          el.querySelector(".highlight") ||
          el.querySelector("blockquote");
        let text = this.cleanText(textEl?.textContent || "");
        if (!text && el.getAttribute("data-highlight")) {
          text = this.cleanText(el.getAttribute("data-highlight") || "");
        }

        const userNoteEl =
          el.querySelector(".noteHighlightTextContainer__noteContainer span") ||
          el.querySelector(".noteHighlightTextContainer__noteContainer") ||
          el.querySelector(".readingNote__userNote") ||
          el.querySelector(".readingNotes__userNote") ||
          el.querySelector(".noteText") ||
          el.querySelector(".userNote") ||
          el.querySelector(".annotation") ||
          el.querySelector(".note");
        let note = this.cleanText(userNoteEl?.textContent || "");
        if (!note && el.getAttribute("data-note")) {
          note = this.cleanText(el.getAttribute("data-note") || "");
        }

        if (text || note) {
          highlights.push({
            id,
            location,
            text,
            note,
            isSpoiler
          });
        }
      }

      if (highlights.length === 0) {
        // Fallback: check if notes are embedded in react props
        const reactContainers = Array.from(
          doc.querySelectorAll("[data-react-props]")
        );
        for (const container of reactContainers) {
          const rawProps = container.getAttribute("data-react-props");
          if (
            rawProps &&
            (rawProps.includes("highlight") ||
              rawProps.includes("readingNote") ||
              rawProps.includes("notes"))
          ) {
            try {
              const parsed = JSON.parse(rawProps);
              const items =
                parsed.notes || parsed.readingNotes || parsed.highlights || [];
              if (Array.isArray(items)) {
                for (const item of items) {
                  const itemText =
                    item.text || item.highlight || item.body || "";
                  const itemNote = item.note || item.comment || "";
                  const itemLoc = item.location || item.page || "";
                  if (itemText || itemNote) {
                    highlights.push({
                      id: String(item.id || ""),
                      location: String(itemLoc),
                      text: this.cleanText(itemText),
                      note: this.cleanText(itemNote),
                      isSpoiler: !!item.isSpoiler
                    });
                  }
                }
              }
            } catch {
              // ignore json parse error
            }
          }
        }
      }

      return highlights;
    } catch (err) {
      console.warn(
        `[Goodreads Bookshelf] Failed to fetch highlights from ${url}:`,
        err
      );
      return [];
    }
  }

  /**
   * Parses XML RSS feed from Goodreads
   */
  private static parseRssXml(
    xmlText: string,
    requestedShelf: string
  ): { books: GoodreadsBook[]; shelfTitle: string } {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      throw new Error(`XML Parsing error: ${parseError.textContent}`);
    }

    const channel = xmlDoc.querySelector("channel");
    const shelfTitle = channel?.querySelector("title")?.textContent?.trim() || "";

    const items = Array.from(xmlDoc.querySelectorAll("item"));
    const books: GoodreadsBook[] = [];

    for (const item of items) {
      const getTagText = (tag: string): string => {
        const byTag = item.getElementsByTagName(tag)[0]?.textContent;
        if (byTag !== undefined && byTag !== null) return byTag.trim();
        const byQuery = item.querySelector(tag)?.textContent;
        if (byQuery !== undefined && byQuery !== null) return byQuery.trim();
        return "";
      };

      let bookId =
        getTagText("book_id") ||
        item.querySelector("book > id")?.textContent?.trim() ||
        item.querySelector("book")?.getAttribute("id") ||
        "";

      if (!bookId || !/^[0-9]+$/.test(bookId)) {
        const link = getTagText("link") || "";
        const linkMatch = link.match(/\/book\/show\/([0-9]+)/);
        if (linkMatch && linkMatch[1]) {
          bookId = linkMatch[1];
        } else {
          const guid = getTagText("guid") || "";
          const guidMatch = guid.match(/([0-9]+)$/);
          if (guidMatch && guidMatch[1]) {
            bookId = guidMatch[1];
          }
        }
      }

      const title = this.cleanText(
        getTagText("title") || "Untitled Book"
      );

      let author = this.cleanText(
        getTagText("author_name") || "Unknown Author"
      );
      author = author.replace(/\s+/g, " ");

      const isbn = getTagText("isbn") || "";

      const bookLargeImageUrl = getTagText("book_large_image_url") || "";
      const bookMediumImageUrl = getTagText("book_medium_image_url") || "";
      const bookImageUrl = getTagText("book_image_url") || "";

      let coverUrl =
        bookLargeImageUrl || bookMediumImageUrl || bookImageUrl || "";
      if (coverUrl.includes("nophoto")) {
        coverUrl = "";
      }

      let largeCoverUrl = bookLargeImageUrl || coverUrl;
      if (largeCoverUrl.includes("nophoto")) {
        largeCoverUrl = "";
      }

      // Raw description contains fallback metadata in RSS feeds
      const rawDescription =
        item.getElementsByTagName("description")[0]?.textContent ||
        item.querySelector("description")?.textContent ||
        "";

      // User rating extraction with multiple robust fallbacks:
      let rawUserRating =
        getTagText("user_rating") ||
        getTagText("rating") ||
        "";

      if (!rawUserRating || rawUserRating === "0") {
        // Fallback from description: search for standalone "rating: 5" (not "average rating: 4.38")
        const descRatingMatch = rawDescription.match(
          /(?:^|[\r\n]|<br\s*[\/]?>)\s*(?:user\s+)?rating:\s*([0-5])/i
        );
        if (descRatingMatch) {
          rawUserRating = descRatingMatch[1];
        }
      }
      const userRating = parseInt(rawUserRating, 10) || 0;

      const rawAvgRating = getTagText("average_rating") || "0";
      const averageRating = parseFloat(rawAvgRating) || 0;

      const pagesText =
        getTagText("num_pages") ||
        item.querySelector("book > num_pages")?.textContent?.trim() ||
        "";
      const pages = pagesText ? parseInt(pagesText, 10) || null : null;

      const publishedYear = getTagText("book_published") || "";

      const userReadAt = this.formatDate(getTagText("user_read_at") || "");
      const userDateAdded = this.formatDate(
        getTagText("user_date_added") || getTagText("pubDate") || ""
      );

      const rawShelves = getTagText("user_shelves") || "";
      const userShelves = rawShelves
        ? rawShelves
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

      // User review extraction with multiple robust fallbacks:
      let userReviewHtml =
        getTagText("user_review") ||
        getTagText("review") ||
        "";

      // If user_review is empty or only HTML tags, check description for review text:
      if (!userReviewHtml || userReviewHtml.replace(/<[^>]+>/g, "").trim().length === 0) {
        const descReviewMatch = rawDescription.match(
          /(?:^|[\r\n]|<br\s*[\/]?>)\s*review:\s*<br\s*[\/]?>([\s\S]*?)(?:<br\s*[\/]?>\s*<br\s*[\/]?>|\]\]>|$)/i
        );
        if (descReviewMatch && descReviewMatch[1].trim()) {
          userReviewHtml = descReviewMatch[1].trim();
        }
      }

      let userReview = this.cleanHtmlToMarkdown(userReviewHtml);
      if (userReview === "<br/>" || userReview === "<br />") {
        userReview = "";
      }

      const bookDescHtml = getTagText("book_description") || "";
      const description = this.cleanHtmlToMarkdown(bookDescHtml);

      const link = getTagText("link") || "";
      const guid = getTagText("guid") || "";

      let shelf = requestedShelf;
      if (shelf === "all") {
        if (userReadAt || userRating > 0) {
          shelf = "read";
        } else if (userShelves.includes("currently-reading")) {
          shelf = "currently-reading";
        } else if (userShelves.includes("to-read")) {
          shelf = "to-read";
        } else {
          shelf = "read";
        }
      }

      books.push({
        bookId,
        title,
        author,
        isbn,
        coverUrl,
        largeCoverUrl,
        userRating,
        averageRating,
        pages,
        publishedYear,
        userReadAt,
        userDateAdded,
        userShelves,
        userReview,
        description,
        link,
        guid,
        shelf
      });
    }

    return { books, shelfTitle };
  }

  /**
   * Clean text content and remove HTML or entity artifacts
   */
  private static cleanText(text: string): string {
    if (!text) return "";
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      .trim();
  }

  /**
   * Converts HTML content from Goodreads RSS into clean Markdown
   */
  private static cleanHtmlToMarkdown(html: string): string {
    if (!html) return "";

    let md = html
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p>/gi, "")
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_match, p1) => {
        return "\n> " + p1.trim().replace(/\n/g, "\n> ") + "\n";
      })
      .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      .replace(/<[^>]+>/g, "");

    md = this.cleanText(md);

    return md.replace(/\n{3,}/g, "\n\n").trim();
  }

  /**
   * Formats Goodreads date strings into YYYY-MM-DD
   */
  private static formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return dateStr;
    }
  }
}
