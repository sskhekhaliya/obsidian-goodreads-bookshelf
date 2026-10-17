import {
  ItemView,
  Notice,
  setIcon,
  WorkspaceLeaf
} from "obsidian";
import { GoodreadsBook } from "./types";
import { GoodreadsService } from "./goodreads-service";
import { NoteService } from "./note-service";
import type GoodreadsBookshelfPlugin from "./main";

export const VIEW_TYPE_GOODREADS = "goodreads-bookshelf-view";

export class GoodreadsBookshelfView extends ItemView {
  private books: GoodreadsBook[] = [];
  private activeShelf: string = "all";
  private searchQuery: string = "";
  private filterVaultStatus: "all" | "in-vault" | "not-in-vault" = "all";
  private sortBy: "date" | "rating" | "title" | "author" | "pages" = "date";
  private viewMode: "grid" | "list" = "grid";
  private isLoading: boolean = false;
  private errorMessage: string = "";

  private contentElContainer: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: GoodreadsBookshelfPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_GOODREADS;
  }

  getDisplayText(): string {
    return "Goodreads Bookshelf";
  }

  getIcon(): string {
    return "library";
  }

  async onOpen(): Promise<void> {
    this.activeShelf = this.plugin.settings.defaultShelf || "all";
    this.render();
    if (this.plugin.settings.userId.trim()) {
      await this.loadBooks();
    }
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
  }

  /**
   * Fetches books from Goodreads service
   */
  public async loadBooks(shelf?: string): Promise<void> {
    if (shelf !== undefined) {
      this.activeShelf = shelf;
    }

    const userId = this.plugin.settings.userId.trim();
    if (!userId) {
      this.errorMessage =
        "Goodreads User ID is not set. Please configure it in settings.";
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
      new Notice(`Loaded ${this.books.length} books from Goodreads`);
    } catch (err: any) {
      this.isLoading = false;
      this.errorMessage = err.message || "Failed to fetch Goodreads books";
      this.render();
    }
  }

  /**
   * Main render function
   */
  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
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
  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "gr-bookshelf-header" });

    const titleGroup = header.createDiv({ cls: "gr-header-title-group" });
    const iconSpan = titleGroup.createSpan({ cls: "gr-header-icon" });
    setIcon(iconSpan, "library");

    const textGroup = titleGroup.createDiv();
    textGroup.createEl("h2", { text: "Goodreads Bookshelf", cls: "gr-title" });
    const subText = textGroup.createSpan({ cls: "gr-subtitle" });
    if (this.plugin.settings.userId.trim()) {
      subText.setText(`User ID: ${this.plugin.settings.userId.trim()}`);
    } else {
      subText.setText("Setup required");
    }

    const actions = header.createDiv({ cls: "gr-header-actions" });

    // Refresh Button
    const refreshBtn = actions.createEl("button", {
      cls: "gr-icon-btn",
      title: "Refresh Bookshelf"
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.loadBooks());

    // Settings Button
    const settingsBtn = actions.createEl("button", {
      cls: "gr-icon-btn",
      title: "Open Plugin Settings"
    });
    setIcon(settingsBtn, "settings");
    settingsBtn.addEventListener("click", () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById(this.plugin.manifest.id);
    });
  }

  /**
   * State when User ID is missing
   */
  private renderEmptySettingsState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: "gr-empty-state" });
    const iconEl = emptyState.createDiv({ cls: "gr-empty-icon" });
    setIcon(iconEl, "book-open");

    emptyState.createEl("h3", { text: "Welcome to Goodreads Bookshelf" });
    emptyState.createEl("p", {
      text: "Please configure your Goodreads User ID in settings to view and sync your shelves."
    });

    const btn = emptyState.createEl("button", {
      text: "Open Settings",
      cls: "mod-cta"
    });
    btn.addEventListener("click", () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById(this.plugin.manifest.id);
    });
  }

  /**
   * Loading state
   */
  private renderLoadingState(container: HTMLElement): void {
    const loadingState = container.createDiv({ cls: "gr-loading-state" });
    const spinner = loadingState.createDiv({ cls: "gr-spinner" });
    setIcon(spinner, "loader-2");
    loadingState.createEl("p", {
      text: `Fetching books for shelf "${this.activeShelf}"...`
    });
  }

  /**
   * Error state
   */
  private renderErrorState(container: HTMLElement): void {
    const errState = container.createDiv({ cls: "gr-error-state" });
    const iconEl = errState.createDiv({ cls: "gr-error-icon" });
    setIcon(iconEl, "alert-circle");

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
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById(this.plugin.manifest.id);
    });
  }

  /**
   * Filters and Controls Toolbar
   */
  private renderToolbar(container: HTMLElement): void {
    const toolbar = container.createDiv({ cls: "gr-toolbar" });

    // Shelves tabs
    const tabsWrapper = toolbar.createDiv({ cls: "gr-shelf-tabs" });
    const standardShelves: { id: string; label: string }[] = [
      { id: "all", label: "All Books" },
      { id: "currently-reading", label: "Currently Reading" },
      { id: "read", label: "Read" },
      { id: "to-read", label: "Want to Read" }
    ];

    // Include custom shelves from settings if any
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

    // Filter Controls Row
    const controlsRow = toolbar.createDiv({ cls: "gr-controls-row" });

    // Search Input with Clear (Cross) Button
    const searchContainer = controlsRow.createDiv({ cls: "gr-search-box" });
    const searchIcon = searchContainer.createSpan({ cls: "gr-search-icon" });
    setIcon(searchIcon, "search");
    const input = searchContainer.createEl("input", {
      type: "text",
      placeholder: "Search by title, author, or shelf tags...",
      value: this.searchQuery
    });

    const clearBtn = searchContainer.createEl("button", {
      cls: `gr-search-clear-btn ${this.searchQuery ? "is-visible" : ""}`,
      title: "Clear search"
    });
    setIcon(clearBtn, "x");

    input.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
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

    // Vault Filter
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
      this.filterVaultStatus = (e.target as HTMLSelectElement)
        .value as "all" | "in-vault" | "not-in-vault";
      this.updateBookListOnly();
    });

    // Sort Dropdown
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
      this.sortBy = (e.target as HTMLSelectElement).value as any;
      this.updateBookListOnly();
    });

    // View toggle (grid / list)
    const viewToggle = controlsRow.createDiv({ cls: "gr-view-toggle" });
    const gridBtn = viewToggle.createEl("button", {
      cls: `gr-view-btn ${this.viewMode === "grid" ? "is-active" : ""}`,
      title: "Grid View"
    });
    setIcon(gridBtn, "layout-grid");
    gridBtn.addEventListener("click", () => {
      this.viewMode = "grid";
      this.updateToolbarAndList();
    });

    const listBtn = viewToggle.createEl("button", {
      cls: `gr-view-btn ${this.viewMode === "list" ? "is-active" : ""}`,
      title: "List View"
    });
    setIcon(listBtn, "list");
    listBtn.addEventListener("click", () => {
      this.viewMode = "list";
      this.updateToolbarAndList();
    });
  }

  /**
   * Filter and Sort Books
   */
  private getFilteredAndSortedBooks(): GoodreadsBook[] {
    const noteService = new NoteService(this.app, this.plugin.settings);

    return this.books
      .filter((book) => {
        // Search filter
        if (this.searchQuery) {
          const matchTitle = book.title.toLowerCase().includes(this.searchQuery);
          const matchAuthor = book.author.toLowerCase().includes(this.searchQuery);
          const matchShelves = book.userShelves.some((s) =>
            s.toLowerCase().includes(this.searchQuery)
          );
          if (!matchTitle && !matchAuthor && !matchShelves) {
            return false;
          }
        }

        // Vault status filter
        if (this.filterVaultStatus !== "all") {
          const exists = noteService.findExistingBookNote(book) !== null;
          if (this.filterVaultStatus === "in-vault" && !exists) return false;
          if (this.filterVaultStatus === "not-in-vault" && exists) return false;
        }

        return true;
      })
      .sort((a, b) => {
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
            return 0; // retain RSS chronological order
        }
      });
  }

  /**
   * Quick update of the book grid without full re-render
   */
  private updateBookListOnly(): void {
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

  private updateToolbarAndList(): void {
    this.render();
  }

  /**
   * Render book cards grid or list
   */
  private renderBookGrid(container: HTMLElement): void {
    const filtered = this.getFilteredAndSortedBooks();
    const noteService = new NoteService(this.app, this.plugin.settings);

    // Stats bar
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
      setIcon(batchBtn.createSpan({ cls: "gr-batch-icon" }), "download");
      batchBtn.addEventListener("click", () => this.batchImportBooks(filtered));
    }

    if (filtered.length === 0) {
      const emptyMsg = container.createDiv({
        cls: "gr-books-view gr-no-results"
      });
      const icon = emptyMsg.createDiv({ cls: "gr-empty-icon" });
      setIcon(icon, "search-x");
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
  private renderGridCard(
    container: HTMLElement,
    book: GoodreadsBook,
    isSaved: boolean,
    noteService: NoteService
  ): void {
    const card = container.createDiv({
      cls: `gr-book-card ${isSaved ? "is-saved" : ""}`
    });

    // Cover Image
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

    // Vault saved ribbon badge
    if (isSaved) {
      const savedBadge = coverWrapper.createDiv({ cls: "gr-saved-badge" });
      setIcon(savedBadge, "check");
      savedBadge.createSpan({ text: "Saved" });
    }

    // Book Details
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

    // Rating & Shelf Row
    const metaRow = info.createDiv({ cls: "gr-card-meta-row" });

    if (book.userRating > 0) {
      const ratingEl = metaRow.createSpan({ cls: "gr-stars-user" });
      ratingEl.setText(noteService.getRatingStars(book.userRating));
      ratingEl.title = `Your Rating: ${book.userRating}/5`;
    } else if (book.averageRating > 0) {
      const ratingEl = metaRow.createSpan({ cls: "gr-stars-avg" });
      ratingEl.setText(`★ ${book.averageRating}`);
      ratingEl.title = `Goodreads Avg: ${book.averageRating}`;
    }

    if (book.publishedYear) {
      metaRow.createSpan({
        text: book.publishedYear,
        cls: "gr-meta-year"
      });
    }

    // Shelf Badge
    if (book.shelf) {
      const shelfBadge = info.createSpan({
        cls: `gr-shelf-pill gr-shelf-${book.shelf}`
      });
      shelfBadge.setText(book.shelf.replace("-", " "));
    }

    // Actions Row
    const actions = card.createDiv({ cls: "gr-card-actions" });

    const primaryBtn = actions.createEl("button", {
      cls: `gr-action-btn ${isSaved ? "gr-btn-open" : "gr-btn-create mod-cta"}`
    });

    const iconSpan = primaryBtn.createSpan({ cls: "gr-btn-icon" });
    setIcon(iconSpan, isSaved ? "file-text" : "plus");

    const labelSpan = primaryBtn.createSpan({ cls: "gr-btn-label" });
    labelSpan.setText(isSaved ? "Open Note" : "Create Note");

    // Click handler to create or open note
    const handleBookClick = async () => {
      try {
        primaryBtn.disabled = true;
        labelSpan.setText("Working...");
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
        this.updateBookListOnly();
      } catch (err: any) {
        new Notice(`Error: ${err.message}`);
        labelSpan.setText(isSaved ? "Open Note" : "Create Note");
        primaryBtn.disabled = false;
      }
    };

    primaryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleBookClick();
    });

    // Make clicking the title or card also trigger creation/open
    titleEl.addEventListener("click", () => handleBookClick());

    // External Goodreads Link
    if (book.link) {
      const linkBtn = actions.createEl("a", {
        cls: "gr-link-btn",
        href: book.link,
        title: "View on Goodreads"
      });
      setIcon(linkBtn, "external-link");
    }
  }

  /**
   * Render single book row in List Mode
   */
  private renderListRow(
    container: HTMLElement,
    book: GoodreadsBook,
    isSaved: boolean,
    noteService: NoteService
  ): void {
    const row = container.createDiv({
      cls: `gr-book-row ${isSaved ? "is-saved" : ""}`
    });

    // Mini cover
    const miniCover = row.createDiv({ cls: "gr-mini-cover" });
    if (book.coverUrl) {
      miniCover.createEl("img", {
        attr: { src: book.coverUrl, alt: book.title, loading: "lazy" }
      });
    } else {
      const placeholder = miniCover.createDiv({ cls: "gr-mini-fallback" });
      setIcon(placeholder, "book");
    }

    // Row Info
    const info = row.createDiv({ cls: "gr-row-info" });
    const titleEl = info.createEl("div", {
      text: book.title,
      cls: "gr-row-title"
    });
    info.createEl("div", { text: book.author, cls: "gr-row-author" });

    // Meta
    const meta = row.createDiv({ cls: "gr-row-meta" });
    if (book.userRating > 0) {
      meta.createSpan({
        text: noteService.getRatingStars(book.userRating),
        cls: "gr-stars-user"
      });
    } else if (book.averageRating > 0) {
      meta.createSpan({
        text: `★ ${book.averageRating}`,
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

    // Actions
    const actions = row.createDiv({ cls: "gr-row-actions" });

    const btn = actions.createEl("button", {
      cls: `gr-action-btn ${isSaved ? "gr-btn-open" : "gr-btn-create mod-cta"}`
    });
    const iconSpan = btn.createSpan({ cls: "gr-btn-icon" });
    setIcon(iconSpan, isSaved ? "file-text" : "plus");
    const labelSpan = btn.createSpan({ cls: "gr-btn-label" });
    labelSpan.setText(isSaved ? "Open" : "Save Note");

    const handleClick = async () => {
      try {
        btn.disabled = true;
        const res = await noteService.createOrOpenBookNote(book);
        if (res.alreadyExisted) {
          if (res.highlightsCount > 0) {
            new Notice(`Synced ${res.highlightsCount} Kindle highlights to "${book.title}"!`);
          } else {
            new Notice(`Opened: "${book.title}"`);
          }
        } else if (res.highlightsCount > 0) {
          new Notice(
            `Saved "${book.title}" with ${res.highlightsCount} Kindle highlights!`,
            5000
          );
        } else {
          new Notice(`Created book note: "${book.title}"`);
        }
        this.updateBookListOnly();
      } catch (err: any) {
        new Notice(`Error: ${err.message}`);
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
      setIcon(link, "external-link");
    }
  }

  /**
   * Fallback aesthetic cover when no book image exists
   */
  private renderFallbackCover(container: HTMLElement, book: GoodreadsBook): void {
    const fallback = container.createDiv({ cls: "gr-cover-fallback" });
    const bookIcon = fallback.createDiv({ cls: "gr-fallback-icon" });
    setIcon(bookIcon, "book");
    fallback.createDiv({ text: book.title, cls: "gr-fallback-title" });
    fallback.createDiv({ text: book.author, cls: "gr-fallback-author" });
  }

  /**
   * Batch imports multiple books into notes
   */
  private async batchImportBooks(books: GoodreadsBook[]): Promise<void> {
    const noteService = new NoteService(this.app, this.plugin.settings);
    const unSavedBooks = books.filter(
      (b) => noteService.findExistingBookNote(b) === null
    );

    if (unSavedBooks.length === 0) {
      new Notice("All visible books already have notes created in your vault!");
      return;
    }

    const confirmed = window.confirm(
      `Create notes for ${unSavedBooks.length} book(s) in folder "${this.plugin.settings.folder || "Vault Root"}"?`
    );
    if (!confirmed) return;

    let createdCount = 0;
    // Temporarily disable opening each note in a leaf during batch import
    const originalSetting = this.plugin.settings.openNoteAfterCreation;
    this.plugin.settings.openNoteAfterCreation = false;

    new Notice(`Creating ${unSavedBooks.length} book notes...`);

    try {
      for (const book of unSavedBooks) {
        await noteService.createOrOpenBookNote(book);
        createdCount++;
      }
      new Notice(
        `Successfully created ${createdCount} book notes!`,
        5000
      );
    } catch (err: any) {
      new Notice(`Error during batch import: ${err.message}`);
    } finally {
      this.plugin.settings.openNoteAfterCreation = originalSetting;
      this.updateBookListOnly();
    }
  }
}
