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
    if (!cleanUserId || !bookId) return [];

    const url = `https://www.goodreads.com/notes/${encodeURIComponent(bookId)}/${encodeURIComponent(cleanUserId)}`;

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianGoodreadsBookshelf/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    if (cookie && cookie.trim()) {
      const cleanCookie = cookie.trim().startsWith("_session_id2=")
        ? cookie.trim()
        : `_session_id2=${cookie.trim()}`;
      headers["Cookie"] = cleanCookie;
    }

    try {
      const response = await requestUrl({
        url,
        method: "GET",
        headers
      });

      if (response.status !== 200) {
        return [];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(response.text, "text/html");
      const noteEls = Array.from(doc.querySelectorAll(".js-readingNote"));

      const highlights: GoodreadsHighlight[] = [];

      for (const el of noteEls) {
        const id = el.getAttribute("data-reading-note-id") || "";
        const isSpoiler = el.getAttribute("data-is-spoiler") === "true";

        const locEl =
          el.querySelector(".noteHighlightContainer__location a") ||
          el.querySelector(".noteHighlightContainer__location");
        const location = locEl?.textContent?.trim() || "";

        const textEl =
          el.querySelector(".noteHighlightTextContainer__highlightText span") ||
          el.querySelector(".noteHighlightTextContainer__highlightText");
        const text = this.cleanText(textEl?.textContent || "");

        const userNoteEl =
          el.querySelector(".noteHighlightTextContainer__noteContainer") ||
          el.querySelector(".noteText");
        const note = this.cleanText(userNoteEl?.textContent || "");

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

      return highlights;
    } catch {
      // Highlights may not exist or may be private
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

      const bookId =
        getTagText("book_id") ||
        item.querySelector("book")?.getAttribute("id") ||
        getTagText("guid") ||
        "";

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
