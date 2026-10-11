import { Notice, Plugin } from "obsidian";
import {
  GoodreadsPluginSettings,
  DEFAULT_SETTINGS,
  DEFAULT_PROPERTIES
} from "./types";
import { GoodreadsSettingTab } from "./settings";
import {
  GoodreadsBookshelfView,
  VIEW_TYPE_GOODREADS
} from "./bookshelf-view";
import { GoodreadsBookSuggestModal } from "./bookshelf-modal";
import { NoteService } from "./note-service";

export default class GoodreadsBookshelfPlugin extends Plugin {
  settings: GoodreadsPluginSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register custom Bookshelf View
    this.registerView(
      VIEW_TYPE_GOODREADS,
      (leaf) => new GoodreadsBookshelfView(leaf, this)
    );

    // Ribbon icon
    this.addRibbonIcon("library", "Goodreads Bookshelf", () => {
      this.activateBookshelfView();
    });

    // Commands
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
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return false;
        const cache = this.app.metadataCache.getFileCache(activeFile);
        if (!cache?.frontmatter?.goodreads_id) return false;

        if (!checking) {
          const noteService = new NoteService(this.app, this.settings);
          new Notice("Fetching highlights from Goodreads...");
          noteService
            .syncHighlightsToNote(activeFile)
            .then((count) => {
              if (count > 0) {
                new Notice(`Successfully synced ${count} highlights!`, 5000);
              } else {
                new Notice(
                  "No highlights found. If your Kindle highlights are private, check the session cookie setting.",
                  6000
                );
              }
            })
            .catch((err: any) => {
              new Notice(`Error syncing highlights: ${err.message}`, 6000);
            });
        }
        return true;
      }
    });

    // Settings Tab
    this.addSettingTab(new GoodreadsSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_GOODREADS);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (
      !this.settings.properties ||
      !Array.isArray(this.settings.properties) ||
      this.settings.properties.length === 0
    ) {
      this.settings.properties = JSON.parse(JSON.stringify(DEFAULT_PROPERTIES));
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Activates or opens the Goodreads Bookshelf view in the workspace
   */
  async activateBookshelfView(): Promise<void> {
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
}
