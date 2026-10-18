import { App, Notice, SuggestModal } from "obsidian";
import { GoodreadsBook } from "./types";
import { GoodreadsService } from "./goodreads-service";
import { NoteService } from "./note-service";
import type GoodreadsBookshelfPlugin from "./main";

export class GoodreadsBookSuggestModal extends SuggestModal<GoodreadsBook> {
  private books: GoodreadsBook[] = [];
  private isLoading = true;

  constructor(app: App, private plugin: GoodreadsBookshelfPlugin) {
    super(app);
    this.setPlaceholder("Search your Goodreads books by title, author, or shelf...");
  }

  async onOpen(): Promise<void> {
    super.onOpen();

    const userId = this.plugin.settings.userId.trim();
    if (!userId) {
      new Notice("Please set your Goodreads User ID in plugin settings first.");
      this.close();
      return;
    }

    try {
      const res = await GoodreadsService.fetchShelf(
        userId,
        this.plugin.settings.defaultShelf || "all",
        this.plugin.settings.maxItems,
        this.plugin.settings.customShelves
      );
      this.books = res.books;
      this.isLoading = false;
      // Trigger re-render of suggestions
      (this as any).updateSuggestions();
    } catch (err: any) {
      new Notice(`Failed to load Goodreads books: ${err.message}`);
      this.close();
    }
  }

  getSuggestions(query: string): GoodreadsBook[] {
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

  renderSuggestion(book: GoodreadsBook, el: HTMLElement): void {
    const noteService = new NoteService(this.app, this.plugin.settings);
    const existingFile = noteService.findExistingBookNote(book);

    el.addClass("gr-suggest-item");

    const row = el.createDiv({ cls: "gr-suggest-row" });

    // Thumbnail
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
        text: ` • ${noteService.getRatingStars(book.userRating)}`,
        cls: "gr-suggest-stars"
      });
    } else if (book.averageRating > 0) {
      meta.createSpan({
        text: ` • ★ ${book.averageRating}`,
        cls: "gr-suggest-avg"
      });
    }

    if (book.shelf) {
      meta.createSpan({
        text: ` • ${book.shelf}`,
        cls: "gr-suggest-shelf"
      });
    }

    if (existingFile) {
      const badge = row.createDiv({ cls: "gr-suggest-vault-badge" });
      badge.setText("In Vault");
    }
  }

  async onChooseSuggestion(
    book: GoodreadsBook,
    _evt: MouseEvent | KeyboardEvent
  ): Promise<void> {
    const noteService = new NoteService(this.app, this.plugin.settings);
    try {
      const res = await noteService.createOrOpenBookNote(book);
      if (res.alreadyExisted) {
        if (res.highlightsCount > 0) {
          new Notice(`Synced ${res.highlightsCount} Kindle highlights to "${book.title}"!`);
        } else {
          new Notice(`Opened existing note: "${book.title}"`);
        }
      } else if (res.highlightsCount > 0) {
        new Notice(
          `Created note for "${book.title}" with ${res.highlightsCount} Kindle highlights!`,
          5000
        );
      } else {
        new Notice(`Created book note: "${book.title}"`);
      }
    } catch (err: any) {
      new Notice(`Error creating note: ${err.message}`);
    }
  }
}
