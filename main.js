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
var import_obsidian7 = require("obsidian");

// src/types.ts
var DEFAULT_PROPERTIES = [
  { id: "prop-title", key: "title", field: "title", enabled: true },
  { id: "prop-author", key: "author", field: "author", enabled: true },
  { id: "prop-goodreads_id", key: "goodreads_id", field: "goodreads_id", enabled: true },
  { id: "prop-shelf", key: "shelf", field: "shelf", enabled: true },
  { id: "prop-isbn", key: "isbn", field: "isbn", enabled: true },
  { id: "prop-rating", key: "rating", field: "rating", enabled: true },
  { id: "prop-rating_stars", key: "rating_stars", field: "rating_stars", enabled: true },
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
  properties: DEFAULT_PROPERTIES
};

// src/settings.ts
var import_obsidian3 = require("obsidian");

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

// src/goodreads-service.ts
var import_obsidian2 = require("obsidian");
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
        const response = await (0, import_obsidian2.requestUrl)({
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
    if (!cleanUserId || !bookId) return [];
    const url = `https://www.goodreads.com/notes/${encodeURIComponent(bookId)}/${encodeURIComponent(cleanUserId)}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ObsidianGoodreadsBookshelf/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };
    if (cookie && cookie.trim()) {
      const cleanCookie = cookie.trim().startsWith("_session_id2=") ? cookie.trim() : `_session_id2=${cookie.trim()}`;
      headers["Cookie"] = cleanCookie;
    }
    try {
      const response = await (0, import_obsidian2.requestUrl)({
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
      const highlights = [];
      for (const el of noteEls) {
        const id = el.getAttribute("data-reading-note-id") || "";
        const isSpoiler = el.getAttribute("data-is-spoiler") === "true";
        const locEl = el.querySelector(".noteHighlightContainer__location a") || el.querySelector(".noteHighlightContainer__location");
        const location = locEl?.textContent?.trim() || "";
        const textEl = el.querySelector(".noteHighlightTextContainer__highlightText span") || el.querySelector(".noteHighlightTextContainer__highlightText");
        const text = this.cleanText(textEl?.textContent || "");
        const userNoteEl = el.querySelector(".noteHighlightTextContainer__noteContainer") || el.querySelector(".noteText");
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
      const bookId = getTagText("book_id") || item.querySelector("book")?.getAttribute("id") || getTagText("guid") || "";
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
var GoodreadsSettingTab = class extends import_obsidian3.PluginSettingTab {
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
      (0, import_obsidian3.setIcon)(iconSpan, tab.icon);
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
    new import_obsidian3.Setting(container).setName("Goodreads User ID or Profile URL").setDesc(
      "Enter your numeric Goodreads User ID or paste your full profile URL (e.g. https://www.goodreads.com/user/show/12345678-john-doe). Your profile must be public."
    ).addText(
      (text) => text.setPlaceholder("e.g. 12345678 or profile URL").setValue(this.plugin.settings.userId).onChange(async (value) => {
        const cleanId = GoodreadsService.extractUserId(value);
        this.plugin.settings.userId = cleanId;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Verify Goodreads Connection").setDesc("Test whether your Goodreads bookshelf RSS feed is accessible.").addButton(
      (btn) => btn.setButtonText("Test Connection").setCta().onClick(async () => {
        const userId = this.plugin.settings.userId.trim();
        if (!userId) {
          new import_obsidian3.Notice("Please enter a Goodreads User ID first.");
          return;
        }
        btn.setButtonText("Testing...");
        btn.setDisabled(true);
        try {
          const res = await GoodreadsService.fetchShelf(userId, "all", 10);
          new import_obsidian3.Notice(
            `Success! Connected to "${res.shelfTitle}". Found books!`,
            5e3
          );
        } catch (err) {
          new import_obsidian3.Notice(`Connection failed: ${err.message}`, 6e3);
        } finally {
          btn.setButtonText("Test Connection");
          btn.setDisabled(false);
        }
      })
    );
    container.createEl("h3", { text: "Note Storage & Naming" });
    new import_obsidian3.Setting(container).setName("Save Folder").setDesc(
      "Vault folder where book notes will be saved. Will be created automatically if missing."
    ).addText((text) => {
      text.setPlaceholder("e.g. Books or Reading/Goodreads").setValue(this.plugin.settings.folder).onChange(async (val) => {
        this.plugin.settings.folder = val.trim();
        await this.plugin.saveSettings();
      });
      new FolderSuggest(this.app, text.inputEl);
    });
    new import_obsidian3.Setting(container).setName("Note Title Format").setDesc("Choose how note file names should be constructed.").addDropdown(
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
    new import_obsidian3.Setting(container).setName("Default Tag").setDesc("Base tag added to the frontmatter tags list (without #).").addText(
      (text) => text.setPlaceholder("e.g. book").setValue(this.plugin.settings.tagPrefix).onChange(async (val) => {
        this.plugin.settings.tagPrefix = val.trim();
        await this.plugin.saveSettings();
      })
    );
    container.createEl("h3", { text: "Editor Behavior" });
    new import_obsidian3.Setting(container).setName("Open Note After Creation").setDesc("Automatically open the book note in editor after creation.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.openNoteAfterCreation).onChange(async (val) => {
        this.plugin.settings.openNoteAfterCreation = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Open Location").setDesc("Where to open newly created or selected book notes.").addDropdown(
      (dd) => dd.addOption("new-tab", "New Tab").addOption("active", "Active Tab").addOption("split", "Split Pane (Right)").setValue(this.plugin.settings.openLocation).onChange(async (val) => {
        this.plugin.settings.openLocation = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Overwrite Existing Notes").setDesc(
      "If disabled (recommended), clicking an already saved book will simply open the existing note. If enabled, it will overwrite the note with freshly synced Goodreads data."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.overwriteExisting).onChange(async (val) => {
        this.plugin.settings.overwriteExisting = val;
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
      (0, import_obsidian3.setIcon)(delBtn, "trash-2");
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
      placeholder: "Property key (e.g. my_shelf)",
      value: "shelf"
    });
    selectField.addEventListener("change", () => {
      newKeyInput.value = selectField.value;
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
      new import_obsidian3.Notice(`Added property "${key}"`);
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
        new import_obsidian3.Notice("Properties reset to defaults");
        this.display();
      }
    });
  }
  // ================= CONTENT TAB =================
  renderContentTab(container) {
    container.createEl("h3", { text: "Note Content & Sections" });
    new import_obsidian3.Setting(container).setName("Embed Book Cover in Note Body").setDesc(
      "Embed the book cover image inside the note body. When disabled, the cover image URL will still be kept in your frontmatter properties."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeCover).onChange(async (val) => {
        this.plugin.settings.includeCover = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Include Book Synopsis").setDesc("Include Goodreads book description in the generated note.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeDescription).onChange(async (val) => {
        this.plugin.settings.includeDescription = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Include Personal Review & Rating").setDesc(
      "Include your personal Goodreads star rating and written review in the generated note."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeReview).onChange(async (val) => {
        this.plugin.settings.includeReview = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Include Reading Note Sections").setDesc(
      "Adds blank reflection headings for 'Key Takeaways', 'Memorable Quotes', and 'Personal Notes'. Recommended OFF if you prefer clean notes or already extract Kindle highlights."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeReadingSections).onChange(async (val) => {
        this.plugin.settings.includeReadingSections = val;
        await this.plugin.saveSettings();
      })
    );
    container.createEl("h3", { text: "Kindle Notes & Highlights" });
    new import_obsidian3.Setting(container).setName("Extract Kindle Notes & Highlights").setDesc(
      "Automatically extract your synced Kindle highlights, locations, and personal annotations from Goodreads."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeHighlights).onChange(async (val) => {
        this.plugin.settings.includeHighlights = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Goodreads Session Cookie (Optional)").setDesc(
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
    new import_obsidian3.Setting(container).setName("Default Shelf").setDesc("Which shelf to load initially when opening the Bookshelf view.").addDropdown(
      (dd) => dd.addOption("all", "All Books").addOption("currently-reading", "Currently Reading").addOption("read", "Read").addOption("to-read", "Want to Read").setValue(this.plugin.settings.defaultShelf).onChange(async (val) => {
        this.plugin.settings.defaultShelf = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Custom Shelves").setDesc(
      "Additional Goodreads shelf names to display as tabs (comma-separated, e.g. favorites, sci-fi, biography)."
    ).addText(
      (text) => text.setPlaceholder("e.g. favorites, non-fiction").setValue(this.plugin.settings.customShelves.join(", ")).onChange(async (val) => {
        this.plugin.settings.customShelves = val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(container).setName("Maximum Books to Fetch").setDesc("Limit the number of books retrieved per shelf.").addDropdown(
      (dd) => dd.addOption("50", "50 books").addOption("100", "100 books").addOption("200", "200 books").addOption("300", "300 books").setValue(String(this.plugin.settings.maxItems)).onChange(async (val) => {
        this.plugin.settings.maxItems = parseInt(val, 10) || 100;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/bookshelf-view.ts
var import_obsidian5 = require("obsidian");

// src/note-service.ts
var import_obsidian4 = require("obsidian");
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
   * Generates target note file path based on settings
   */
  getNoteFilePath(book) {
    const mainTitle = this.getMainTitle(book.title);
    let baseName = mainTitle;
    if (this.settings.noteTitleFormat === "title-author") {
      baseName = `${mainTitle} - ${book.author}`;
    } else if (this.settings.noteTitleFormat === "author-title") {
      baseName = `${book.author} - ${mainTitle}`;
    }
    const safeName = this.sanitizeFileName(baseName) || `Book-${book.bookId}`;
    const folder = this.settings.folder.trim();
    if (!folder) {
      return `${safeName}.md`;
    }
    return (0, import_obsidian4.normalizePath)(`${folder}/${safeName}.md`);
  }
  /**
   * Checks if a note for this book already exists in vault
   */
  findExistingBookNote(book) {
    const expectedPath = this.getNoteFilePath(book);
    const fileByPath = this.app.vault.getAbstractFileByPath(expectedPath);
    if (fileByPath instanceof import_obsidian4.TFile) {
      return fileByPath;
    }
    const targetFolder = this.settings.folder.trim();
    const files = this.app.vault.getMarkdownFiles();
    const cleanMainTitle = this.sanitizeFileName(
      this.getMainTitle(book.title)
    ).toLowerCase();
    const cleanFullTitle = this.sanitizeFileName(book.title).toLowerCase();
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
      if (fileBase === cleanMainTitle || fileBase === cleanFullTitle) {
        return file;
      }
    }
    return null;
  }
  /**
   * Formats a list of highlights into markdown
   */
  formatHighlightsMarkdown(highlights) {
    if (highlights.length === 0) return "";
    const lines = ["## Highlights & Annotations", ""];
    for (const h of highlights) {
      if (h.text) {
        const quoteLines = h.text.split("\n");
        for (const line of quoteLines) {
          lines.push(`> ${line}`);
        }
        if (h.location) {
          lines.push(`> \u2014 *Location: ${h.location}*`);
        }
      }
      if (h.note) {
        lines.push(`> **Note:** ${h.note}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  /**
   * Generates formatted Markdown content for book note
   */
  generateNoteContent(book, highlights = []) {
    const starString = this.getRatingStars(book.userRating);
    const tags = [];
    if (this.settings.tagPrefix) {
      tags.push(this.settings.tagPrefix.replace(/^#/, ""));
    }
    if (book.shelf) {
      tags.push(book.shelf.toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
    }
    for (const s of book.userShelves) {
      const cleanTag = s.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      if (cleanTag && !tags.includes(cleanTag)) {
        tags.push(cleanTag);
      }
    }
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
    frontmatterLines.push("");
    const bodyLines = [];
    if (this.settings.includeCover && (book.largeCoverUrl || book.coverUrl)) {
      const coverUrl = book.largeCoverUrl || book.coverUrl;
      bodyLines.push(`![Book Cover|240](${coverUrl})`);
      bodyLines.push("");
    }
    if (this.settings.includeDescription && book.description) {
      bodyLines.push("## Synopsis");
      bodyLines.push(book.description);
      bodyLines.push("");
    }
    if (this.settings.includeReview && (book.userReview || book.userRating > 0)) {
      bodyLines.push("## My Review");
      if (book.userRating > 0) {
        bodyLines.push(`**Rating:** ${starString} (${book.userRating}/5)`);
        bodyLines.push("");
      }
      if (book.userReview) {
        bodyLines.push(book.userReview);
        bodyLines.push("");
      }
    }
    if (this.settings.includeHighlights && highlights.length > 0) {
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
    return [...frontmatterLines, ...bodyLines].join("\n");
  }
  /**
   * Ensures parent directory exists in vault
   */
  async ensureFolderExists(folderPath) {
    const cleanPath = (0, import_obsidian4.normalizePath)(folderPath.trim());
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
      } else if (!(file instanceof import_obsidian4.TFolder)) {
        throw new Error(`Path conflict: "${currentPath}" exists but is not a folder.`);
      }
    }
  }
  /**
   * Creates or opens note instantly, with non-blocking background highlight sync
   */
  async createOrOpenBookNote(book) {
    const existingFile = this.findExistingBookNote(book);
    if (existingFile && !this.settings.overwriteExisting) {
      if (this.settings.openNoteAfterCreation) {
        await this.openFile(existingFile);
      }
      return { file: existingFile, alreadyExisted: true, highlightsCount: 0 };
    }
    if (this.settings.folder.trim()) {
      await this.ensureFolderExists(this.settings.folder);
    }
    const notePath = this.getNoteFilePath(book);
    const content = this.generateNoteContent(book, []);
    let targetFile;
    if (existingFile && this.settings.overwriteExisting) {
      await this.app.vault.modify(existingFile, content);
      targetFile = existingFile;
    } else {
      targetFile = await this.app.vault.create(notePath, content);
    }
    if (this.settings.openNoteAfterCreation) {
      await this.openFile(targetFile);
    }
    if (this.settings.includeHighlights) {
      this.syncHighlightsInBackground(targetFile, book);
    }
    return {
      file: targetFile,
      alreadyExisted: false,
      highlightsCount: 0
    };
  }
  /**
   * Asynchronously fetches highlights in background and appends them to the note
   */
  syncHighlightsInBackground(file, book) {
    GoodreadsService.fetchBookHighlights(
      this.settings.userId,
      book.bookId,
      this.settings.goodreadsCookie
    ).then(async (highlights) => {
      if (highlights && highlights.length > 0) {
        await this.syncHighlightsToNote(file, highlights);
        new import_obsidian4.Notice(
          `Synced ${highlights.length} Kindle highlights for "${book.title}"!`,
          4e3
        );
      }
    }).catch(() => {
    });
  }
  /**
   * Syncs highlights into an already existing active book note
   */
  async syncHighlightsToNote(file, cachedHighlights) {
    const cache = this.app.metadataCache.getFileCache(file);
    const bookId = cache?.frontmatter?.goodreads_id;
    if (!bookId) {
      throw new Error(
        "Current file does not have a 'goodreads_id' in its frontmatter."
      );
    }
    const highlights = cachedHighlights || await GoodreadsService.fetchBookHighlights(
      this.settings.userId,
      String(bookId),
      this.settings.goodreadsCookie
    );
    if (highlights.length === 0) {
      return 0;
    }
    const highlightsMd = this.formatHighlightsMarkdown(highlights);
    const currentContent = await this.app.vault.read(file);
    const sectionRegex = /## Highlights & Annotations[\s\S]*?(?=\n## |$)/;
    let newContent;
    if (sectionRegex.test(currentContent)) {
      newContent = currentContent.replace(sectionRegex, highlightsMd.trim());
    } else {
      newContent = currentContent.trimEnd() + "\n\n" + highlightsMd;
    }
    await this.app.vault.modify(file, newContent);
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
var GoodreadsBookshelfView = class extends import_obsidian5.ItemView {
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
      new import_obsidian5.Notice(`Loaded ${this.books.length} books from Goodreads`);
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
    (0, import_obsidian5.setIcon)(iconSpan, "library");
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
    (0, import_obsidian5.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.loadBooks());
    const settingsBtn = actions.createEl("button", {
      cls: "gr-icon-btn",
      title: "Open Plugin Settings"
    });
    (0, import_obsidian5.setIcon)(settingsBtn, "settings");
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
    (0, import_obsidian5.setIcon)(iconEl, "book-open");
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
    (0, import_obsidian5.setIcon)(spinner, "loader-2");
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
    (0, import_obsidian5.setIcon)(iconEl, "alert-circle");
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
    (0, import_obsidian5.setIcon)(searchIcon, "search");
    const input = searchContainer.createEl("input", {
      type: "text",
      placeholder: "Search by title, author, or shelf tags...",
      value: this.searchQuery
    });
    const clearBtn = searchContainer.createEl("button", {
      cls: `gr-search-clear-btn ${this.searchQuery ? "is-visible" : ""}`,
      title: "Clear search"
    });
    (0, import_obsidian5.setIcon)(clearBtn, "x");
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
    (0, import_obsidian5.setIcon)(gridBtn, "layout-grid");
    gridBtn.addEventListener("click", () => {
      this.viewMode = "grid";
      this.updateToolbarAndList();
    });
    const listBtn = viewToggle.createEl("button", {
      cls: `gr-view-btn ${this.viewMode === "list" ? "is-active" : ""}`,
      title: "List View"
    });
    (0, import_obsidian5.setIcon)(listBtn, "list");
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
      (0, import_obsidian5.setIcon)(batchBtn.createSpan({ cls: "gr-batch-icon" }), "download");
      batchBtn.addEventListener("click", () => this.batchImportBooks(filtered));
    }
    if (filtered.length === 0) {
      const emptyMsg = container.createDiv({
        cls: "gr-books-view gr-no-results"
      });
      const icon = emptyMsg.createDiv({ cls: "gr-empty-icon" });
      (0, import_obsidian5.setIcon)(icon, "search-x");
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
      (0, import_obsidian5.setIcon)(savedBadge, "check");
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
    (0, import_obsidian5.setIcon)(iconSpan, isSaved ? "file-text" : "plus");
    const labelSpan = primaryBtn.createSpan({ cls: "gr-btn-label" });
    labelSpan.setText(isSaved ? "Open Note" : "Create Note");
    const handleBookClick = async () => {
      try {
        primaryBtn.disabled = true;
        labelSpan.setText("Working...");
        const res = await noteService.createOrOpenBookNote(book);
        if (res.alreadyExisted) {
          new import_obsidian5.Notice(`Opened existing note: "${book.title}"`);
        } else {
          new import_obsidian5.Notice(`Created book note: "${book.title}"`);
        }
        this.updateBookListOnly();
      } catch (err) {
        new import_obsidian5.Notice(`Error: ${err.message}`);
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
      (0, import_obsidian5.setIcon)(linkBtn, "external-link");
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
      (0, import_obsidian5.setIcon)(placeholder, "book");
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
    (0, import_obsidian5.setIcon)(iconSpan, isSaved ? "file-text" : "plus");
    const labelSpan = btn.createSpan({ cls: "gr-btn-label" });
    labelSpan.setText(isSaved ? "Open" : "Save Note");
    const handleClick = async () => {
      try {
        btn.disabled = true;
        const res = await noteService.createOrOpenBookNote(book);
        if (res.alreadyExisted) {
          new import_obsidian5.Notice(`Opened: "${book.title}"`);
        } else {
          new import_obsidian5.Notice(`Created book note: "${book.title}"`);
        }
        this.updateBookListOnly();
      } catch (err) {
        new import_obsidian5.Notice(`Error: ${err.message}`);
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
      (0, import_obsidian5.setIcon)(link, "external-link");
    }
  }
  /**
   * Fallback aesthetic cover when no book image exists
   */
  renderFallbackCover(container, book) {
    const fallback = container.createDiv({ cls: "gr-cover-fallback" });
    const bookIcon = fallback.createDiv({ cls: "gr-fallback-icon" });
    (0, import_obsidian5.setIcon)(bookIcon, "book");
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
      new import_obsidian5.Notice("All visible books already have notes created in your vault!");
      return;
    }
    const confirmed = window.confirm(
      `Create notes for ${unSavedBooks.length} book(s) in folder "${this.plugin.settings.folder || "Vault Root"}"?`
    );
    if (!confirmed) return;
    let createdCount = 0;
    const originalSetting = this.plugin.settings.openNoteAfterCreation;
    this.plugin.settings.openNoteAfterCreation = false;
    new import_obsidian5.Notice(`Creating ${unSavedBooks.length} book notes...`);
    try {
      for (const book of unSavedBooks) {
        await noteService.createOrOpenBookNote(book);
        createdCount++;
      }
      new import_obsidian5.Notice(
        `Successfully created ${createdCount} book notes!`,
        5e3
      );
    } catch (err) {
      new import_obsidian5.Notice(`Error during batch import: ${err.message}`);
    } finally {
      this.plugin.settings.openNoteAfterCreation = originalSetting;
      this.updateBookListOnly();
    }
  }
};

// src/bookshelf-modal.ts
var import_obsidian6 = require("obsidian");
var GoodreadsBookSuggestModal = class extends import_obsidian6.SuggestModal {
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
      new import_obsidian6.Notice("Please set your Goodreads User ID in plugin settings first.");
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
      new import_obsidian6.Notice(`Failed to load Goodreads books: ${err.message}`);
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
        new import_obsidian6.Notice(`Opened existing note: "${book.title}"`);
      } else {
        new import_obsidian6.Notice(`Created book note: "${book.title}"`);
      }
    } catch (err) {
      new import_obsidian6.Notice(`Error creating note: ${err.message}`);
    }
  }
};

// src/main.ts
var GoodreadsBookshelfPlugin = class extends import_obsidian7.Plugin {
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
        if (!cache?.frontmatter?.goodreads_id) return false;
        if (!checking) {
          const noteService = new NoteService(this.app, this.settings);
          new import_obsidian7.Notice("Fetching highlights from Goodreads...");
          noteService.syncHighlightsToNote(activeFile).then((count) => {
            if (count > 0) {
              new import_obsidian7.Notice(`Successfully synced ${count} highlights!`, 5e3);
            } else {
              new import_obsidian7.Notice(
                "No highlights found. If your Kindle highlights are private, check the session cookie setting.",
                6e3
              );
            }
          }).catch((err) => {
            new import_obsidian7.Notice(`Error syncing highlights: ${err.message}`, 6e3);
          });
        }
        return true;
      }
    });
    this.addSettingTab(new GoodreadsSettingTab(this.app, this));
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_GOODREADS);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.properties || !Array.isArray(this.settings.properties) || this.settings.properties.length === 0) {
      this.settings.properties = JSON.parse(JSON.stringify(DEFAULT_PROPERTIES));
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
