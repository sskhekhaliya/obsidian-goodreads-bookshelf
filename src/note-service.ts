import { App, normalizePath, Notice, TFile, TFolder } from "obsidian";
import {
  GoodreadsBook,
  GoodreadsHighlight,
  GoodreadsPluginSettings,
  DEFAULT_PROPERTIES,
  HeadingLevel
} from "./types";
import { GoodreadsService } from "./goodreads-service";

export interface NoteCreationResult {
  file: TFile;
  alreadyExisted: boolean;
  highlightsCount: number;
}

export class NoteService {
  constructor(private app: App, private settings: GoodreadsPluginSettings) {}

  /**
   * Sanitizes a string for use as a file name in Obsidian
   */
  public sanitizeFileName(name: string): string {
    return name
      .replace(/[\\/:*?"<>|#^[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Formats star representation of rating
   */
  public getRatingStars(rating: number): string {
    if (rating <= 0) return "";
    return "★".repeat(Math.min(rating, 5)) + "☆".repeat(Math.max(0, 5 - rating));
  }

  /**
   * Extracts clean main book title (excluding lengthy subtitles) for file naming
   */
  public getMainTitle(fullTitle: string): string {
    if (!fullTitle) return "";
    let main = fullTitle;

    // 1. Split by colon ':' (standard book subtitle separator)
    if (main.includes(":")) {
      const parts = main.split(":");
      if (parts[0] && parts[0].trim().length > 0) {
        main = parts[0].trim();
      }
    }

    // 2. Split by em-dash '—' or spaced hyphen ' - ' if used as subtitle delimiter
    if (main.includes(" — ")) {
      const parts = main.split(" — ");
      if (parts[0] && parts[0].trim().length > 0) {
        main = parts[0].trim();
      }
    }

    // 3. Remove trailing format/edition parentheses like "(A Novel)", "(Kindle Edition)"
    main = main
      .replace(
        /\s*\((?:a\s+novel|special\s+edition|revised\s+edition|expanded\s+edition|kindle\s+edition|annotated|paperback|hardcover)\)$/i,
        ""
      )
      .trim();

    return main || fullTitle.trim();
  }

  /**
   * Returns base book folder or note name (sanitized)
   */
  public getBookFolderName(book: GoodreadsBook): string {
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
  public getBookFolderPath(book: GoodreadsBook): string {
    const folderName = this.getBookFolderName(book);
    const parentFolder = this.settings.folder.trim();
    if (!parentFolder) {
      return folderName;
    }
    return normalizePath(`${parentFolder}/${folderName}`);
  }

  /**
   * Generates target note file path based on settings (single note vs folder per book)
   */
  public getNoteFilePath(book: GoodreadsBook): string {
    const safeName = this.getBookFolderName(book);
    const folder = this.settings.folder.trim();

    if (this.settings.storageMode === "folder") {
      if (!folder) {
        return normalizePath(`${safeName}/${safeName}.md`);
      }
      return normalizePath(`${folder}/${safeName}/${safeName}.md`);
    }

    if (!folder) {
      return `${safeName}.md`;
    }

    return normalizePath(`${folder}/${safeName}.md`);
  }

  /**
   * Checks if a note for this book already exists in vault (supports single and folder mode)
   */
  public findExistingBookNote(book: GoodreadsBook): TFile | null {
    const expectedPath = this.getNoteFilePath(book);
    const fileByPath = this.app.vault.getAbstractFileByPath(expectedPath);
    if (fileByPath instanceof TFile) {
      return fileByPath;
    }

    // Check alternative storage mode path
    const safeName = this.getBookFolderName(book);
    const folder = this.settings.folder.trim();
    const altPath =
      this.settings.storageMode === "folder"
        ? (folder ? normalizePath(`${folder}/${safeName}.md`) : `${safeName}.md`)
        : (folder
            ? normalizePath(`${folder}/${safeName}/${safeName}.md`)
            : normalizePath(`${safeName}/${safeName}.md`));

    const altFile = this.app.vault.getAbstractFileByPath(altPath);
    if (altFile instanceof TFile) {
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
      if (
        fileBase === cleanMainTitle ||
        fileBase === cleanFullTitle ||
        fileBase === cleanSafeName
      ) {
        return file;
      }
    }

    return null;
  }

  /**
   * Helper to resolve heading markdown prefix from HeadingLevel
   */
  public getHeadingPrefix(level: HeadingLevel): string {
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
  public formatHighlightsMarkdown(
    highlights: GoodreadsHighlight[]
  ): string {
    if (highlights.length === 0) return "";

    const entries: string[] = [];

    for (const h of highlights) {
      const lines: string[] = [];

      if (h.text) {
        const quoteLines = h.text.replace(/\r\n/g, "\n").split("\n");
        for (const line of quoteLines) {
          lines.push(`> ${line}`);
        }
      } else {
        lines.push("> ");
      }

      if (h.location) {
        lines.push(`> — *Location: ${h.location}*`);
      } else {
        lines.push(`> — *Location: *`);
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
  public async readVaultFile(filePath: string): Promise<string | null> {
    if (!filePath || !filePath.trim()) return null;
    const cleanPath = normalizePath(filePath.trim());
    const file = this.app.vault.getAbstractFileByPath(cleanPath);
    if (file instanceof TFile) {
      return await this.app.vault.read(file);
    }
    return null;
  }

  /**
   * Returns today's date in YYYY-MM-DD
   */
  public getTodayDate(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Generates a single blank highlight entry snippet (for shortcuts and manual entry)
   */
  public getSingleHighlightSnippet(): string {
    return [
      "> ",
      "> — *Location: *",
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
  public getSingleVocabularySnippet(): string {
    const h = this.getHeadingPrefix(
      this.settings.vocabularyHeadingLevel || "h3"
    );
    return [
      `${h} Word`,
      "- **Definition**: ",
      '- **Source Context**: ""',
      "- **My Examples**:",
      "  1. "
    ].join("\n");
  }

  /**
   * Generates content for standalone Highlights & Notes.md file
   */
  public async generateHighlightsNoteContent(
    book: GoodreadsBook,
    highlights: GoodreadsHighlight[] = []
  ): Promise<string> {
    const bookFolderPath = this.getBookFolderPath(book);
    const mainTitle = this.getMainTitle(book.title);
    const safeName = this.getBookFolderName(book);
    const mainLink = `${bookFolderPath}/${safeName}`;
    const today = this.getTodayDate();

    // Check if user set a template file from vault, or custom template string
    let rawTemplate: string | null = null;
    if (this.settings.highlightsTemplatePath) {
      rawTemplate = await this.readVaultFile(
        this.settings.highlightsTemplatePath
      );
    }
    if (
      !rawTemplate &&
      this.settings.customHighlightsTemplate &&
      this.settings.customHighlightsTemplate.trim()
    ) {
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

      let body: string;
      if (highlights.length > 0) {
        body = this.formatHighlightsMarkdown(highlights);
      } else {
        body = this.getSingleHighlightSnippet();
      }

      return frontmatter + body + "\n";
    }

    // Process custom template with variables
    let processed = rawTemplate
      .replace(/\{\{title\}\}/gi, mainTitle)
      .replace(/\{\{author\}\}/gi, book.author)
      .replace(/\{\{book_link\}\}/gi, `[[${mainLink}|${mainTitle}]]`)
      .replace(/\{\{date\}\}/gi, today)
      .replace(/\{\{shelf\}\}/gi, book.shelf || "read");

    // Check if template contains a single highlight block pattern or {{highlights}}
    const singlePatternMatch =
      processed.match(/((?:^[ \t]*>[ \t]*.*(?:\r?\n|$))+[\s\S]*?---)/m) ||
      processed.match(/((?:^[ \t]*>[ \t]*.*(?:\r?\n|$))+)/m);
    const pattern =
      singlePatternMatch && singlePatternMatch[0].includes("{{highlight}}")
        ? singlePatternMatch[0].trim()
        : [
            "> {{highlight}}",
            "> — *Location: {{location}}*",
            "",
            "**Note:** ",
            "{{note}}",
            "",
            "---"
          ].join("\n");

    const formatSingleHighlight = (h?: GoodreadsHighlight): string => {
      const quote = h?.text || "";
      const loc = h?.location || "";
      const note = h?.note || "";

      return pattern
        .replace(/\{\{highlight\}\}/gi, quote)
        .replace(/\{\{location\}\}/gi, loc)
        .replace(/\{\{note\}\}/gi, note);
    };

    let renderedHighlights = "";
    if (highlights.length > 0) {
      renderedHighlights = highlights
        .map((h) => formatSingleHighlight(h))
        .join("\n\n");
    } else {
      renderedHighlights = formatSingleHighlight();
    }

    if (processed.includes("{{highlights}}")) {
      processed = processed.replace(/\{\{highlights\}\}/gi, renderedHighlights);
    } else if (
      singlePatternMatch &&
      singlePatternMatch[0].includes("{{highlight}}")
    ) {
      processed = processed.replace(singlePatternMatch[0], renderedHighlights);
    } else {
      processed = processed.trimEnd() + "\n\n" + renderedHighlights;
    }

    return processed;
  }

  /**
   * Generates content for standalone My Thoughts.md file
   */
  public async generateMyThoughtsContent(
    book: GoodreadsBook
  ): Promise<string> {
    const bookFolderPath = this.getBookFolderPath(book);
    const mainTitle = this.getMainTitle(book.title);
    const safeName = this.getBookFolderName(book);
    const mainLink = `${bookFolderPath}/${safeName}`;
    const today = this.getTodayDate();

    let rawTemplate: string | null = null;
    if (this.settings.thoughtsTemplatePath) {
      rawTemplate = await this.readVaultFile(
        this.settings.thoughtsTemplatePath
      );
    }
    if (
      !rawTemplate &&
      this.settings.customThoughtsTemplate &&
      this.settings.customThoughtsTemplate.trim()
    ) {
      rawTemplate = this.settings.customThoughtsTemplate;
    }

    if (rawTemplate) {
      return rawTemplate
        .replace(/\{\{title\}\}/gi, mainTitle)
        .replace(/\{\{author\}\}/gi, book.author)
        .replace(/\{\{book_link\}\}/gi, `[[${mainLink}|${mainTitle}]]`)
        .replace(/\{\{date\}\}/gi, today)
        .replace(/\{\{shelf\}\}/gi, book.shelf || "read");
    }

    return [
      "---",
      `book: "[[${mainLink}|${mainTitle}]]"`,
      "type: thoughts",
      "tags:",
      "  - book/thoughts",
      "---",
      "## 💡 Key Takeaways & Core Ideas",
      "- ",
      "",
      "## 🧠 Personal Reflections & Interpretations",
      "- ",
      "",
      "## ❓ Questions & Insights",
      "- ",
      ""
    ].join("\n");
  }

  /**
   * Generates content for standalone Vocabulary.md file
   */
  public async generateVocabularyContent(
    book: GoodreadsBook
  ): Promise<string> {
    const bookFolderPath = this.getBookFolderPath(book);
    const mainTitle = this.getMainTitle(book.title);
    const safeName = this.getBookFolderName(book);
    const mainLink = `${bookFolderPath}/${safeName}`;
    const today = this.getTodayDate();
    const h = this.getHeadingPrefix(
      this.settings.vocabularyHeadingLevel || "h3"
    );

    let rawTemplate: string | null = null;
    if (this.settings.vocabularyTemplatePath) {
      rawTemplate = await this.readVaultFile(
        this.settings.vocabularyTemplatePath
      );
    }
    if (
      !rawTemplate &&
      this.settings.customVocabularyTemplate &&
      this.settings.customVocabularyTemplate.trim()
    ) {
      rawTemplate = this.settings.customVocabularyTemplate;
    }

    if (rawTemplate) {
      return rawTemplate
        .replace(/\{\{title\}\}/gi, mainTitle)
        .replace(/\{\{author\}\}/gi, book.author)
        .replace(/\{\{book_link\}\}/gi, `[[${mainLink}|${mainTitle}]]`)
        .replace(/\{\{date\}\}/gi, today)
        .replace(/\{\{shelf\}\}/gi, book.shelf || "read")
        .replace(/\{\{h\}\}/gi, h);
    }

    const frontmatterLines: string[] = [
      "---",
      `book: "[[${mainLink}|${mainTitle}]]"`
    ];

    if (this.settings.addVocabularyProperty !== false) {
      const key = (this.settings.vocabularyPropertyKey || "type").trim();
      const val = (this.settings.vocabularyPropertyValue || "vocabulary").trim();
      if (key) {
        frontmatterLines.push(`${key}: ${val}`);
      }
    }

    frontmatterLines.push(
      "tags:",
      "  - book/vocabulary",
      "---",
      "",
      this.getSingleVocabularySnippet(),
      ""
    );

    return frontmatterLines.join("\n");
  }

  /**
   * Extracts clean genres from book userShelves, filtering out status shelves
   */
  public getBookGenres(book: GoodreadsBook): string[] {
    const statusShelves = new Set([
      "read",
      "currently-reading",
      "currently reading",
      "to-read",
      "to read",
      "did-not-finish",
      "did not finish",
      "did_not_finish",
      (book.shelf || "").toLowerCase().trim(),
      (book.shelf || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-")
    ]);

    const genres: string[] = [];
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
  public sanitizeTag(tag: string): string {
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
  public resolveTags(book: GoodreadsBook): string[] {
    const rawSetting = (this.settings.tagPrefix || "").trim();
    if (!rawSetting) return [];

    const genres = this.getBookGenres(book);

    // Build lookup map for property values (matches key or underlying field)
    const propertyValueMap = new Map<string, string[]>();

    const setMapValue = (name: string, values: string[]) => {
      const cleanKey = name.trim().toLowerCase();
      if (!cleanKey) return;
      propertyValueMap.set(cleanKey, values);
    };

    const getStandardFieldValues = (field: string): string[] => {
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
      let values: string[] = [];
      if (prop.field === "custom") {
        values = prop.customValue ? [prop.customValue] : [];
      } else {
        values = getStandardFieldValues(prop.field);
      }
      setMapValue(prop.key, values);
      setMapValue(prop.field, values);
    }

    // Direct fallback aliases
    setMapValue("field", genres);
    setMapValue("genre", genres);
    setMapValue("genres", genres);
    setMapValue("shelf", book.shelf ? [book.shelf] : []);
    setMapValue("status", book.shelf ? [book.shelf] : []);
    setMapValue("title", book.title ? [this.getMainTitle(book.title)] : []);
    setMapValue("author", book.author ? [book.author] : []);
    setMapValue("published", book.publishedYear ? [book.publishedYear] : []);

    // Split raw setting by comma or newline
    const rawTokens = rawSetting
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const tags: string[] = [];

    for (const token of rawTokens) {
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const matches = Array.from(token.matchAll(placeholderRegex));

      if (matches.length === 0) {
        const cleanTag = this.sanitizeTag(token);
        if (cleanTag && !tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
          tags.push(cleanTag);
        }
      } else {
        let expandedList: string[] = [token];

        for (const match of matches) {
          const rawMatch = match[0];
          const propName = match[1].trim().toLowerCase();
          const values = propertyValueMap.get(propName) || [];

          if (values.length === 0) {
            expandedList = [];
            break;
          }

          const nextExpanded: string[] = [];
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
  public generateNoteContent(
    book: GoodreadsBook,
    highlights: GoodreadsHighlight[] = []
  ): string {
    const starString = this.getRatingStars(book.userRating);
    const genres = this.getBookGenres(book);
    const tags = this.resolveTags(book);

    // 1. Build YAML Frontmatter Properties based on user settings
    const properties = this.settings.properties || DEFAULT_PROPERTIES;
    const frontmatterLines: string[] = ["---"];

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
          if (prop.customValue !== undefined && prop.customValue !== "") {
            frontmatterLines.push(`${key}: ${JSON.stringify(prop.customValue)}`);
          }
          break;
      }
    }

    frontmatterLines.push("---");

    // 2. Note Body
    const bodyLines: string[] = [];

    // Optional cover image embed inside body (controlled by includeCover)
    if (this.settings.includeCover && (book.largeCoverUrl || book.coverUrl)) {
      const coverUrl = book.largeCoverUrl || book.coverUrl;
      bodyLines.push(`![Book Cover|240](${coverUrl})`);
      bodyLines.push("");
    }

    // Synopsis
    if (this.settings.includeDescription && book.description) {
      bodyLines.push("# Synopsis");
      const styledSynopsis = book.description
        .split(/\n{2,}/)
        .map((p) => `<small>${p.trim()}</small>`)
        .join("\n\n");
      bodyLines.push(styledSynopsis);
      bodyLines.push("");
      bodyLines.push("---");
      bodyLines.push("");
    }

    // Personal Review & Rating Callout (controlled by includeReview)
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

    // Highlights & Annotations (only embed in main note if in single mode, or if highlights file is disabled)
    const shouldEmbedHighlightsInMainNote =
      this.settings.includeHighlights &&
      highlights.length > 0 &&
      (this.settings.storageMode === "single" || !this.settings.createHighlightsFile);

    if (shouldEmbedHighlightsInMainNote) {
      bodyLines.push(this.formatHighlightsMarkdown(highlights));
    }

    // Optional manual reflection sections (if enabled in settings)
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

    // Book Documents link dashboard when folder mode is active and enabled in settings
    if (
      this.settings.storageMode === "folder" &&
      (this.settings.includeBookDocuments ?? true)
    ) {
      const bookFolderPath = this.getBookFolderPath(book);
      const docLinks: string[] = [];

      if (this.settings.createHighlightsFile) {
        docLinks.push(
          `- 🖍️ [[${bookFolderPath}/Highlights & Notes|Highlights & Notes]]`
        );
      }
      if (this.settings.createThoughtsFile) {
        docLinks.push(
          `- 💭 [[${bookFolderPath}/My Thoughts|My Thoughts]]`
        );
      }
      if (this.settings.createVocabularyFile) {
        docLinks.push(
          `- 📚 [[${bookFolderPath}/Vocabulary|Vocabulary]]`
        );
      }

      if (docLinks.length > 0) {
        const lastNonEmpty = [...bodyLines]
          .reverse()
          .find((l) => l.trim().length > 0);
        if (lastNonEmpty !== "---" && bodyLines.length > 0) {
          bodyLines.push("---");
          bodyLines.push("");
        }
        bodyLines.push("## 📁 Book Documents");
        bodyLines.push(...docLinks);
        bodyLines.push("");
      }
    }

    const rawNote = [...frontmatterLines, ...bodyLines].join("\n");
    // Collapse any accidental consecutive horizontal rule dividers into a single hr
    const cleanedNote = rawNote.replace(
      /(?:\r?\n[ \t]*---[ \t]*\r?\n(?:[ \t]*\r?\n)*)+[ \t]*---[ \t]*(?:\r?\n|$)/g,
      "\n---\n\n"
    );

    return cleanedNote;
  }

  /**
   * Ensures parent directory exists in vault
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const cleanPath = normalizePath(folderPath.trim());
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
      } else if (!(file instanceof TFolder)) {
        throw new Error(`Path conflict: "${currentPath}" exists but is not a folder.`);
      }
    }
  }

  /**
   * Creates or opens note, saving Goodreads Kindle highlights directly on creation
   */
  public async createOrOpenBookNote(
    book: GoodreadsBook
  ): Promise<NoteCreationResult> {
    const existingFile = this.findExistingBookNote(book);

    if (existingFile && !this.settings.overwriteExisting) {
      let syncedCount = 0;
      if (this.settings.includeHighlights) {
        try {
          syncedCount = await this.syncHighlightsToNote(
            existingFile,
            undefined,
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
    const bookFolderPath = isFolderMode
      ? this.getBookFolderPath(book)
      : this.settings.folder.trim();

    // Ensure target folder exists
    if (bookFolderPath) {
      await this.ensureFolderExists(bookFolderPath);
    }

    // 1. Fetch Kindle highlights upfront so they are saved immediately into the notes
    let highlights: GoodreadsHighlight[] = [];
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

    // 2. Generate main note content (embeds highlights if in single note mode or createHighlightsFile is disabled)
    const notePath = this.getNoteFilePath(book);
    const content = this.generateNoteContent(book, highlights);

    let targetFile: TFile;
    if (existingFile && this.settings.overwriteExisting) {
      await this.app.vault.modify(existingFile, content);
      targetFile = existingFile;
    } else {
      targetFile = await this.app.vault.create(notePath, content);
    }

    // 3. In folder mode, create sub-notes if enabled and not already present
    if (isFolderMode) {
      if (this.settings.createHighlightsFile) {
        const highlightsPath = normalizePath(
          `${bookFolderPath}/Highlights & Notes.md`
        );
        const existingHighlights =
          this.app.vault.getAbstractFileByPath(highlightsPath);

        const highlightsContent = await this.generateHighlightsNoteContent(
          book,
          highlights
        );

        if (!existingHighlights) {
          await this.app.vault.create(highlightsPath, highlightsContent);
        } else if (
          existingHighlights instanceof TFile &&
          highlights.length > 0
        ) {
          await this.app.vault.modify(existingHighlights, highlightsContent);
        }
      }

      if (this.settings.createThoughtsFile) {
        const thoughtsPath = normalizePath(`${bookFolderPath}/My Thoughts.md`);
        if (!this.app.vault.getAbstractFileByPath(thoughtsPath)) {
          const thoughtsContent = await this.generateMyThoughtsContent(book);
          await this.app.vault.create(thoughtsPath, thoughtsContent);
        }
      }

      if (this.settings.createVocabularyFile) {
        const vocabPath = normalizePath(`${bookFolderPath}/Vocabulary.md`);
        if (!this.app.vault.getAbstractFileByPath(vocabPath)) {
          const vocabContent = await this.generateVocabularyContent(book);
          await this.app.vault.create(vocabPath, vocabContent);
        }
      }
    }

    // 4. Open main note if configured
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
  public async syncHighlightsToNote(
    file: TFile,
    cachedHighlights?: GoodreadsHighlight[],
    book?: GoodreadsBook
  ): Promise<number> {
    // 1. Resolve goodreads_id, title, author, and shelf
    let bookId: string | undefined = book?.bookId;
    let mainTitle = book?.title ? this.getMainTitle(book.title) : file.basename;
    let author = book?.author || "";
    let shelf = book?.shelf || "read";
    let targetHighlightFile: TFile = file;

    // If book is not directly passed, check metadataCache frontmatter
    if (!bookId) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.goodreads_id) {
        bookId = String(cache.frontmatter.goodreads_id);
        mainTitle = cache.frontmatter.title || mainTitle;
        author = cache.frontmatter.author || author;
        shelf = cache.frontmatter.shelf || shelf;
      }
    }

    // Direct read fallback if metadataCache is not indexed yet
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
        // Continue
      }
    }

    // In folder mode only, check sibling markdown files if the current file is a sub-note
    if (!bookId && this.settings.storageMode === "folder" && file.parent) {
      for (const sibling of file.parent.children) {
        if (
          sibling instanceof TFile &&
          sibling.extension === "md" &&
          sibling.path !== file.path
        ) {
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
            // Continue
          }
        }
      }
    }

    if (!bookId) {
      throw new Error(
        "Current file or book folder does not have a 'goodreads_id' in its frontmatter."
      );
    }

    // If folder mode is active and Highlights & Notes.md is configured, route highlights to it!
    if (
      this.settings.storageMode === "folder" &&
      this.settings.createHighlightsFile &&
      file.parent
    ) {
      const candidatePath = normalizePath(
        `${file.parent.path}/Highlights & Notes.md`
      );
      const candidate = this.app.vault.getAbstractFileByPath(candidatePath);
      if (candidate instanceof TFile) {
        targetHighlightFile = candidate;
      }
    }

    const highlights =
      cachedHighlights ||
      (await GoodreadsService.fetchBookHighlights(
        this.settings.userId,
        String(bookId),
        this.settings.goodreadsCookie
      ));

    if (highlights.length === 0) {
      return 0;
    }

    if (targetHighlightFile.name === "Highlights & Notes.md") {
      const bookStub: GoodreadsBook = book || {
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
      const newContent = await this.generateHighlightsNoteContent(
        bookStub,
        highlights
      );
      await this.app.vault.modify(targetHighlightFile, newContent);
      return highlights.length;
    }

    const highlightsMd = this.formatHighlightsMarkdown(highlights);
    const currentContent = await this.app.vault.read(targetHighlightFile);

    const sectionRegex =
      /#{1,6}\s+Highlights & Annotations[\s\S]*?(?=\n#{1,6}\s+|$)/;
    let newContent: string;

    if (sectionRegex.test(currentContent)) {
      newContent = currentContent.replace(sectionRegex, highlightsMd.trim());
    } else if (currentContent.includes("## 📁 Book Documents")) {
      const trimmedMd = highlightsMd.trim();
      const insert = trimmedMd.endsWith("---")
        ? `${trimmedMd}\n\n## 📁 Book Documents`
        : `${trimmedMd}\n\n---\n\n## 📁 Book Documents`;
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
  public async openFile(file: TFile): Promise<void> {
    const mode = this.settings.openLocation;
    let leaf = this.app.workspace.getLeaf(false);

    if (mode === "new-tab") {
      leaf = this.app.workspace.getLeaf("tab");
    } else if (mode === "split") {
      leaf = this.app.workspace.getLeaf("split");
    }

    await leaf.openFile(file, { active: true });
  }
}
