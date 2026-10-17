"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GoodreadsBookshelfPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/types.ts
var DEFAULT_PROPERTIES = [
  { id: "prop-title", key: "title", field: "title", enabled: true },
  { id: "prop-author", key: "author", field: "author", enabled: true },
  { id: "prop-goodreads_id", key: "goodreads_id", field: "goodreads_id", enabled: true },
  { id: "prop-shelf", key: "shelf", field: "shelf", enabled: true },
  { id: "prop-field", key: "field", field: "field", enabled: true },
  { id: "prop-isbn", key: "isbn", field: "isbn", enabled: true },
  { id: "prop-rating", key: "my_rating", field: "rating", enabled: true },
  { id: "prop-average_rating", key: "average_rating", field: "average_rating", enabled: true },
  { id: "prop-pages", key: "pages", field: "pages", enabled: true },
  { id: "prop-published", key: "published", field: "published", enabled: true },
  { id: "prop-date_added", key: "date_added", field: "date_added", enabled: true },
  { id: "prop-date_read", key: "date_read", field: "date_read", enabled: true },
  { id: "prop-cover", key: "cover", field: "cover", enabled: true },
  { id: "prop-goodreads_url", key: "goodreads_url", field: "goodreads_url", enabled: true },
  { id: "prop-tags", key: "tags", field: "tags", enabled: true }
];
var DEFAULT_SETTINGS = {
  userId: "",
  folder: "Books",
  defaultShelf: "all",
  customShelves: [],
  maxItems: 100,
  openNoteAfterCreation: true,
  openLocation: "new-tab",
  noteTitleFormat: "title",
  tagPrefix: "book",
  includeCover: true,
  includeDescription: true,
  includeReview: true,
  includeReadingSections: false,
  includeHighlights: true,
  goodreadsCookie: "",
  overwriteExisting: false,
  properties: DEFAULT_PROPERTIES,
  storageMode: "single",
  includeBookDocuments: true,
  createHighlightsFile: true,
  createThoughtsFile: true,
  createVocabularyFile: true,
  vocabularyHeadingLevel: "h3",
  customThoughtsTemplate: "",
  customVocabularyTemplate: "",
  customHighlightsTemplate: "",
  highlightsTemplatePath: "",
  thoughtsTemplatePath: "",
  vocabularyTemplatePath: "",
  enableSnippetTriggers: true,
  highlightSnippetTrigger: "/highlight",
  vocabularySnippetTrigger: "/vocab"
};

// src/settings.ts
var import_obsidian4 = require("obsidian");

// src/folder-suggest.ts
var import_obsidian = require("obsidian");
var FolderSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, textInputEl) {
    super(app, textInputEl);
    this.inputEl = textInputEl;
  }
  getSuggestions(query) {
    const lowerQuery = query.toLowerCase().trim();
    const folders = [];
    const files = this.app.vault.getAllLoadedFiles();
    for (const file of files) {
      if (file instanceof import_obsidian.TFolder) {
        const displayPath = file.path === "/" ? "" : file.path;
        if (!lowerQuery || displayPath.toLowerCase().includes(lowerQuery)) {
          folders.push(file);
        }
      }
    }
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }
  renderSuggestion(folder, el) {
    const displayPath = folder.path === "/" ? "(Vault Root)" : folder.path;
    el.setText(displayPath);
  }
  selectSuggestion(folder) {
    const selectedPath = folder.path === "/" ? "" : folder.path;
    this.setValue(selectedPath);
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
};

// src/file-suggest.ts
var import_obsidian2 = require("obsidian");
var FileSuggest = class extends import_obsidian2.AbstractInputSuggest {
  constructor(app, textInputEl) {
    super(app, textInputEl);
    this.inputEl = textInputEl;
  }
  getSuggestions(query) {
    const lowerQuery = query.toLowerCase().trim();
    const markdownFiles = this.app.vault.getMarkdownFiles();
    if (!lowerQuery) {
      return markdownFiles.slice(0, 30);
    }
    return markdownFiles.filter((file) => file.path.toLowerCase().includes(lowerQuery)).slice(0, 30);
  }
  renderSuggestion(file, el) {
    el.createEl("div", { text: file.path });
  }
  selectSuggestion(file) {
    this.setValue(file.path);
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
};

// src/goodreads-service.ts
var import_obsidian3 = require("obsidian");
var GoodreadsService = class {
  /**
   * Cleans and extracts user ID from direct number or full Goodreads profile/shelf URL
   */
  static extractUserId(input) {
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
  static async fetchShelf(userId, shelf = "all", maxItems = 100) {
    const cleanUserId = this.extractUserId(userId);
    if (!cleanUserId) {
      throw new Error(
        "Invalid Goodreads User ID. Please check your User ID in settings."
      );
    }
    const books = [];
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
        const response = await (0, import_obsidian3.requestUrl)({
          url,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianGoodreadsBookshelf/1.0",
            Accept: "application/rss+xml, application/xml, text/xml, */*"
          }
        });
        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: Failed to fetch feed.`);
        }
        responseText = response.text;
      } catch (err) {
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
  static async fetchBookHighlights(userId, bookId, cookie) {
    const cleanUserId = this.extractUserId(userId);
    const cleanBookId = String(bookId).trim().match(/^([0-9]+)/)?.[1] || String(bookId).trim();
    if (!cleanUserId || !cleanBookId) return [];
    const url = `https://www.goodreads.com/notes/${encodeURIComponent(cleanBookId)}/${encodeURIComponent(cleanUserId)}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
      const response = await (0, import_obsidian3.requestUrl)({
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
      const highlights = [];
      for (const el of noteEls) {
        const id = el.getAttribute("data-reading-note-id") || el.getAttribute("id") || "";
        const isSpoiler = el.getAttribute("data-is-spoiler") === "true";
        const locEl = el.querySelector(".noteHighlightContainer__location a") || el.querySelector(".noteHighlightContainer__location") || el.querySelector(".readingNote__location") || el.querySelector(".readingNotes__location") || el.querySelector(".noteLocation") || el.querySelector(".location");
        const location = locEl?.textContent?.trim() || "";
        const textEl = el.querySelector(".noteHighlightTextContainer__highlightText span") || el.querySelector(".noteHighlightTextContainer__highlightText") || el.querySelector(".readingNote__highlightText") || el.querySelector(".readingNotes__highlight") || el.querySelector(".highlightText") || el.querySelector(".js-highlightText") || el.querySelector(".highlight") || el.querySelector("blockquote");
        let text = this.cleanText(textEl?.textContent || "");
        if (!text && el.getAttribute("data-highlight")) {
          text = this.cleanText(el.getAttribute("data-highlight") || "");
        }
        const userNoteEl = el.querySelector(".noteHighlightTextContainer__noteContainer span") || el.querySelector(".noteHighlightTextContainer__noteContainer") || el.querySelector(".readingNote__userNote") || el.querySelector(".readingNotes__userNote") || el.querySelector(".noteText") || el.querySelector(".userNote") || el.querySelector(".annotation") || el.querySelector(".note");
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
        const reactContainers = Array.from(
          doc.querySelectorAll("[data-react-props]")
        );
        for (const container of reactContainers) {
          const rawProps = container.getAttribute("data-react-props");
          if (rawProps && (rawProps.includes("highlight") || rawProps.includes("readingNote") || rawProps.includes("notes"))) {
            try {
              const parsed = JSON.parse(rawProps);
              const items = parsed.notes || parsed.readingNotes || parsed.highlights || [];
              if (Array.isArray(items)) {
                for (const item of items) {
                  const itemText = item.text || item.highlight || item.body || "";
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
  static parseRssXml(xmlText, requestedShelf) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      throw new Error(`XML Parsing error: ${parseError.textContent}`);
    }
    const channel = xmlDoc.querySelector("channel");
    const shelfTitle = channel?.querySelector("title")?.textContent?.trim() || "";
    const items = Array.from(xmlDoc.querySelectorAll("item"));
    const books = [];
    for (const item of items) {
      const getTagText = (tag) => {
        const byTag = item.getElementsByTagName(tag)[0]?.textContent;
        if (byTag !== void 0 && byTag !== null) return byTag.trim();
        const byQuery = item.querySelector(tag)?.textContent;
        if (byQuery !== void 0 && byQuery !== null) return byQuery.trim();
        return "";
      };
      let bookId = getTagText("book_id") || item.querySelector("book > id")?.textContent?.trim() || item.querySelector("book")?.getAttribute("id") || "";
      if (!bookId || !/^[0-9]+$/.test(bookId)) {
        const link2 = getTagText("link") || "";
        const linkMatch = link2.match(/\/book\/show\/([0-9]+)/);
        if (linkMatch && linkMatch[1]) {
          bookId = linkMatch[1];
        } else {
          const guid2 = getTagText("guid") || "";
          const guidMatch = guid2.match(/([0-9]+)$/);
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
      let coverUrl = bookLargeImageUrl || bookMediumImageUrl || bookImageUrl || "";
      if (coverUrl.includes("nophoto")) {
        coverUrl = "";
      }
      let largeCoverUrl = bookLargeImageUrl || coverUrl;
      if (largeCoverUrl.includes("nophoto")) {
        largeCoverUrl = "";
      }
      const rawDescription = item.getElementsByTagName("description")[0]?.textContent || item.querySelector("description")?.textContent || "";
      let rawUserRating = getTagText("user_rating") || getTagText("rating") || "";
      if (!rawUserRating || rawUserRating === "0") {
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
      const pagesText = getTagText("num_pages") || item.querySelector("book > num_pages")?.textContent?.trim() || "";
      const pages = pagesText ? parseInt(pagesText, 10) || null : null;
      const publishedYear = getTagText("book_published") || "";
      const userReadAt = this.formatDate(getTagText("user_read_at") || "");
      const userDateAdded = this.formatDate(
        getTagText("user_date_added") || getTagText("pubDate") || ""
      );
      const rawShelves = getTagText("user_shelves") || "";
      const userShelves = rawShelves ? rawShelves.split(",").map((s) => s.trim()).filter((s) => s.length > 0) : [];
      let userReviewHtml = getTagText("user_review") || getTagText("review") || "";
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
  static cleanText(text) {
    if (!text) return "";
    return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013").replace(/&hellip;/g, "\u2026").trim();
  }
  /**
   * Converts HTML content from Goodreads RSS into clean Markdown
   */
  static cleanHtmlToMarkdown(html) {
    if (!html) return "";
    let md = html.replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<p>/gi, "").replace(/<b>(.*?)<\/b>/gi, "**$1**").replace(/<strong>(.*?)<\/strong>/gi, "**$1**").replace(/<i>(.*?)<\/i>/gi, "*$1*").replace(/<em>(.*?)<\/em>/gi, "*$1*").replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_match, p1) => {
      return "\n> " + p1.trim().replace(/\n/g, "\n> ") + "\n";
    }).replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)").replace(/<[^>]+>/g, "");
    md = this.cleanText(md);
    return md.replace(/\n{3,}/g, "\n\n").trim();
  }
  /**
   * Formats Goodreads date strings into YYYY-MM-DD
   */
  static formatDate(dateStr) {
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
};

// src/settings.ts
var GoodreadsSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.activeTab = "general";
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Goodreads Bookshelf Settings" });
    const navBar = containerEl.createDiv({ cls: "gr-settings-nav-bar" });
    const tabs = [
      { id: "general", label: "General", icon: "settings" },
      { id: "properties", label: "Properties", icon: "tags" },
      { id: "content", label: "Content & Notes", icon: "file-text" },
      { id: "shelves", label: "Shelves & Sync", icon: "layers" }
    ];
    for (const tab of tabs) {
      const btn = navBar.createEl("button", {
        cls: `gr-settings-tab-btn ${this.activeTab === tab.id ? "is-active" : ""}`
      });
      const iconSpan = btn.createSpan({ cls: "gr-settings-tab-icon" });
      (0, import_obsidian4.setIcon)(iconSpan, tab.icon);
      btn.createSpan({ text: tab.label });
      btn.addEventListener("click", () => {
        this.activeTab = tab.id;
        this.display();
      });
    }
    const tabContent = containerEl.createDiv({ cls: "gr-settings-tab-content" });
    switch (this.activeTab) {
      case "general":
        this.renderGeneralTab(tabContent);
        break;
      case "properties":
        this.renderPropertiesTab(tabContent);
        break;
      case "content":
        this.renderContentTab(tabContent);
        break;
      case "shelves":
        this.renderShelvesTab(tabContent);
        break;
    }
  }
  // ================= GENERAL TAB =================
  renderGeneralTab(container) {
    container.createEl("h3", { text: "Goodreads Profile" });
    new import_obsidian4.Setting(container).setName("Goodreads User ID or Profile URL").setDesc(
      "Enter your numeric Goodreads User ID or paste your full profile URL (e.g. https://www.goodreads.com/user/show/12345678-john-doe). Your profile must be public."
    ).addText(
      (text) => text.setPlaceholder("e.g. 12345678 or profile URL").setValue(this.plugin.settings.userId).onChange(async (value) => {
        const cleanId = GoodreadsService.extractUserId(value);
        this.plugin.settings.userId = cleanId;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Verify Goodreads Connection").setDesc("Test whether your Goodreads bookshelf RSS feed is accessible.").addButton(
      (btn) => btn.setButtonText("Test Connection").setCta().onClick(async () => {
        const userId = this.plugin.settings.userId.trim();
        if (!userId) {
          new import_obsidian4.Notice("Please enter a Goodreads User ID first.");
          return;
        }
        btn.setButtonText("Testing...");
        btn.setDisabled(true);
        try {
          const res = await GoodreadsService.fetchShelf(userId, "all", 10);
          new import_obsidian4.Notice(
            `Success! Connected to "${res.shelfTitle}". Found books!`,
            5e3
          );
        } catch (err) {
          new import_obsidian4.Notice(`Connection failed: ${err.message}`, 6e3);
        } finally {
          btn.setButtonText("Test Connection");
          btn.setDisabled(false);
        }
      })
    );
    container.createEl("h3", { text: "Note Storage & Naming" });
    new import_obsidian4.Setting(container).setName("Save Folder").setDesc(
      "Vault folder where book notes will be saved. Will be created automatically if missing."
    ).addText((text) => {
      text.setPlaceholder("e.g. Books or Reading/Goodreads").setValue(this.plugin.settings.folder).onChange(async (val) => {
        this.plugin.settings.folder = val.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    new import_obsidian4.Setting(container).setName("Note Title Format").setDesc("Choose how note file names should be constructed.").addDropdown(
      (dd) => dd.addOption("title", "Book Title (e.g. Dune.md)").addOption(
        "title-author",
        "Title - Author (e.g. Dune - Frank Herbert.md)"
      ).addOption(
        "author-title",
        "Author - Title (e.g. Frank Herbert - Dune.md)"
      ).setValue(this.plugin.settings.noteTitleFormat).onChange(async (val) => {
        this.plugin.settings.noteTitleFormat = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Default Tags").setDesc(
      "Tags added to the frontmatter tags list (comma-separated, without #). Supports dynamic property variables like {{field}}, {{shelf}}, {{author}}, etc."
    ).addText(
      (text) => text.setPlaceholder("e.g. book, {{field}}").setValue(this.plugin.settings.tagPrefix).onChange(async (val) => {
        this.plugin.settings.tagPrefix = val.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Note Storage Structure").setDesc(
      "Choose whether each book is saved as a single markdown file or as an organized folder containing modular sub-notes."
    ).addDropdown(
      (dd) => dd.addOption("single", "Single File (e.g. Books/Dune.md)").addOption(
        "folder",
        "Folder per Book (e.g. Books/Dune/Dune.md + sub-notes)"
      ).setValue(this.plugin.settings.storageMode).onChange(async (val) => {
        this.plugin.settings.storageMode = val;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (this.plugin.settings.storageMode === "folder") {
      new import_obsidian4.Setting(container).setName("Generate Highlights & Notes File").setDesc(
        "Generates a dedicated Highlights & Notes.md file inside the book folder."
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.createHighlightsFile).onChange(async (val) => {
          this.plugin.settings.createHighlightsFile = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(container).setName("Generate My Thoughts File").setDesc(
        "Generates a dedicated My Thoughts.md file for personal interpretations, insights, and reviews."
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.createThoughtsFile).onChange(async (val) => {
          this.plugin.settings.createThoughtsFile = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(container).setName("Generate Vocabulary File").setDesc(
        "Generates a dedicated Vocabulary.md file formatted for vocabulary tracking and flashcards."
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.createVocabularyFile).onChange(async (val) => {
          this.plugin.settings.createVocabularyFile = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(container).setName("Include 'Book Documents' Section in Main Note").setDesc(
        "Includes links to sub-documents (Highlights, Thoughts, Vocabulary) under a '## \u{1F4C1} Book Documents' section in the main book note."
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.includeBookDocuments ?? true).onChange(async (val) => {
          this.plugin.settings.includeBookDocuments = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(container).setName("Vocabulary Heading Level").setDesc(
        "Markdown heading level used for each word entry in Vocabulary.md."
      ).addDropdown(
        (dd) => dd.addOption("h1", "H1 (#)").addOption("h2", "H2 (##)").addOption("h3", "H3 (###) \u2014 Default").addOption("h4", "H4 (####)").setValue(this.plugin.settings.vocabularyHeadingLevel || "h3").onChange(async (val) => {
          this.plugin.settings.vocabularyHeadingLevel = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(container).setName("Highlights & Notes Template File (Vault)").setDesc(
        "Choose a markdown template file from your vault for Highlights & Notes.md. Supports {{highlight}}, {{location}}, {{note}}, {{title}}, {{author}}, and {{book_link}}."
      ).addText((text) => {
        text.setPlaceholder("e.g. Templates/Highlights.md").setValue(this.plugin.settings.highlightsTemplatePath || "").onChange(async (val) => {
          this.plugin.settings.highlightsTemplatePath = val.trim();
          await this.plugin.saveSettings();
        });
        new FileSuggest(this.app, text.inputEl);
      });
      new import_obsidian4.Setting(container).setName("My Thoughts Template File (Vault)").setDesc(
        "Choose a markdown template file from your vault for My Thoughts.md. Supports {{title}}, {{author}}, and {{book_link}}."
      ).addText((text) => {
        text.setPlaceholder("e.g. Templates/Thoughts.md").setValue(this.plugin.settings.thoughtsTemplatePath || "").onChange(async (val) => {
          this.plugin.settings.thoughtsTemplatePath = val.trim();
          await this.plugin.saveSettings();
        });
        new FileSuggest(this.app, text.inputEl);
      });
      new import_obsidian4.Setting(container).setName("Vocabulary Template File (Vault)").setDesc(
        "Choose a markdown template file from your vault for Vocabulary.md. Supports {{title}}, {{author}}, {{book_link}}, and {{h}}."
      ).addText((text) => {
        text.setPlaceholder("e.g. Templates/Vocabulary.md").setValue(this.plugin.settings.vocabularyTemplatePath || "").onChange(async (val) => {
          this.plugin.settings.vocabularyTemplatePath = val.trim();
          await this.plugin.saveSettings();
        });
        new FileSuggest(this.app, text.inputEl);
      });
      new import_obsidian4.Setting(container).setName("Custom 'My Thoughts' Template (Inline Fallback)").setDesc(
        "Inline template for My Thoughts.md if no vault file is selected above. Supports {{title}}, {{author}}, and {{book_link}}."
      ).addTextArea((ta) => {
        ta.setPlaceholder("Leave empty to use built-in default template").setValue(this.plugin.settings.customThoughtsTemplate || "").onChange(async (val) => {
          this.plugin.settings.customThoughtsTemplate = val;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 4;
        ta.inputEl.cols = 40;
      });
      new import_obsidian4.Setting(container).setName("Custom 'Vocabulary' Template (Inline Fallback)").setDesc(
        "Inline template for Vocabulary.md if no vault file is selected above. Supports {{title}}, {{author}}, {{book_link}}, and {{h}}."
      ).addTextArea((ta) => {
        ta.setPlaceholder("Leave empty to use built-in default template").setValue(this.plugin.settings.customVocabularyTemplate || "").onChange(async (val) => {
          this.plugin.settings.customVocabularyTemplate = val;
          await this.plugin.saveSettings();
        });
        ta.inputEl.rows = 4;
        ta.inputEl.cols = 40;
      });
    }
    container.createEl("h3", { text: "Editor Behavior" });
    new import_obsidian4.Setting(container).setName("Open Note After Creation").setDesc("Automatically open the book note in editor after creation.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.openNoteAfterCreation).onChange(async (val) => {
        this.plugin.settings.openNoteAfterCreation = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Open Location").setDesc("Where to open newly created or selected book notes.").addDropdown(
      (dd) => dd.addOption("new-tab", "New Tab").addOption("active", "Active Tab").addOption("split", "Split Pane (Right)").setValue(this.plugin.settings.openLocation).onChange(async (val) => {
        this.plugin.settings.openLocation = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Overwrite Existing Notes").setDesc(
      "If disabled (recommended), clicking an already saved book will simply open the existing note. If enabled, it will overwrite the note with freshly synced Goodreads data."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.overwriteExisting).onChange(async (val) => {
        this.plugin.settings.overwriteExisting = val;
        await this.plugin.saveSettings();
      })
    );
    container.createEl("h3", { text: "Quick Insert & Snippet Triggers" });
    new import_obsidian4.Setting(container).setName("Enable Inline Snippet Triggers").setDesc(
      "Automatically expand trigger keywords into templates while typing in the editor (e.g. typing /highlight or /vocab)."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableSnippetTriggers).onChange(async (val) => {
        this.plugin.settings.enableSnippetTriggers = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Highlight Snippet Trigger").setDesc(
      "Keyword trigger that automatically expands into a highlight template block."
    ).addText(
      (text) => text.setPlaceholder("/highlight").setValue(this.plugin.settings.highlightSnippetTrigger).onChange(async (val) => {
        this.plugin.settings.highlightSnippetTrigger = val.trim() || "/highlight";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Vocabulary Snippet Trigger").setDesc(
      "Keyword trigger that automatically expands into a vocabulary entry block."
    ).addText(
      (text) => text.setPlaceholder("/vocab").setValue(this.plugin.settings.vocabularySnippetTrigger).onChange(async (val) => {
        this.plugin.settings.vocabularySnippetTrigger = val.trim() || "/vocab";
        await this.plugin.saveSettings();
      })
    );
  }
  // ================= PROPERTIES TAB =================
  renderPropertiesTab(container) {
    container.createEl("h3", { text: "Frontmatter Properties Manager" });
    const desc = container.createEl("p", { cls: "setting-item-description" });
    desc.setText(
      "Customize which frontmatter (YAML) properties are included in your generated book notes. You can toggle properties on/off, rename property keys, delete them, or add custom properties."
    );
    if (!this.plugin.settings.properties) {
      this.plugin.settings.properties = JSON.parse(
        JSON.stringify(DEFAULT_PROPERTIES)
      );
    }
    const propList = container.createDiv({ cls: "gr-properties-list" });
    const fieldLabels = {
      title: "Book Title",
      author: "Author Name",
      goodreads_id: "Goodreads Book ID",
      shelf: "Reading Shelf (read, currently-reading, to-read)",
      field: "Book Genre / Shelves",
      genres: "Book Genre / Shelves",
      isbn: "ISBN",
      rating: "My Rating (1-5)",
      rating_stars: "My Rating Stars (\u2605\u2605\u2605\u2605\u2605)",
      average_rating: "Goodreads Average Rating",
      pages: "Page Count",
      published: "Publication Year",
      date_added: "Date Added",
      date_read: "Date Read",
      cover: "Cover Image URL",
      goodreads_url: "Goodreads Web Link",
      tags: "Tags List",
      custom: "Static Custom Value"
    };
    this.plugin.settings.properties.forEach((prop, index) => {
      const row = propList.createDiv({ cls: "gr-prop-row" });
      const toggle = row.createEl("input", {
        type: "checkbox",
        cls: "gr-prop-checkbox"
      });
      toggle.checked = prop.enabled;
      toggle.title = prop.enabled ? "Enabled" : "Disabled";
      toggle.addEventListener("change", async () => {
        prop.enabled = toggle.checked;
        await this.plugin.saveSettings();
      });
      const keyInput = row.createEl("input", {
        type: "text",
        cls: "gr-prop-key-input",
        value: prop.key
      });
      keyInput.placeholder = "Property Key (e.g. shelf)";
      keyInput.addEventListener("change", async () => {
        prop.key = keyInput.value.trim();
        await this.plugin.saveSettings();
      });
      const fieldBadge = row.createSpan({ cls: "gr-prop-field-badge" });
      fieldBadge.setText(fieldLabels[prop.field] || prop.field);
      if (prop.field === "custom") {
        const customValInput = row.createEl("input", {
          type: "text",
          cls: "gr-prop-custom-val-input",
          value: prop.customValue || ""
        });
        customValInput.placeholder = "Value (e.g. book)";
        customValInput.addEventListener("change", async () => {
          prop.customValue = customValInput.value;
          await this.plugin.saveSettings();
        });
      }
      const delBtn = row.createEl("button", {
        cls: "gr-prop-del-btn",
        title: "Delete property"
      });
      (0, import_obsidian4.setIcon)(delBtn, "trash-2");
      delBtn.addEventListener("click", async () => {
        this.plugin.settings.properties.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      });
    });
    const addCard = container.createDiv({ cls: "gr-add-prop-card" });
    addCard.createEl("h4", { text: "Add Property" });
    const addControls = addCard.createDiv({ cls: "gr-add-prop-controls" });
    const selectField = addControls.createEl("select", { cls: "gr-select" });
    const availableFields = [
      { id: "field", label: "Book Genre / Shelves (field)" },
      { id: "shelf", label: "Reading Shelf (read, currently-reading, to-read)" },
      { id: "title", label: "Book Title" },
      { id: "author", label: "Author Name" },
      { id: "goodreads_id", label: "Goodreads Book ID" },
      { id: "rating", label: "My Rating (1-5)" },
      { id: "rating_stars", label: "My Rating Stars (\u2605\u2605\u2605\u2605\u2605)" },
      { id: "average_rating", label: "Goodreads Average Rating" },
      { id: "pages", label: "Page Count" },
      { id: "published", label: "Publication Year" },
      { id: "isbn", label: "ISBN" },
      { id: "date_added", label: "Date Added" },
      { id: "date_read", label: "Date Read" },
      { id: "cover", label: "Cover Image URL" },
      { id: "goodreads_url", label: "Goodreads Web Link" },
      { id: "tags", label: "Tags List" },
      { id: "custom", label: "Custom Static Text" }
    ];
    for (const af of availableFields) {
      selectField.createEl("option", { value: af.id, text: af.label });
    }
    const newKeyInput = addControls.createEl("input", {
      type: "text",
      placeholder: "Property key (e.g. field)",
      value: "field"
    });
    selectField.addEventListener("change", () => {
      if (selectField.value === "rating") {
        newKeyInput.value = "my_rating";
      } else {
        newKeyInput.value = selectField.value;
      }
    });
    const addBtn = addControls.createEl("button", {
      text: "Add Property",
      cls: "mod-cta"
    });
    addBtn.addEventListener("click", async () => {
      const field = selectField.value;
      const key = newKeyInput.value.trim() || field;
      const newProp = {
        id: `prop-${Date.now()}`,
        key,
        field,
        enabled: true,
        customValue: field === "custom" ? "book" : void 0
      };
      this.plugin.settings.properties.push(newProp);
      await this.plugin.saveSettings();
      new import_obsidian4.Notice(`Added property "${key}"`);
      this.display();
    });
    const resetRow = container.createDiv({ cls: "gr-prop-reset-row" });
    const resetBtn = resetRow.createEl("button", {
      text: "Reset Properties to Defaults",
      cls: "gr-reset-btn"
    });
    resetBtn.addEventListener("click", async () => {
      const ok = window.confirm(
        "Reset all frontmatter properties back to standard default fields?"
      );
      if (ok) {
        this.plugin.settings.properties = JSON.parse(
          JSON.stringify(DEFAULT_PROPERTIES)
        );
        await this.plugin.saveSettings();
        new import_obsidian4.Notice("Properties reset to defaults");
        this.display();
      }
    });
  }
  // ================= CONTENT TAB =================
  renderContentTab(container) {
    container.createEl("h3", { text: "Note Content & Sections" });
    new import_obsidian4.Setting(container).setName("Embed Book Cover in Note Body").setDesc(
      "Embed the book cover image inside the note body. When disabled, the cover image URL will still be kept in your frontmatter properties."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeCover).onChange(async (val) => {
        this.plugin.settings.includeCover = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Include Book Synopsis").setDesc("Include Goodreads book description in the generated note.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeDescription).onChange(async (val) => {
        this.plugin.settings.includeDescription = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Include Personal Review & Rating").setDesc(
      "Include your personal Goodreads star rating and written review in the generated note."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeReview).onChange(async (val) => {
        this.plugin.settings.includeReview = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Include Reading Note Sections").setDesc(
      "Adds blank reflection headings for 'Key Takeaways', 'Memorable Quotes', and 'Personal Notes'. Recommended OFF if you prefer clean notes or already extract Kindle highlights."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeReadingSections).onChange(async (val) => {
        this.plugin.settings.includeReadingSections = val;
        await this.plugin.saveSettings();
      })
    );
    if (this.plugin.settings.storageMode === "folder") {
      new import_obsidian4.Setting(container).setName("Include 'Book Documents' Section").setDesc(
        "Add a '## \u{1F4C1} Book Documents' section with links to sub-notes inside the main book note (Folder storage mode)."
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.includeBookDocuments ?? true).onChange(async (val) => {
          this.plugin.settings.includeBookDocuments = val;
          await this.plugin.saveSettings();
        })
      );
    }
    container.createEl("h3", { text: "Kindle Notes & Highlights" });
    new import_obsidian4.Setting(container).setName("Extract Kindle Notes & Highlights").setDesc(
      "Automatically extract your synced Kindle highlights, locations, and personal annotations from Goodreads."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeHighlights).onChange(async (val) => {
        this.plugin.settings.includeHighlights = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Goodreads Session Cookie (Optional)").setDesc(
      "By default, Goodreads marks Kindle highlights as private unless set to 'Visible'. If your highlights are private, paste your `_session_id2` cookie here to fetch them."
    ).addText((text) => {
      text.setPlaceholder("Optional: paste _session_id2 cookie").setValue(this.plugin.settings.goodreadsCookie).onChange(async (val) => {
        this.plugin.settings.goodreadsCookie = val.trim();
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
  }
  // ================= SHELVES & SYNC TAB =================
  renderShelvesTab(container) {
    container.createEl("h3", { text: "Shelves & Syncing" });
    new import_obsidian4.Setting(container).setName("Default Shelf").setDesc("Which shelf to load initially when opening the Bookshelf view.").addDropdown(
      (dd) => dd.addOption("all", "All Books").addOption("currently-reading", "Currently Reading").addOption("read", "Read").addOption("to-read", "Want to Read").setValue(this.plugin.settings.defaultShelf).onChange(async (val) => {
        this.plugin.settings.defaultShelf = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Custom Shelves").setDesc(
      "Additional Goodreads shelf names to display as tabs (comma-separated, e.g. favorites, sci-fi, biography)."
    ).addText(
      (text) => text.setPlaceholder("e.g. favorites, non-fiction").setValue(this.plugin.settings.customShelves.join(", ")).onChange(async (val) => {
        this.plugin.settings.customShelves = val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(container).setName("Maximum Books to Fetch").setDesc("Limit the number of books retrieved per shelf.").addDropdown(
      (dd) => dd.addOption("50", "50 books").addOption("100", "100 books").addOption("200", "200 books").addOption("300", "300 books").setValue(String(this.plugin.settings.maxItems)).onChange(async (val) => {
        this.plugin.settings.maxItems = parseInt(val, 10) || 100;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/bookshelf-view.ts
var import_obsidian6 = require("obsidian");

// src/note-service.ts
var import_obsidian5 = require("obsidian");
var NoteService = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
  }
  /**
   * Sanitizes a string for use as a file name in Obsidian
   */
  sanitizeFileName(name) {
    return name.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
  }
  /**
   * Formats star representation of rating
   */
  getRatingStars(rating) {
    if (rating <= 0) return "";
    return "\u2605".repeat(Math.min(rating, 5)) + "\u2606".repeat(Math.max(0, 5 - rating));
  }
  /**
   * Extracts clean main book title (excluding lengthy subtitles) for file naming
   */
  getMainTitle(fullTitle) {
    if (!fullTitle) return "";
    let main = fullTitle;
    if (main.includes(":")) {
      const parts = main.split(":");
      if (parts[0] && parts[0].trim().length > 0) {
        main = parts[0].trim();
      }
    }
    if (main.includes(" \u2014 ")) {
      const parts = main.split(" \u2014 ");
      if (parts[0] && parts[0].trim().length > 0) {
        main = parts[0].trim();
      }
    }
    main = main.replace(
      /\s*\((?:a\s+novel|special\s+edition|revised\s+edition|expanded\s+edition|kindle\s+edition|annotated|paperback|hardcover)\)$/i,
      ""
    ).trim();
    return main || fullTitle.trim();
  }
  /**
   * Returns base book folder or note name (sanitized)
   */
  getBookFolderName(book) {
    const mainTitle = this.getMainTitle(book.title);
    let baseName = mainTitle;
    if (this.settings.noteTitleFormat === "title-author") {
      baseName = `${mainTitle} - ${book.author}`;
    } else if (this.settings.noteTitleFormat === "author-title") {
      baseName = `${book.author} - ${mainTitle}`;
    }
    return this.sanitizeFileName(baseName) || `Book-${book.bookId}`;
  }
  /**
   * Returns directory path for book when folder mode is used
   */
  getBookFolderPath(book) {
    const folderName = this.getBookFolderName(book);
    const parentFolder = this.settings.folder.trim();
    if (!parentFolder) {
      return folderName;
    }
    return (0, import_obsidian5.normalizePath)(`${parentFolder}/${folderName}`);
  }
  /**
   * Generates target note file path based on settings (single note vs folder per book)
   */
  getNoteFilePath(book) {
    const safeName = this.getBookFolderName(book);
    const folder = this.settings.folder.trim();
    if (this.settings.storageMode === "folder") {
      if (!folder) {
        return (0, import_obsidian5.normalizePath)(`${safeName}/${safeName}.md`);
      }
      return (0, import_obsidian5.normalizePath)(`${folder}/${safeName}/${safeName}.md`);
    }
    if (!folder) {
      return `${safeName}.md`;
    }
    return (0, import_obsidian5.normalizePath)(`${folder}/${safeName}.md`);
  }
  /**
   * Checks if a note for this book already exists in vault (supports single and folder mode)
   */
  findExistingBookNote(book) {
    const expectedPath = this.getNoteFilePath(book);
    const fileByPath = this.app.vault.getAbstractFileByPath(expectedPath);
    if (fileByPath instanceof import_obsidian5.TFile) {
      return fileByPath;
    }
    const safeName = this.getBookFolderName(book);
    const folder = this.settings.folder.trim();
    const altPath = this.settings.storageMode === "folder" ? folder ? (0, import_obsidian5.normalizePath)(`${folder}/${safeName}.md`) : `${safeName}.md` : folder ? (0, import_obsidian5.normalizePath)(`${folder}/${safeName}/${safeName}.md`) : (0, import_obsidian5.normalizePath)(`${safeName}/${safeName}.md`);
    const altFile = this.app.vault.getAbstractFileByPath(altPath);
    if (altFile instanceof import_obsidian5.TFile) {
      return altFile;
    }
    const targetFolder = this.settings.folder.trim();
    const files = this.app.vault.getMarkdownFiles();
    const cleanMainTitle = this.sanitizeFileName(
      this.getMainTitle(book.title)
    ).toLowerCase();
    const cleanFullTitle = this.sanitizeFileName(book.title).toLowerCase();
    const cleanSafeName = safeName.toLowerCase();
    for (const file of files) {
      if (targetFolder && !file.path.startsWith(targetFolder)) {
        continue;
      }
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter) {
        const id = cache.frontmatter.goodreads_id;
        if (id && String(id) === String(book.bookId)) {
          return file;
        }
      }
      const fileBase = file.basename.toLowerCase();
      if (fileBase === cleanMainTitle || fileBase === cleanFullTitle || fileBase === cleanSafeName) {
        return file;
      }
    }
    return null;
  }
  /**
   * Helper to resolve heading markdown prefix from HeadingLevel
   */
  getHeadingPrefix(level) {
    switch (level) {
      case "h1":
        return "#";
      case "h2":
        return "##";
      case "h4":
        return "####";
      case "h3":
      default:
        return "###";
    }
  }
  /**
   * Formats a list of highlights into markdown
   */
  formatHighlightsMarkdown(highlights) {
    if (highlights.length === 0) return "";
    const entries = [];
    for (const h of highlights) {
      const lines = [];
      if (h.text) {
        const quoteLines = h.text.replace(/\r\n/g, "\n").split("\n");
        for (const line of quoteLines) {
          lines.push(`> ${line}`);
        }
      } else {
        lines.push("> ");
      }
      if (h.location) {
        lines.push(`> \u2014 *Location: ${h.location}*`);
      } else {
        lines.push(`> \u2014 *Location: *`);
      }
      lines.push("");
      lines.push("**Note:** ");
      if (h.note) {
        lines.push(h.note);
        lines.push("");
      } else {
        lines.push("");
        lines.push("");
      }
      lines.push("---");
      entries.push(lines.join("\n"));
    }
    return entries.join("\n\n");
  }
  /**
   * Reads markdown template file from vault if path is set and valid
   */
  async readVaultFile(filePath) {
    if (!filePath || !filePath.trim()) return null;
    const cleanPath = (0, import_obsidian5.normalizePath)(filePath.trim());
    const file = this.app.vault.getAbstractFileByPath(cleanPath);
    if (file instanceof import_obsidian5.TFile) {
      return await this.app.vault.read(file);
    }
    return null;
  }
  /**
   * Returns today's date in YYYY-MM-DD
   */
  getTodayDate() {
    const d = /* @__PURE__ */ new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  /**
   * Generates a single blank highlight entry snippet (for shortcuts and manual entry)
   */
  getSingleHighlightSnippet() {
    return [
      "> ",
      "> \u2014 *Location: *",
      "",
      "**Note:** ",
      "",
      "",
      "---"
    ].join("\n");
  }
  /**
   * Generates a single blank vocabulary entry snippet (for shortcuts and manual entry)
   */
  getSingleVocabularySnippet() {
    const h = this.getHeadingPrefix(
      this.settings.vocabularyHeadingLevel || "h3"
    );
    return [
      `${h} Word`,
      "- **Definition**: ",
      '- **Book Context**: ""',
      "- **My Examples**:",
      "  1. "
    ].join("\n");
  }
  /**
   * Generates content for standalone Highlights & Notes.md file
   */
  async generateHighlightsNoteContent(book, highlights = []) {
    const bookFolderPath = this.getBookFolderPath(book);
    const mainTitle = this.getMainTitle(book.title);
    const safeName = this.getBookFolderName(book);
    const mainLink = `${bookFolderPath}/${safeName}`;
    const today = this.getTodayDate();
    let rawTemplate = null;
    if (this.settings.highlightsTemplatePath) {
      rawTemplate = await this.readVaultFile(
        this.settings.highlightsTemplatePath
      );
    }
    if (!rawTemplate && this.settings.customHighlightsTemplate && this.settings.customHighlightsTemplate.trim()) {
      rawTemplate = this.settings.customHighlightsTemplate;
    }
    if (!rawTemplate) {
      const frontmatter = [
        "---",
        `book: "[[${mainLink}|${mainTitle}]]"`,
        "type: highlights",
        "tags:",
        "  - book/highlights",
        "---",
        ""
      ].join("\n");
      let body;
      if (highlights.length > 0) {
        body = this.formatHighlightsMarkdown(highlights);
      } else {
        body = this.getSingleHighlightSnippet();
      }
      return frontmatter + body + "\n";
    }
    let processed = rawTemplate.replace(/\{\{title\}\}/gi, mainTitle).replace(/\{\{author\}\}/gi, book.author).replace(/\{\{book_link\}\}/gi, `[[${mainLink}|${mainTitle}]]`).replace(/\{\{date\}\}/gi, today).replace(/\{\{shelf\}\}/gi, book.shelf || "read");
    const singlePatternMatch = processed.match(/((?:^[ \t]*>[ \t]*.*(?:\r?\n|$))+[\s\S]*?---)/m) || processed.match(/((?:^[ \t]*>[ \t]*.*(?:\r?\n|$))+)/m);
    const pattern = singlePatternMatch && singlePatternMatch[0].includes("{{highlight}}") ? singlePatternMatch[0].trim() : [
      "> {{highlight}}",
      "> \u2014 *Location: {{location}}*",
      "",
      "**Note:** ",
      "{{note}}",
      "",
      "---"
    ].join("\n");
    const formatSingleHighlight = (h) => {
      const quote = h?.text || "";
      const loc = h?.location || "";
      const note = h?.note || "";
      return pattern.replace(/\{\{highlight\}\}/gi, quote).replace(/\{\{location\}\}/gi, loc).replace(/\{\{note\}\}/gi, note);
    };
    let renderedHighlights = "";
    if (highlights.length > 0) {
      renderedHighlights = highlights.map((h) => formatSingleHighlight(h)).join("\n\n");
    } else {
      renderedHighlights = formatSingleHighlight();
    }
    if (processed.includes("{{highlights}}")) {
      processed = processed.replace(/\{\{highlights\}\}/gi, renderedHighlights);
    } else if (singlePatternMatch && singlePatternMatch[0].includes("{{highlight}}")) {
      processed = processed.replace(singlePatternMatch[0], renderedHighlights);
    } else {
      processed = processed.trimEnd() + "\n\n" + renderedHighlights;
    }
    return processed;
  }
  /**
   * Generates content for standalone My Thoughts.md file
   */
  async generateMyThoughtsContent(book) {
    const bookFolderPath = this.getBookFolderPath(book);
    const mainTitle = this.getMainTitle(book.title);
    const safeName = this.getBookFolderName(book);
    const mainLink = `${bookFolderPath}/${safeName}`;
    const today = this.getTodayDate();
    let rawTemplate = null;
    if (this.settings.thoughtsTemplatePath) {
      rawTemplate = await this.readVaultFile(
        this.settings.thoughtsTemplatePath
      );
    }
    if (!rawTemplate && this.settings.customThoughtsTemplate && this.settings.customThoughtsTemplate.trim()) {
      rawTemplate = this.settings.customThoughtsTemplate;
    }
    if (rawTemplate) {
      return rawTemplate.replace(/\{\{title\}\}/gi, mainTitle).replace(/\{\{author\}\}/gi, book.author).replace(/\{\{book_link\}\}/gi, `[[${mainLink}|${mainTitle}]]`).replace(/\{\{date\}\}/gi, today).replace(/\{\{shelf\}\}/gi, book.shelf || "read");
    }
    return [
      "---",
      `book: "[[${mainLink}|${mainTitle}]]"`,
      "type: thoughts",
      "tags:",
      "  - book/thoughts",
      "---",
      "## \u{1F4A1} Key Takeaways & Core Ideas",
      "- ",
      "",
      "## \u{1F9E0} Personal Reflections & Interpretations",
      "- ",
      "",
      "## \u2753 Questions & Insights",
      "- ",
      ""
    ].join("\n");
  }
  /**
   * Generates content for standalone Vocabulary.md file
   */
  async generateVocabularyContent(book) {
    const bookFolderPath = this.getBookFolderPath(book);
    const mainTitle = this.getMainTitle(book.title);
    const safeName = this.getBookFolderName(book);
    const mainLink = `${bookFolderPath}/${safeName}`;
    const today = this.getTodayDate();
    const h = this.getHeadingPrefix(
      this.settings.vocabularyHeadingLevel || "h3"
    );
    let rawTemplate = null;
    if (this.settings.vocabularyTemplatePath) {
      rawTemplate = await this.readVaultFile(
        this.settings.vocabularyTemplatePath
      );
    }
    if (!rawTemplate && this.settings.customVocabularyTemplate && this.settings.customVocabularyTemplate.trim()) {
      rawTemplate = this.settings.customVocabularyTemplate;
    }
    if (rawTemplate) {
      return rawTemplate.replace(/\{\{title\}\}/gi, mainTitle).replace(/\{\{author\}\}/gi, book.author).replace(/\{\{book_link\}\}/gi, `[[${mainLink}|${mainTitle}]]`).replace(/\{\{date\}\}/gi, today).replace(/\{\{shelf\}\}/gi, book.shelf || "read").replace(/\{\{h\}\}/gi, h);
    }
    return [
      "---",
      `book: "[[${mainLink}|${mainTitle}]]"`,
      "type: vocabulary",
      "tags:",
      "  - book/vocabulary",
      "---",
      "",
      this.getSingleVocabularySnippet(),
      ""
    ].join("\n");
  }
  /**
   * Extracts clean genres from book userShelves, filtering out status shelves
   */
  getBookGenres(book) {
    const statusShelves = /* @__PURE__ */ new Set([
      "read",
      "currently-reading",
      "currently reading",
      "to-read",
      "to read",
      (book.shelf || "").toLowerCase().trim(),
      (book.shelf || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-")
    ]);
    const genres = [];
    for (const rawShelf of book.userShelves || []) {
      const trimmed = rawShelf.trim();
      const normalized = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      if (!trimmed || !normalized) continue;
      if (statusShelves.has(trimmed.toLowerCase()) || statusShelves.has(normalized)) {
        continue;
      }
      if (!genres.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
        genres.push(trimmed);
      }
    }
    return genres;
  }
  /**
   * Sanitizes a string into a valid Obsidian tag
   */
  sanitizeTag(tag) {
    let clean = tag.trim().replace(/^#+/, "");
    clean = clean.replace(/[\s\\]+/g, "-");
    clean = clean.replace(/[^a-zA-Z0-9_\-\/]/g, "-");
    clean = clean.replace(/-+/g, "-");
    clean = clean.replace(/\/+/g, "/");
    clean = clean.replace(/(^[-/]+|[-/]+$)/g, "");
    return clean;
  }
  /**
   * Resolves tags from settings, expanding dynamic properties like {{property_name}}
   */
  resolveTags(book) {
    const rawSetting = (this.settings.tagPrefix || "").trim();
    if (!rawSetting) return [];
    const genres = this.getBookGenres(book);
    const propertyValueMap = /* @__PURE__ */ new Map();
    const setMapValue = (name, values) => {
      const cleanKey = name.trim().toLowerCase();
      if (!cleanKey) return;
      propertyValueMap.set(cleanKey, values);
    };
    const getStandardFieldValues = (field) => {
      switch (field.toLowerCase()) {
        case "field":
        case "genre":
        case "genres":
        case "shelves":
          return genres;
        case "shelf":
        case "status":
          return book.shelf ? [book.shelf] : [];
        case "title":
          return book.title ? [this.getMainTitle(book.title)] : [];
        case "author":
          return book.author ? [book.author] : [];
        case "goodreads_id":
        case "id":
          return book.bookId ? [book.bookId] : [];
        case "isbn":
          return book.isbn ? [book.isbn] : [];
        case "rating":
        case "my_rating":
          return book.userRating > 0 ? [String(book.userRating)] : [];
        case "average_rating":
          return book.averageRating > 0 ? [String(book.averageRating)] : [];
        case "pages":
          return book.pages ? [String(book.pages)] : [];
        case "published":
        case "year":
          return book.publishedYear ? [book.publishedYear] : [];
        case "date_added":
          return book.userDateAdded ? [book.userDateAdded] : [];
        case "date_read":
          return book.userReadAt ? [book.userReadAt] : [];
        default:
          return [];
      }
    };
    const properties = this.settings.properties || DEFAULT_PROPERTIES;
    for (const prop of properties) {
      if (!prop.key) continue;
      let values = [];
      if (prop.field === "custom") {
        values = prop.customValue ? [prop.customValue] : [];
      } else {
        values = getStandardFieldValues(prop.field);
      }
      setMapValue(prop.key, values);
      setMapValue(prop.field, values);
    }
    setMapValue("field", genres);
    setMapValue("genre", genres);
    setMapValue("genres", genres);
    setMapValue("shelf", book.shelf ? [book.shelf] : []);
    setMapValue("status", book.shelf ? [book.shelf] : []);
    setMapValue("title", book.title ? [this.getMainTitle(book.title)] : []);
    setMapValue("author", book.author ? [book.author] : []);
    setMapValue("published", book.publishedYear ? [book.publishedYear] : []);
    const rawTokens = rawSetting.split(/[,\n]/).map((t) => t.trim()).filter((t) => t.length > 0);
    const tags = [];
    for (const token of rawTokens) {
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const matches = Array.from(token.matchAll(placeholderRegex));
      if (matches.length === 0) {
        const cleanTag = this.sanitizeTag(token);
        if (cleanTag && !tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
          tags.push(cleanTag);
        }
      } else {
        let expandedList = [token];
        for (const match of matches) {
          const rawMatch = match[0];
          const propName = match[1].trim().toLowerCase();
          const values = propertyValueMap.get(propName) || [];
          if (values.length === 0) {
            expandedList = [];
            break;
          }
          const nextExpanded = [];
          for (const current of expandedList) {
            for (const val of values) {
              nextExpanded.push(current.replace(rawMatch, val));
            }
          }
          expandedList = nextExpanded;
        }
        for (const exp of expandedList) {
          const cleanTag = this.sanitizeTag(exp);
          if (cleanTag && !tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
            tags.push(cleanTag);
          }
        }
      }
    }
    return tags;
  }
  /**
   * Generates formatted Markdown content for book note
   */
  generateNoteContent(book, highlights = []) {
    const starString = this.getRatingStars(book.userRating);
    const genres = this.getBookGenres(book);
    const tags = this.resolveTags(book);
    const properties = this.settings.properties || DEFAULT_PROPERTIES;
    const frontmatterLines = ["---"];
    for (const prop of properties) {
      if (!prop.enabled || !prop.key.trim()) continue;
      const key = prop.key.trim();
      switch (prop.field) {
        case "title":
          frontmatterLines.push(`${key}: ${JSON.stringify(book.title)}`);
          break;
        case "author":
          frontmatterLines.push(`${key}: ${JSON.stringify(book.author)}`);
          break;
        case "goodreads_id":
          frontmatterLines.push(`${key}: ${JSON.stringify(book.bookId)}`);
          break;
        case "shelf":
          frontmatterLines.push(`${key}: ${JSON.stringify(book.shelf || "read")}`);
          break;
        case "field":
        case "genres":
          if (genres.length > 0) {
            frontmatterLines.push(`${key}:`);
            for (const g of genres) {
              const formatted = /^[a-zA-Z0-9_\-\/]+$/.test(g) ? g : JSON.stringify(g);
              frontmatterLines.push(`  - ${formatted}`);
            }
          }
          break;
        case "isbn":
          if (book.isbn) {
            frontmatterLines.push(`${key}: ${JSON.stringify(book.isbn)}`);
          }
          break;
        case "rating":
          if (book.userRating > 0) {
            frontmatterLines.push(`${key}: ${book.userRating}`);
          }
          break;
        case "rating_stars":
          if (book.userRating > 0) {
            frontmatterLines.push(`${key}: ${JSON.stringify(starString)}`);
          }
          break;
        case "average_rating":
          if (book.averageRating > 0) {
            frontmatterLines.push(`${key}: ${book.averageRating}`);
          }
          break;
        case "pages":
          if (book.pages) {
            frontmatterLines.push(`${key}: ${book.pages}`);
          }
          break;
        case "published":
          if (book.publishedYear) {
            frontmatterLines.push(`${key}: ${JSON.stringify(book.publishedYear)}`);
          }
          break;
        case "date_added":
          if (book.userDateAdded) {
            frontmatterLines.push(`${key}: ${book.userDateAdded}`);
          }
          break;
        case "date_read":
          if (book.userReadAt) {
            frontmatterLines.push(`${key}: ${book.userReadAt}`);
          }
          break;
        case "cover":
          if (book.largeCoverUrl || book.coverUrl) {
            frontmatterLines.push(
              `${key}: ${JSON.stringify(book.largeCoverUrl || book.coverUrl)}`
            );
          }
          break;
        case "goodreads_url":
          if (book.link) {
            frontmatterLines.push(`${key}: ${JSON.stringify(book.link)}`);
          }
          break;
        case "tags":
          if (tags.length > 0) {
            frontmatterLines.push(`${key}:`);
            for (const tag of tags) {
              frontmatterLines.push(`  - ${tag}`);
            }
          }
          break;
        case "custom":
          if (prop.customValue !== void 0 && prop.customValue !== "") {
            frontmatterLines.push(`${key}: ${JSON.stringify(prop.customValue)}`);
          }
          break;
      }
    }
    frontmatterLines.push("---");
    const bodyLines = [];
    if (this.settings.includeCover && (book.largeCoverUrl || book.coverUrl)) {
      const coverUrl = book.largeCoverUrl || book.coverUrl;
      bodyLines.push(`![Book Cover|240](${coverUrl})`);
      bodyLines.push("");
    }
    if (this.settings.includeDescription && book.description) {
      bodyLines.push("# Synopsis");
      const styledSynopsis = book.description.split(/\n{2,}/).map((p) => `<small>${p.trim()}</small>`).join("\n\n");
      bodyLines.push(styledSynopsis);
      bodyLines.push("");
      bodyLines.push("---");
      bodyLines.push("");
    }
    if (this.settings.includeReview && (book.userReview || book.userRating > 0)) {
      bodyLines.push("# My Review");
      if (book.userRating > 0) {
        bodyLines.push(`> [!quote] **Rating:** ${starString} (${book.userRating}/5)`);
      } else {
        bodyLines.push("> [!quote] Review");
      }
      if (book.userReview) {
        const reviewLines = book.userReview.split("\n");
        for (const line of reviewLines) {
          bodyLines.push(line.trim() ? `> ${line}` : ">");
        }
      }
      bodyLines.push("");
      bodyLines.push("---");
      bodyLines.push("");
    }
    const shouldEmbedHighlightsInMainNote = this.settings.includeHighlights && highlights.length > 0 && (this.settings.storageMode === "single" || !this.settings.createHighlightsFile);
    if (shouldEmbedHighlightsInMainNote) {
      bodyLines.push(this.formatHighlightsMarkdown(highlights));
    }
    if (this.settings.includeReadingSections) {
      bodyLines.push("## Key Takeaways & Highlights");
      bodyLines.push("- ");
      bodyLines.push("");
      bodyLines.push("## Memorable Quotes");
      bodyLines.push("> ");
      bodyLines.push("");
      bodyLines.push("## Personal Notes & Thoughts");
      bodyLines.push("");
    }
    if (this.settings.storageMode === "folder" && (this.settings.includeBookDocuments ?? true)) {
      const bookFolderPath = this.getBookFolderPath(book);
      const docLinks = [];
      if (this.settings.createHighlightsFile) {
        docLinks.push(
          `- \u{1F58D}\uFE0F [[${bookFolderPath}/Highlights & Notes|Highlights & Notes]]`
        );
      }
      if (this.settings.createThoughtsFile) {
        docLinks.push(
          `- \u{1F4AD} [[${bookFolderPath}/My Thoughts|My Thoughts]]`
        );
      }
      if (this.settings.createVocabularyFile) {
        docLinks.push(
          `- \u{1F4DA} [[${bookFolderPath}/Vocabulary|Vocabulary]]`
        );
      }
      if (docLinks.length > 0) {
        const lastNonEmpty = [...bodyLines].reverse().find((l) => l.trim().length > 0);
        if (lastNonEmpty !== "---" && bodyLines.length > 0) {
          bodyLines.push("---");
          bodyLines.push("");
        }
        bodyLines.push("## \u{1F4C1} Book Documents");
        bodyLines.push(...docLinks);
        bodyLines.push("");
      }
    }
    const rawNote = [...frontmatterLines, ...bodyLines].join("\n");
    const cleanedNote = rawNote.replace(
      /(?:\r?\n[ \t]*---[ \t]*\r?\n(?:[ \t]*\r?\n)*)+[ \t]*---[ \t]*(?:\r?\n|$)/g,
      "\n---\n\n"
    );
    return cleanedNote;
  }
  /**
   * Ensures parent directory exists in vault
   */
  async ensureFolderExists(folderPath) {
    const cleanPath = (0, import_obsidian5.normalizePath)(folderPath.trim());
    if (!cleanPath || cleanPath === "." || cleanPath === "/") {
      return;
    }
    const parts = cleanPath.split("/").filter((p) => p.length > 0);
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const file = this.app.vault.getAbstractFileByPath(currentPath);
      if (!file) {
        await this.app.vault.createFolder(currentPath);
      } else if (!(file instanceof import_obsidian5.TFolder)) {
        throw new Error(`Path conflict: "${currentPath}" exists but is not a folder.`);
      }
    }
  }
  /**
   * Creates or opens note, saving Goodreads Kindle highlights directly on creation
   */
  async createOrOpenBookNote(book) {
    const existingFile = this.findExistingBookNote(book);
    if (existingFile && !this.settings.overwriteExisting) {
      let syncedCount = 0;
      if (this.settings.includeHighlights) {
        try {
          syncedCount = await this.syncHighlightsToNote(
            existingFile,
            void 0,
            book
          );
        } catch (err) {
          console.warn(
            `[Goodreads Bookshelf] Could not sync highlights to existing note "${book.title}":`,
            err
          );
        }
      }
      if (this.settings.openNoteAfterCreation) {
        await this.openFile(existingFile);
      }
      return {
        file: existingFile,
        alreadyExisted: true,
        highlightsCount: syncedCount
      };
    }
    const isFolderMode = this.settings.storageMode === "folder";
    const bookFolderPath = isFolderMode ? this.getBookFolderPath(book) : this.settings.folder.trim();
    if (bookFolderPath) {
      await this.ensureFolderExists(bookFolderPath);
    }
    let highlights = [];
    if (this.settings.includeHighlights && this.settings.userId) {
      try {
        highlights = await GoodreadsService.fetchBookHighlights(
          this.settings.userId,
          book.bookId,
          this.settings.goodreadsCookie
        );
      } catch (err) {
        console.warn(
          `[Goodreads Bookshelf] Failed to fetch highlights for "${book.title}":`,
          err
        );
      }
    }
    const notePath = this.getNoteFilePath(book);
    const content = this.generateNoteContent(book, highlights);
    let targetFile;
    if (existingFile && this.settings.overwriteExisting) {
      await this.app.vault.modify(existingFile, content);
      targetFile = existingFile;
    } else {
      targetFile = await this.app.vault.create(notePath, content);
    }
    if (isFolderMode) {
      if (this.settings.createHighlightsFile) {
        const highlightsPath = (0, import_obsidian5.normalizePath)(
          `${bookFolderPath}/Highlights & Notes.md`
        );
        const existingHighlights = this.app.vault.getAbstractFileByPath(highlightsPath);
        const highlightsContent = await this.generateHighlightsNoteContent(
          book,
          highlights
        );
        if (!existingHighlights) {
          await this.app.vault.create(highlightsPath, highlightsContent);
        } else if (existingHighlights instanceof import_obsidian5.TFile && highlights.length > 0) {
          await this.app.vault.modify(existingHighlights, highlightsContent);
        }
      }
      if (this.settings.createThoughtsFile) {
        const thoughtsPath = (0, import_obsidian5.normalizePath)(`${bookFolderPath}/My Thoughts.md`);
        if (!this.app.vault.getAbstractFileByPath(thoughtsPath)) {
          const thoughtsContent = await this.generateMyThoughtsContent(book);
          await this.app.vault.create(thoughtsPath, thoughtsContent);
        }
      }
      if (this.settings.createVocabularyFile) {
        const vocabPath = (0, import_obsidian5.normalizePath)(`${bookFolderPath}/Vocabulary.md`);
        if (!this.app.vault.getAbstractFileByPath(vocabPath)) {
          const vocabContent = await this.generateVocabularyContent(book);
          await this.app.vault.create(vocabPath, vocabContent);
        }
      }
    }
    if (this.settings.openNoteAfterCreation) {
      await this.openFile(targetFile);
    }
    return {
      file: targetFile,
      alreadyExisted: false,
      highlightsCount: highlights.length
    };
  }
  /**
   * Syncs highlights into an already existing active book note or its Highlights & Notes.md
   */
  async syncHighlightsToNote(file, cachedHighlights, book) {
    let bookId = book?.bookId;
    let mainTitle = book?.title ? this.getMainTitle(book.title) : file.basename;
    let author = book?.author || "";
    let shelf = book?.shelf || "read";
    let targetHighlightFile = file;
    if (!bookId) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.goodreads_id) {
        bookId = String(cache.frontmatter.goodreads_id);
        mainTitle = cache.frontmatter.title || mainTitle;
        author = cache.frontmatter.author || author;
        shelf = cache.frontmatter.shelf || shelf;
      }
    }
    if (!bookId) {
      try {
        const raw = await this.app.vault.read(file);
        const idMatch = raw.match(/goodreads_id:\s*["']?([0-9]+)["']?/);
        if (idMatch && idMatch[1]) {
          bookId = idMatch[1];
          const titleMatch = raw.match(/title:\s*["']?([^"\r\n]+)["']?/);
          if (titleMatch && titleMatch[1]) mainTitle = titleMatch[1];
          const authorMatch = raw.match(/author:\s*["']?([^"\r\n]+)["']?/);
          if (authorMatch && authorMatch[1]) author = authorMatch[1];
          const shelfMatch = raw.match(/shelf:\s*["']?([^"\r\n]+)["']?/);
          if (shelfMatch && shelfMatch[1]) shelf = shelfMatch[1];
        }
      } catch {
      }
    }
    if (!bookId && this.settings.storageMode === "folder" && file.parent) {
      for (const sibling of file.parent.children) {
        if (sibling instanceof import_obsidian5.TFile && sibling.extension === "md" && sibling.path !== file.path) {
          const sCache = this.app.metadataCache.getFileCache(sibling);
          if (sCache?.frontmatter?.goodreads_id) {
            bookId = String(sCache.frontmatter.goodreads_id);
            mainTitle = sCache.frontmatter.title || sibling.basename;
            author = sCache.frontmatter.author || author;
            shelf = sCache.frontmatter.shelf || shelf;
            break;
          }
          try {
            const sRaw = await this.app.vault.read(sibling);
            const sMatch = sRaw.match(/goodreads_id:\s*["']?([0-9]+)["']?/);
            if (sMatch && sMatch[1]) {
              bookId = sMatch[1];
              const titleMatch = sRaw.match(/title:\s*["']?([^"\r\n]+)["']?/);
              if (titleMatch && titleMatch[1]) mainTitle = titleMatch[1];
              const authorMatch = sRaw.match(/author:\s*["']?([^"\r\n]+)["']?/);
              if (authorMatch && authorMatch[1]) author = authorMatch[1];
              const shelfMatch = sRaw.match(/shelf:\s*["']?([^"\r\n]+)["']?/);
              if (shelfMatch && shelfMatch[1]) shelf = shelfMatch[1];
              break;
            }
          } catch {
          }
        }
      }
    }
    if (!bookId) {
      throw new Error(
        "Current file or book folder does not have a 'goodreads_id' in its frontmatter."
      );
    }
    if (this.settings.storageMode === "folder" && this.settings.createHighlightsFile && file.parent) {
      const candidatePath = (0, import_obsidian5.normalizePath)(
        `${file.parent.path}/Highlights & Notes.md`
      );
      const candidate = this.app.vault.getAbstractFileByPath(candidatePath);
      if (candidate instanceof import_obsidian5.TFile) {
        targetHighlightFile = candidate;
      }
    }
    const highlights = cachedHighlights || await GoodreadsService.fetchBookHighlights(
      this.settings.userId,
      String(bookId),
      this.settings.goodreadsCookie
    );
    if (highlights.length === 0) {
      return 0;
    }
    if (targetHighlightFile.name === "Highlights & Notes.md") {
      const bookStub = book || {
        bookId,
        title: mainTitle,
        author,
        shelf,
        isbn: "",
        coverUrl: "",
        largeCoverUrl: "",
        userRating: 0,
        averageRating: 0,
        pages: null,
        publishedYear: "",
        userReadAt: "",
        userDateAdded: "",
        userShelves: [],
        userReview: "",
        description: "",
        link: "",
        guid: ""
      };
      const newContent2 = await this.generateHighlightsNoteContent(
        bookStub,
        highlights
      );
      await this.app.vault.modify(targetHighlightFile, newContent2);
      return highlights.length;
    }
    const highlightsMd = this.formatHighlightsMarkdown(highlights);
    const currentContent = await this.app.vault.read(targetHighlightFile);
    const sectionRegex = /#{1,6}\s+Highlights & Annotations[\s\S]*?(?=\n#{1,6}\s+|$)/;
    let newContent;
    if (sectionRegex.test(currentContent)) {
      newContent = currentContent.replace(sectionRegex, highlightsMd.trim());
    } else if (currentContent.includes("## \u{1F4C1} Book Documents")) {
      const trimmedMd = highlightsMd.trim();
      const insert = trimmedMd.endsWith("---") ? `${trimmedMd}

## \u{1F4C1} Book Documents` : `${trimmedMd}

---

## \u{1F4C1} Book Documents`;
      newContent = currentContent.replace(
        /(?:---\s*\r?\n+)?## 📁 Book Documents/,
        insert
      );
    } else {
      newContent = currentContent.trimEnd() + "\n\n" + highlightsMd;
    }
    newContent = newContent.replace(
      /(?:\r?\n[ \t]*---[ \t]*\r?\n(?:[ \t]*\r?\n)*)+[ \t]*---[ \t]*(?:\r?\n|$)/g,
      "\n---\n\n"
    );
    await this.app.vault.modify(targetHighlightFile, newContent);
    return highlights.length;
  }
  /**
   * Opens file in editor
   */
  async openFile(file) {
    const mode = this.settings.openLocation;
    let leaf = this.app.workspace.getLeaf(false);
    if (mode === "new-tab") {
      leaf = this.app.workspace.getLeaf("tab");
    } else if (mode === "split") {
      leaf = this.app.workspace.getLeaf("split");
    }
    await leaf.openFile(file, { active: true });
  }
};

// src/bookshelf-view.ts
var VIEW_TYPE_GOODREADS = "goodreads-bookshelf-view";
var GoodreadsBookshelfView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.books = [];
    this.activeShelf = "all";
    this.searchQuery = "";
    this.filterVaultStatus = "all";
    this.sortBy = "date";
    this.viewMode = "grid";
    this.isLoading = false;
    this.errorMessage = "";
    this.contentElContainer = null;
  }
  getViewType() {
    return VIEW_TYPE_GOODREADS;
  }
  getDisplayText() {
    return "Goodreads Bookshelf";
  }
  getIcon() {
    return "library";
  }
  async onOpen() {
    this.activeShelf = this.plugin.settings.defaultShelf || "all";
    this.render();
    if (this.plugin.settings.userId.trim()) {
      await this.loadBooks();
    }
  }
  async onClose() {
    this.containerEl.empty();
  }
  /**
   * Fetches books from Goodreads service
   */
  async loadBooks(shelf) {
    if (shelf !== void 0) {
      this.activeShelf = shelf;
    }
    const userId = this.plugin.settings.userId.trim();
    if (!userId) {
      this.errorMessage = "Goodreads User ID is not set. Please configure it in settings.";
      this.books = [];
      this.render();
      return;
    }
    this.isLoading = true;
    this.errorMessage = "";
    this.render();
    try {
      const res = await GoodreadsService.fetchShelf(
        userId,
        this.activeShelf,
        this.plugin.settings.maxItems
      );
      this.books = res.books;
      this.isLoading = false;
      this.render();
      new import_obsidian6.Notice(`Loaded ${this.books.length} books from Goodreads`);
    } catch (err) {
      this.isLoading = false;
      this.errorMessage = err.message || "Failed to fetch Goodreads books";
      this.render();
    }
  }
  /**
   * Main render function
   */
  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("gr-bookshelf-view-container");
    this.renderHeader(container);
    const body = container.createDiv({ cls: "gr-bookshelf-body" });
    this.contentElContainer = body;
    if (!this.plugin.settings.userId.trim()) {
      this.renderEmptySettingsState(body);
      return;
    }
    if (this.isLoading) {
      this.renderLoadingState(body);
      return;
    }
    if (this.errorMessage) {
      this.renderErrorState(body);
      return;
    }
    this.renderToolbar(body);
    this.renderBookGrid(body);
  }
  /**
   * Header with Title and Quick Actions
   */
  renderHeader(container) {
    const header = container.createDiv({ cls: "gr-bookshelf-header" });
    const titleGroup = header.createDiv({ cls: "gr-header-title-group" });
    const iconSpan = titleGroup.createSpan({ cls: "gr-header-icon" });
    (0, import_obsidian6.setIcon)(iconSpan, "library");
    const textGroup = titleGroup.createDiv();
    textGroup.createEl("h2", { text: "Goodreads Bookshelf", cls: "gr-title" });
    const subText = textGroup.createSpan({ cls: "gr-subtitle" });
    if (this.plugin.settings.userId.trim()) {
      subText.setText(`User ID: ${this.plugin.settings.userId.trim()}`);
    } else {
      subText.setText("Setup required");
    }
    const actions = header.createDiv({ cls: "gr-header-actions" });
    const refreshBtn = actions.createEl("button", {
      cls: "gr-icon-btn",
      title: "Refresh Bookshelf"
    });
    (0, import_obsidian6.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.loadBooks());
    const settingsBtn = actions.createEl("button", {
      cls: "gr-icon-btn",
      title: "Open Plugin Settings"
    });
    (0, import_obsidian6.setIcon)(settingsBtn, "settings");
    settingsBtn.addEventListener("click", () => {
      this.app.setting.open();
      this.app.setting.openTabById(this.plugin.manifest.id);
    });
  }
  /**
   * State when User ID is missing
   */
  renderEmptySettingsState(container) {
    const emptyState = container.createDiv({ cls: "gr-empty-state" });
    const iconEl = emptyState.createDiv({ cls: "gr-empty-icon" });
    (0, import_obsidian6.setIcon)(iconEl, "book-open");
    emptyState.createEl("h3", { text: "Welcome to Goodreads Bookshelf" });
    emptyState.createEl("p", {
      text: "Please configure your Goodreads User ID in settings to view and sync your shelves."
    });
    const btn = emptyState.createEl("button", {
      text: "Open Settings",
      cls: "mod-cta"
    });
    btn.addEventListener("click", () => {
      this.app.setting.open();
      this.app.setting.openTabById(this.plugin.manifest.id);
    });
  }
  /**
   * Loading state
   */
  renderLoadingState(container) {
    const loadingState = container.createDiv({ cls: "gr-loading-state" });
    const spinner = loadingState.createDiv({ cls: "gr-spinner" });
    (0, import_obsidian6.setIcon)(spinner, "loader-2");
    loadingState.createEl("p", {
      text: `Fetching books for shelf "${this.activeShelf}"...`
    });
  }
  /**
   * Error state
   */
  renderErrorState(container) {
    const errState = container.createDiv({ cls: "gr-error-state" });
    const iconEl = errState.createDiv({ cls: "gr-error-icon" });
    (0, import_obsidian6.setIcon)(iconEl, "alert-circle");
    errState.createEl("h3", { text: "Could Not Load Bookshelf" });
    errState.createEl("p", { text: this.errorMessage });
    const btnGroup = errState.createDiv({ cls: "gr-error-btns" });
    const retryBtn = btnGroup.createEl("button", {
      text: "Try Again",
      cls: "mod-cta"
    });
    retryBtn.addEventListener("click", () => this.loadBooks());
    const settingsBtn = btnGroup.createEl("button", {
      text: "Check Settings"
    });
    settingsBtn.addEventListener("click", () => {
      this.app.setting.open();
      this.app.setting.openTabById(this.plugin.manifest.id);
    });
  }
  /**
   * Filters and Controls Toolbar
   */
  renderToolbar(container) {
    const toolbar = container.createDiv({ cls: "gr-toolbar" });
    const tabsWrapper = toolbar.createDiv({ cls: "gr-shelf-tabs" });
    const standardShelves = [
      { id: "all", label: "All Books" },
      { id: "currently-reading", label: "Currently Reading" },
      { id: "read", label: "Read" },
      { id: "to-read", label: "Want to Read" }
    ];
    const allShelves = [...standardShelves];
    for (const cs of this.plugin.settings.customShelves) {
      if (cs && !allShelves.some((s) => s.id === cs)) {
        allShelves.push({ id: cs, label: cs });
      }
    }
    for (const shelf of allShelves) {
      const tab = tabsWrapper.createEl("button", {
        cls: `gr-tab-btn ${this.activeShelf === shelf.id ? "is-active" : ""}`,
        text: shelf.label
      });
      tab.addEventListener("click", () => {
        if (this.activeShelf !== shelf.id) {
          this.activeShelf = shelf.id;
          this.loadBooks(shelf.id);
        }
      });
    }
    const controlsRow = toolbar.createDiv({ cls: "gr-controls-row" });
    const searchContainer = controlsRow.createDiv({ cls: "gr-search-box" });
    const searchIcon = searchContainer.createSpan({ cls: "gr-search-icon" });
    (0, import_obsidian6.setIcon)(searchIcon, "search");
    const input = searchContainer.createEl("input", {
      type: "text",
      placeholder: "Search by title, author, or shelf tags...",
      value: this.searchQuery
    });
    const clearBtn = searchContainer.createEl("button", {
      cls: `gr-search-clear-btn ${this.searchQuery ? "is-visible" : ""}`,
      title: "Clear search"
    });
    (0, import_obsidian6.setIcon)(clearBtn, "x");
    input.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      if (this.searchQuery) {
        clearBtn.addClass("is-visible");
      } else {
        clearBtn.removeClass("is-visible");
      }
      this.updateBookListOnly();
    });
    clearBtn.addEventListener("click", () => {
      input.value = "";
      this.searchQuery = "";
      clearBtn.removeClass("is-visible");
      input.focus();
      this.updateBookListOnly();
    });
    const vaultFilterSelect = controlsRow.createEl("select", {
      cls: "gr-select gr-filter-vault"
    });
    const vaultOpts = [
      { value: "all", label: "All Vault Status" },
      { value: "not-in-vault", label: "Not Yet Saved" },
      { value: "in-vault", label: "Saved in Vault" }
    ];
    for (const opt of vaultOpts) {
      const option = vaultFilterSelect.createEl("option", {
        value: opt.value,
        text: opt.label
      });
      if (this.filterVaultStatus === opt.value) {
        option.selected = true;
      }
    }
    vaultFilterSelect.addEventListener("change", (e) => {
      this.filterVaultStatus = e.target.value;
      this.updateBookListOnly();
    });
    const sortSelect = controlsRow.createEl("select", {
      cls: "gr-select gr-sort-select"
    });
    const sortOpts = [
      { value: "date", label: "Sort: Feed Order" },
      { value: "rating", label: "Sort: Highest Rating" },
      { value: "title", label: "Sort: Title (A-Z)" },
      { value: "author", label: "Sort: Author (A-Z)" },
      { value: "pages", label: "Sort: Page Count" }
    ];
    for (const opt of sortOpts) {
      const option = sortSelect.createEl("option", {
        value: opt.value,
        text: opt.label
      });
      if (this.sortBy === opt.value) {
        option.selected = true;
      }
    }
    sortSelect.addEventListener("change", (e) => {
      this.sortBy = e.target.value;
      this.updateBookListOnly();
    });
    const viewToggle = controlsRow.createDiv({ cls: "gr-view-toggle" });
    const gridBtn = viewToggle.createEl("button", {
      cls: `gr-view-btn ${this.viewMode === "grid" ? "is-active" : ""}`,
      title: "Grid View"
    });
    (0, import_obsidian6.setIcon)(gridBtn, "layout-grid");
    gridBtn.addEventListener("click", () => {
      this.viewMode = "grid";
      this.updateToolbarAndList();
    });
    const listBtn = viewToggle.createEl("button", {
      cls: `gr-view-btn ${this.viewMode === "list" ? "is-active" : ""}`,
      title: "List View"
    });
    (0, import_obsidian6.setIcon)(listBtn, "list");
    listBtn.addEventListener("click", () => {
      this.viewMode = "list";
      this.updateToolbarAndList();
    });
  }
  /**
   * Filter and Sort Books
   */
  getFilteredAndSortedBooks() {
    const noteService = new NoteService(this.app, this.plugin.settings);
    return this.books.filter((book) => {
      if (this.searchQuery) {
        const matchTitle = book.title.toLowerCase().includes(this.searchQuery);
        const matchAuthor = book.author.toLowerCase().includes(this.searchQuery);
        const matchShelves = book.userShelves.some(
          (s) => s.toLowerCase().includes(this.searchQuery)
        );
        if (!matchTitle && !matchAuthor && !matchShelves) {
          return false;
        }
      }
      if (this.filterVaultStatus !== "all") {
        const exists = noteService.findExistingBookNote(book) !== null;
        if (this.filterVaultStatus === "in-vault" && !exists) return false;
        if (this.filterVaultStatus === "not-in-vault" && exists) return false;
      }
      return true;
    }).sort((a, b) => {
      switch (this.sortBy) {
        case "rating":
          return (b.userRating || b.averageRating) - (a.userRating || a.averageRating);
        case "title":
          return a.title.localeCompare(b.title);
        case "author":
          return a.author.localeCompare(b.author);
        case "pages":
          return (b.pages || 0) - (a.pages || 0);
        case "date":
        default:
          return 0;
      }
    });
  }
  /**
   * Quick update of the book grid without full re-render
   */
  updateBookListOnly() {
    if (!this.contentElContainer) return;
    const oldContainer = this.contentElContainer.querySelector(".gr-books-view");
    if (oldContainer) {
      oldContainer.remove();
    }
    const oldStats = this.contentElContainer.querySelector(".gr-stats-bar");
    if (oldStats) {
      oldStats.remove();
    }
    this.renderBookGrid(this.contentElContainer);
  }
  updateToolbarAndList() {
    this.render();
  }
  /**
   * Render book cards grid or list
   */
  renderBookGrid(container) {
    const filtered = this.getFilteredAndSortedBooks();
    const noteService = new NoteService(this.app, this.plugin.settings);
    const statsBar = container.createDiv({ cls: "gr-stats-bar" });
    const countSpan = statsBar.createSpan({ cls: "gr-stats-count" });
    countSpan.setText(
      `Showing ${filtered.length} of ${this.books.length} books`
    );
    if (filtered.length > 0) {
      const batchBtn = statsBar.createEl("button", {
        cls: "gr-batch-btn",
        text: "Save all visible as notes"
      });
      (0, import_obsidian6.setIcon)(batchBtn.createSpan({ cls: "gr-batch-icon" }), "download");
      batchBtn.addEventListener("click", () => this.batchImportBooks(filtered));
    }
    if (filtered.length === 0) {
      const emptyMsg = container.createDiv({
        cls: "gr-books-view gr-no-results"
      });
      const icon = emptyMsg.createDiv({ cls: "gr-empty-icon" });
      (0, import_obsidian6.setIcon)(icon, "search-x");
      emptyMsg.createEl("p", {
        text: "No books match your current search or filter."
      });
      return;
    }
    const booksContainer = container.createDiv({
      cls: `gr-books-view ${this.viewMode === "grid" ? "gr-books-grid" : "gr-books-list"}`
    });
    for (const book of filtered) {
      const existingFile = noteService.findExistingBookNote(book);
      const isSaved = existingFile !== null;
      if (this.viewMode === "grid") {
        this.renderGridCard(booksContainer, book, isSaved, noteService);
      } else {
        this.renderListRow(booksContainer, book, isSaved, noteService);
      }
    }
  }
  /**
   * Render single book card in Grid Mode
   */
  renderGridCard(container, book, isSaved, noteService) {
    const card = container.createDiv({
      cls: `gr-book-card ${isSaved ? "is-saved" : ""}`
    });
    const coverWrapper = card.createDiv({ cls: "gr-cover-wrapper" });
    if (book.largeCoverUrl || book.coverUrl) {
      const img = coverWrapper.createEl("img", {
        cls: "gr-cover-img",
        attr: {
          src: book.largeCoverUrl || book.coverUrl,
          alt: book.title,
          loading: "lazy"
        }
      });
      img.onerror = () => {
        img.remove();
        this.renderFallbackCover(coverWrapper, book);
      };
    } else {
      this.renderFallbackCover(coverWrapper, book);
    }
    if (isSaved) {
      const savedBadge = coverWrapper.createDiv({ cls: "gr-saved-badge" });
      (0, import_obsidian6.setIcon)(savedBadge, "check");
      savedBadge.createSpan({ text: "Saved" });
    }
    const info = card.createDiv({ cls: "gr-card-info" });
    const titleEl = info.createEl("h4", {
      text: book.title,
      cls: "gr-book-title",
      title: book.title
    });
    info.createDiv({
      text: book.author,
      cls: "gr-book-author",
      title: book.author
    });
    const metaRow = info.createDiv({ cls: "gr-card-meta-row" });
    if (book.userRating > 0) {
      const ratingEl = metaRow.createSpan({ cls: "gr-stars-user" });
      ratingEl.setText(noteService.getRatingStars(book.userRating));
      ratingEl.title = `Your Rating: ${book.userRating}/5`;
    } else if (book.averageRating > 0) {
      const ratingEl = metaRow.createSpan({ cls: "gr-stars-avg" });
      ratingEl.setText(`\u2605 ${book.averageRating}`);
      ratingEl.title = `Goodreads Avg: ${book.averageRating}`;
    }
    if (book.publishedYear) {
      metaRow.createSpan({
        text: book.publishedYear,
        cls: "gr-meta-year"
      });
    }
    if (book.shelf) {
      const shelfBadge = info.createSpan({
        cls: `gr-shelf-pill gr-shelf-${book.shelf}`
      });
      shelfBadge.setText(book.shelf.replace("-", " "));
    }
    const actions = card.createDiv({ cls: "gr-card-actions" });
    const primaryBtn = actions.createEl("button", {
      cls: `gr-action-btn ${isSaved ? "gr-btn-open" : "gr-btn-create mod-cta"}`
    });
    const iconSpan = primaryBtn.createSpan({ cls: "gr-btn-icon" });
    (0, import_obsidian6.setIcon)(iconSpan, isSaved ? "file-text" : "plus");
    const labelSpan = primaryBtn.createSpan({ cls: "gr-btn-label" });
    labelSpan.setText(isSaved ? "Open Note" : "Create Note");
    const handleBookClick = async () => {
      try {
        primaryBtn.disabled = true;
        labelSpan.setText("Working...");
        const res = await noteService.createOrOpenBookNote(book);
        if (res.alreadyExisted) {
          if (res.highlightsCount > 0) {
            new import_obsidian6.Notice(`Synced ${res.highlightsCount} Kindle highlights to "${book.title}"!`);
          } else {
            new import_obsidian6.Notice(`Opened existing note: "${book.title}"`);
          }
        } else if (res.highlightsCount > 0) {
          new import_obsidian6.Notice(
            `Created note for "${book.title}" with ${res.highlightsCount} Kindle highlights!`,
            5e3
          );
        } else {
          new import_obsidian6.Notice(`Created book note: "${book.title}"`);
        }
        this.updateBookListOnly();
      } catch (err) {
        new import_obsidian6.Notice(`Error: ${err.message}`);
        labelSpan.setText(isSaved ? "Open Note" : "Create Note");
        primaryBtn.disabled = false;
      }
    };
    primaryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleBookClick();
    });
    titleEl.addEventListener("click", () => handleBookClick());
    if (book.link) {
      const linkBtn = actions.createEl("a", {
        cls: "gr-link-btn",
        href: book.link,
        title: "View on Goodreads"
      });
      (0, import_obsidian6.setIcon)(linkBtn, "external-link");
    }
  }
  /**
   * Render single book row in List Mode
   */
  renderListRow(container, book, isSaved, noteService) {
    const row = container.createDiv({
      cls: `gr-book-row ${isSaved ? "is-saved" : ""}`
    });
    const miniCover = row.createDiv({ cls: "gr-mini-cover" });
    if (book.coverUrl) {
      miniCover.createEl("img", {
        attr: { src: book.coverUrl, alt: book.title, loading: "lazy" }
      });
    } else {
      const placeholder = miniCover.createDiv({ cls: "gr-mini-fallback" });
      (0, import_obsidian6.setIcon)(placeholder, "book");
    }
    const info = row.createDiv({ cls: "gr-row-info" });
    const titleEl = info.createEl("div", {
      text: book.title,
      cls: "gr-row-title"
    });
    info.createEl("div", { text: book.author, cls: "gr-row-author" });
    const meta = row.createDiv({ cls: "gr-row-meta" });
    if (book.userRating > 0) {
      meta.createSpan({
        text: noteService.getRatingStars(book.userRating),
        cls: "gr-stars-user"
      });
    } else if (book.averageRating > 0) {
      meta.createSpan({
        text: `\u2605 ${book.averageRating}`,
        cls: "gr-stars-avg"
      });
    }
    if (book.pages) {
      meta.createSpan({
        text: `${book.pages} p.`,
        cls: "gr-row-pages"
      });
    }
    if (book.shelf) {
      meta.createSpan({
        text: book.shelf.replace("-", " "),
        cls: `gr-shelf-pill gr-shelf-${book.shelf}`
      });
    }
    const actions = row.createDiv({ cls: "gr-row-actions" });
    const btn = actions.createEl("button", {
      cls: `gr-action-btn ${isSaved ? "gr-btn-open" : "gr-btn-create mod-cta"}`
    });
    const iconSpan = btn.createSpan({ cls: "gr-btn-icon" });
    (0, import_obsidian6.setIcon)(iconSpan, isSaved ? "file-text" : "plus");
    const labelSpan = btn.createSpan({ cls: "gr-btn-label" });
    labelSpan.setText(isSaved ? "Open" : "Save Note");
    const handleClick = async () => {
      try {
        btn.disabled = true;
        const res = await noteService.createOrOpenBookNote(book);
        if (res.alreadyExisted) {
          if (res.highlightsCount > 0) {
            new import_obsidian6.Notice(`Synced ${res.highlightsCount} Kindle highlights to "${book.title}"!`);
          } else {
            new import_obsidian6.Notice(`Opened: "${book.title}"`);
          }
        } else if (res.highlightsCount > 0) {
          new import_obsidian6.Notice(
            `Saved "${book.title}" with ${res.highlightsCount} Kindle highlights!`,
            5e3
          );
        } else {
          new import_obsidian6.Notice(`Created book note: "${book.title}"`);
        }
        this.updateBookListOnly();
      } catch (err) {
        new import_obsidian6.Notice(`Error: ${err.message}`);
        btn.disabled = false;
      }
    };
    btn.addEventListener("click", handleClick);
    titleEl.addEventListener("click", handleClick);
    if (book.link) {
      const link = actions.createEl("a", {
        cls: "gr-link-btn",
        href: book.link,
        title: "View on Goodreads"
      });
      (0, import_obsidian6.setIcon)(link, "external-link");
    }
  }
  /**
   * Fallback aesthetic cover when no book image exists
   */
  renderFallbackCover(container, book) {
    const fallback = container.createDiv({ cls: "gr-cover-fallback" });
    const bookIcon = fallback.createDiv({ cls: "gr-fallback-icon" });
    (0, import_obsidian6.setIcon)(bookIcon, "book");
    fallback.createDiv({ text: book.title, cls: "gr-fallback-title" });
    fallback.createDiv({ text: book.author, cls: "gr-fallback-author" });
  }
  /**
   * Batch imports multiple books into notes
   */
  async batchImportBooks(books) {
    const noteService = new NoteService(this.app, this.plugin.settings);
    const unSavedBooks = books.filter(
      (b) => noteService.findExistingBookNote(b) === null
    );
    if (unSavedBooks.length === 0) {
      new import_obsidian6.Notice("All visible books already have notes created in your vault!");
      return;
    }
    const confirmed = window.confirm(
      `Create notes for ${unSavedBooks.length} book(s) in folder "${this.plugin.settings.folder || "Vault Root"}"?`
    );
    if (!confirmed) return;
    let createdCount = 0;
    const originalSetting = this.plugin.settings.openNoteAfterCreation;
    this.plugin.settings.openNoteAfterCreation = false;
    new import_obsidian6.Notice(`Creating ${unSavedBooks.length} book notes...`);
    try {
      for (const book of unSavedBooks) {
        await noteService.createOrOpenBookNote(book);
        createdCount++;
      }
      new import_obsidian6.Notice(
        `Successfully created ${createdCount} book notes!`,
        5e3
      );
    } catch (err) {
      new import_obsidian6.Notice(`Error during batch import: ${err.message}`);
    } finally {
      this.plugin.settings.openNoteAfterCreation = originalSetting;
      this.updateBookListOnly();
    }
  }
};

// src/bookshelf-modal.ts
var import_obsidian7 = require("obsidian");
var GoodreadsBookSuggestModal = class extends import_obsidian7.SuggestModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.books = [];
    this.isLoading = true;
    this.setPlaceholder("Search your Goodreads books by title, author, or shelf...");
  }
  async onOpen() {
    super.onOpen();
    const userId = this.plugin.settings.userId.trim();
    if (!userId) {
      new import_obsidian7.Notice("Please set your Goodreads User ID in plugin settings first.");
      this.close();
      return;
    }
    try {
      const res = await GoodreadsService.fetchShelf(
        userId,
        this.plugin.settings.defaultShelf || "all",
        this.plugin.settings.maxItems
      );
      this.books = res.books;
      this.isLoading = false;
      this.updateSuggestions();
    } catch (err) {
      new import_obsidian7.Notice(`Failed to load Goodreads books: ${err.message}`);
      this.close();
    }
  }
  getSuggestions(query) {
    if (this.isLoading) {
      return [];
    }
    const q = query.toLowerCase().trim();
    if (!q) {
      return this.books;
    }
    return this.books.filter((b) => {
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchAuthor = b.author.toLowerCase().includes(q);
      const matchShelves = b.userShelves.some((s) => s.toLowerCase().includes(q));
      return matchTitle || matchAuthor || matchShelves;
    });
  }
  renderSuggestion(book, el) {
    const noteService = new NoteService(this.app, this.plugin.settings);
    const existingFile = noteService.findExistingBookNote(book);
    el.addClass("gr-suggest-item");
    const row = el.createDiv({ cls: "gr-suggest-row" });
    if (book.coverUrl) {
      const thumb = row.createDiv({ cls: "gr-suggest-thumb" });
      thumb.createEl("img", {
        attr: { src: book.coverUrl, alt: book.title, loading: "lazy" }
      });
    }
    const content = row.createDiv({ cls: "gr-suggest-content" });
    const titleEl = content.createDiv({ cls: "gr-suggest-title" });
    titleEl.setText(book.title);
    const meta = content.createDiv({ cls: "gr-suggest-meta" });
    meta.createSpan({ text: book.author, cls: "gr-suggest-author" });
    if (book.userRating > 0) {
      meta.createSpan({
        text: ` \u2022 ${noteService.getRatingStars(book.userRating)}`,
        cls: "gr-suggest-stars"
      });
    } else if (book.averageRating > 0) {
      meta.createSpan({
        text: ` \u2022 \u2605 ${book.averageRating}`,
        cls: "gr-suggest-avg"
      });
    }
    if (book.shelf) {
      meta.createSpan({
        text: ` \u2022 ${book.shelf}`,
        cls: "gr-suggest-shelf"
      });
    }
    if (existingFile) {
      const badge = row.createDiv({ cls: "gr-suggest-vault-badge" });
      badge.setText("In Vault");
    }
  }
  async onChooseSuggestion(book, _evt) {
    const noteService = new NoteService(this.app, this.plugin.settings);
    try {
      const res = await noteService.createOrOpenBookNote(book);
      if (res.alreadyExisted) {
        if (res.highlightsCount > 0) {
          new import_obsidian7.Notice(`Synced ${res.highlightsCount} Kindle highlights to "${book.title}"!`);
        } else {
          new import_obsidian7.Notice(`Opened existing note: "${book.title}"`);
        }
      } else if (res.highlightsCount > 0) {
        new import_obsidian7.Notice(
          `Created note for "${book.title}" with ${res.highlightsCount} Kindle highlights!`,
          5e3
        );
      } else {
        new import_obsidian7.Notice(`Created book note: "${book.title}"`);
      }
    } catch (err) {
      new import_obsidian7.Notice(`Error creating note: ${err.message}`);
    }
  }
};

// src/main.ts
var GoodreadsBookshelfPlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(
      VIEW_TYPE_GOODREADS,
      (leaf) => new GoodreadsBookshelfView(leaf, this)
    );
    this.addRibbonIcon("library", "Goodreads Bookshelf", () => {
      this.activateBookshelfView();
    });
    this.addCommand({
      id: "open-goodreads-bookshelf-view",
      name: "Open Goodreads Bookshelf View",
      callback: () => {
        this.activateBookshelfView();
      }
    });
    this.addCommand({
      id: "search-goodreads-books",
      name: "Search Goodreads Books & Create Note",
      callback: () => {
        new GoodreadsBookSuggestModal(this.app, this).open();
      }
    });
    this.addCommand({
      id: "refresh-goodreads-bookshelf",
      name: "Refresh Goodreads Bookshelf",
      callback: async () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_GOODREADS);
        for (const leaf of leaves) {
          if (leaf.view instanceof GoodreadsBookshelfView) {
            await leaf.view.loadBooks();
          }
        }
      }
    });
    this.addCommand({
      id: "sync-highlights-for-active-note",
      name: "Sync Highlights for Active Book Note",
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return false;
        const cache = this.app.metadataCache.getFileCache(activeFile);
        let hasBookId = !!cache?.frontmatter?.goodreads_id;
        if (!hasBookId && this.settings.storageMode === "folder" && activeFile.parent) {
          hasBookId = activeFile.parent.children.some(
            (c) => c instanceof import_obsidian8.TFile && c.extension === "md" && c.path !== activeFile.path && !!this.app.metadataCache.getFileCache(c)?.frontmatter?.goodreads_id
          );
        }
        if (!hasBookId) return false;
        if (!checking) {
          const noteService = new NoteService(this.app, this.settings);
          new import_obsidian8.Notice("Fetching highlights from Goodreads...");
          noteService.syncHighlightsToNote(activeFile).then((count) => {
            if (count > 0) {
              new import_obsidian8.Notice(`Successfully synced ${count} highlights!`, 5e3);
            } else {
              new import_obsidian8.Notice(
                "No highlights found. If your Kindle highlights are private, check the session cookie setting.",
                6e3
              );
            }
          }).catch((err) => {
            new import_obsidian8.Notice(`Error syncing highlights: ${err.message}`, 6e3);
          });
        }
        return true;
      }
    });
    this.addCommand({
      id: "insert-highlight-template",
      name: "Insert Highlight Entry Template",
      editorCallback: (editor) => {
        const noteService = new NoteService(this.app, this.settings);
        const snippet = noteService.getSingleHighlightSnippet();
        const cursor = editor.getCursor();
        editor.replaceRange(snippet, cursor);
        editor.setCursor({ line: cursor.line, ch: cursor.ch + 2 });
      }
    });
    this.addCommand({
      id: "insert-vocabulary-template",
      name: "Insert Vocabulary Entry Template",
      editorCallback: (editor) => {
        const noteService = new NoteService(this.app, this.settings);
        const snippet = noteService.getSingleVocabularySnippet();
        const cursor = editor.getCursor();
        editor.replaceRange(snippet, cursor);
        const h = noteService.getHeadingPrefix(
          this.settings.vocabularyHeadingLevel || "h3"
        );
        const wordStart = cursor.ch + h.length + 1;
        editor.setSelection(
          { line: cursor.line, ch: wordStart },
          { line: cursor.line, ch: wordStart + 4 }
        );
      }
    });
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor) => {
        if (!this.settings.enableSnippetTriggers) return;
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);
        const textBeforeCursor = lineText.slice(0, cursor.ch);
        const hlTrigger = (this.settings.highlightSnippetTrigger || "/highlight").trim();
        const vocabTrigger = (this.settings.vocabularySnippetTrigger || "/vocab").trim();
        if (hlTrigger && textBeforeCursor.endsWith(hlTrigger)) {
          const startCh = cursor.ch - hlTrigger.length;
          const noteService = new NoteService(this.app, this.settings);
          const snippet = noteService.getSingleHighlightSnippet();
          editor.replaceRange(
            snippet,
            { line: cursor.line, ch: startCh },
            cursor
          );
          editor.setCursor({ line: cursor.line, ch: startCh + 2 });
        } else {
          let matchedVocabTrigger = "";
          if (vocabTrigger && textBeforeCursor.endsWith(vocabTrigger)) {
            matchedVocabTrigger = vocabTrigger;
          } else if (textBeforeCursor.endsWith("/note")) {
            matchedVocabTrigger = "/note";
          } else if (textBeforeCursor.endsWith("/vocab")) {
            matchedVocabTrigger = "/vocab";
          }
          if (matchedVocabTrigger) {
            const startCh = cursor.ch - matchedVocabTrigger.length;
            const noteService = new NoteService(this.app, this.settings);
            const snippet = noteService.getSingleVocabularySnippet();
            editor.replaceRange(
              snippet,
              { line: cursor.line, ch: startCh },
              cursor
            );
            const h = noteService.getHeadingPrefix(
              this.settings.vocabularyHeadingLevel || "h3"
            );
            const wordStart = startCh + h.length + 1;
            editor.setSelection(
              { line: cursor.line, ch: wordStart },
              { line: cursor.line, ch: wordStart + 4 }
            );
          }
        }
      })
    );
    this.addSettingTab(new GoodreadsSettingTab(this.app, this));
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_GOODREADS);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.properties || !Array.isArray(this.settings.properties) || this.settings.properties.length === 0) {
      this.settings.properties = JSON.parse(JSON.stringify(DEFAULT_PROPERTIES));
    } else {
      const hasFieldProp = this.settings.properties.some(
        (p) => p.field === "field" || p.field === "genres"
      );
      if (!hasFieldProp) {
        const shelfIdx = this.settings.properties.findIndex(
          (p) => p.field === "shelf"
        );
        const newProp = {
          id: "prop-field",
          key: "field",
          field: "field",
          enabled: true
        };
        if (shelfIdx >= 0) {
          this.settings.properties.splice(shelfIdx + 1, 0, newProp);
        } else {
          this.settings.properties.push(newProp);
        }
      }
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /**
   * Activates or opens the Goodreads Bookshelf view in the workspace
   */
  async activateBookshelfView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_GOODREADS)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({
        type: VIEW_TYPE_GOODREADS,
        active: true
      });
    }
    workspace.revealLeaf(leaf);
  }
};
