import { Editor, Notice, Plugin, TFile } from "obsidian";
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
        let hasBookId = !!cache?.frontmatter?.goodreads_id;
        if (
          !hasBookId &&
          this.settings.storageMode === "folder" &&
          activeFile.parent
        ) {
          hasBookId = activeFile.parent.children.some(
            (c) =>
              c instanceof TFile &&
              c.extension === "md" &&
              c.path !== activeFile.path &&
              !!this.app.metadataCache.getFileCache(c)?.frontmatter?.goodreads_id
          );
        }
        if (!hasBookId) return false;

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

    this.addCommand({
      id: "insert-highlight-template",
      name: "Insert Highlight Entry Template",
      editorCallback: (editor: Editor) => {
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
      editorCallback: (editor: Editor) => {
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

    // Inline Snippet Triggers (e.g. typing /highlight, /vocab, or /note)
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: Editor) => {
        if (!this.settings.enableSnippetTriggers) return;

        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);
        const textBeforeCursor = lineText.slice(0, cursor.ch);

        const hlTrigger = (
          this.settings.highlightSnippetTrigger || "/highlight"
        ).trim();
        const vocabTrigger = (
          this.settings.vocabularySnippetTrigger || "/vocab"
        ).trim();

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
