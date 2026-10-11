import { App, normalizePath, Notice, TFile, TFolder } from "obsidian";
import {
  GoodreadsBook,
  GoodreadsHighlight,
  GoodreadsPluginSettings,
  DEFAULT_PROPERTIES
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
   * Generates target note file path based on settings
   */
  public getNoteFilePath(book: GoodreadsBook): string {
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

    return normalizePath(`${folder}/${safeName}.md`);
  }

  /**
   * Checks if a note for this book already exists in vault
   */
  public findExistingBookNote(book: GoodreadsBook): TFile | null {
    const expectedPath = this.getNoteFilePath(book);
    const fileByPath = this.app.vault.getAbstractFileByPath(expectedPath);
    if (fileByPath instanceof TFile) {
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
  public formatHighlightsMarkdown(highlights: GoodreadsHighlight[]): string {
    if (highlights.length === 0) return "";

    const lines: string[] = ["## Highlights & Annotations", ""];

    for (const h of highlights) {
      if (h.text) {
        const quoteLines = h.text.split("\n");
        for (const line of quoteLines) {
          lines.push(`> ${line}`);
        }
        if (h.location) {
          lines.push(`> — *Location: ${h.location}*`);
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
  public generateNoteContent(
    book: GoodreadsBook,
    highlights: GoodreadsHighlight[] = []
  ): string {
    const starString = this.getRatingStars(book.userRating);

    // Prepare tags
    const tags: string[] = [];
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
    frontmatterLines.push("");

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
      bodyLines.push("## Synopsis");
      bodyLines.push(book.description);
      bodyLines.push("");
    }

    // Personal Review & Rating
    if (this.settings.includeReview && (book.userRating > 0 || book.userReview)) {
      bodyLines.push("## My Review & Rating");
      if (book.userRating > 0) {
        bodyLines.push(`**Rating:** ${starString} (${book.userRating}/5)`);
        bodyLines.push("");
      }
      if (book.userReview) {
        bodyLines.push(book.userReview);
        bodyLines.push("");
      }
    }

    // Highlights & Annotations (if passed)
    if (this.settings.includeHighlights && highlights.length > 0) {
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

    return [...frontmatterLines, ...bodyLines].join("\n");
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
   * Creates or opens note instantly, with non-blocking background highlight sync
   */
  public async createOrOpenBookNote(
    book: GoodreadsBook
  ): Promise<NoteCreationResult> {
    const existingFile = this.findExistingBookNote(book);

    if (existingFile && !this.settings.overwriteExisting) {
      if (this.settings.openNoteAfterCreation) {
        await this.openFile(existingFile);
      }
      return { file: existingFile, alreadyExisted: true, highlightsCount: 0 };
    }

    // Ensure target folder exists
    if (this.settings.folder.trim()) {
      await this.ensureFolderExists(this.settings.folder);
    }

    // Generate note content instantly using data already in memory
    const notePath = this.getNoteFilePath(book);
    const content = this.generateNoteContent(book, []);

    let targetFile: TFile;
    if (existingFile && this.settings.overwriteExisting) {
      await this.app.vault.modify(existingFile, content);
      targetFile = existingFile;
    } else {
      targetFile = await this.app.vault.create(notePath, content);
    }

    // Open file immediately (instant feedback!)
    if (this.settings.openNoteAfterCreation) {
      await this.openFile(targetFile);
    }

    // Non-blocking background sync for Kindle highlights
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
  private syncHighlightsInBackground(file: TFile, book: GoodreadsBook): void {
    GoodreadsService.fetchBookHighlights(
      this.settings.userId,
      book.bookId,
      this.settings.goodreadsCookie
    )
      .then(async (highlights) => {
        if (highlights && highlights.length > 0) {
          await this.syncHighlightsToNote(file, highlights);
          new Notice(
            `Synced ${highlights.length} Kindle highlights for "${book.title}"!`,
            4000
          );
        }
      })
      .catch(() => {
        // Silently complete if notes are private or unavailable
      });
  }

  /**
   * Syncs highlights into an already existing active book note
   */
  public async syncHighlightsToNote(
    file: TFile,
    cachedHighlights?: GoodreadsHighlight[]
  ): Promise<number> {
    const cache = this.app.metadataCache.getFileCache(file);
    const bookId = cache?.frontmatter?.goodreads_id;
    if (!bookId) {
      throw new Error(
        "Current file does not have a 'goodreads_id' in its frontmatter."
      );
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

    const highlightsMd = this.formatHighlightsMarkdown(highlights);
    const currentContent = await this.app.vault.read(file);

    const sectionRegex = /## Highlights & Annotations[\s\S]*?(?=\n## |$)/;
    let newContent: string;

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
