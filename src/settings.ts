import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  setIcon
} from "obsidian";
import type GoodreadsBookshelfPlugin from "./main";
import { FolderSuggest } from "./folder-suggest";
import { FileSuggest } from "./file-suggest";
import { GoodreadsService } from "./goodreads-service";
import {
  DEFAULT_PROPERTIES,
  FrontmatterPropertyConfig,
  NoteTitleFormat,
  OpenLocation,
  NoteStorageMode,
  HeadingLevel
} from "./types";

export class GoodreadsSettingTab extends PluginSettingTab {
  private activeTab: "general" | "properties" | "content" | "shelves" = "general";

  constructor(app: App, private plugin: GoodreadsBookshelfPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Goodreads Bookshelf Settings" });

    // Sub-tab Navigation
    const navBar = containerEl.createDiv({ cls: "gr-settings-nav-bar" });

    const tabs: { id: "general" | "properties" | "content" | "shelves"; label: string; icon: string }[] = [
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
      setIcon(iconSpan, tab.icon);
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
  private renderGeneralTab(container: HTMLElement): void {
    container.createEl("h3", { text: "Goodreads Profile" });

    new Setting(container)
      .setName("Goodreads User ID or Profile URL")
      .setDesc(
        "Enter your numeric Goodreads User ID or paste your full profile URL (e.g. https://www.goodreads.com/user/show/12345678-john-doe). Your profile must be public."
      )
      .addText((text) =>
        text
          .setPlaceholder("e.g. 12345678 or profile URL")
          .setValue(this.plugin.settings.userId)
          .onChange(async (value) => {
            const cleanId = GoodreadsService.extractUserId(value);
            this.plugin.settings.userId = cleanId;
            await this.plugin.saveSettings();
          })
      );

    // Test Connection Button
    new Setting(container)
      .setName("Verify Goodreads Connection")
      .setDesc("Test whether your Goodreads bookshelf RSS feed is accessible.")
      .addButton((btn) =>
        btn
          .setButtonText("Test Connection")
          .setCta()
          .onClick(async () => {
            const userId = this.plugin.settings.userId.trim();
            if (!userId) {
              new Notice("Please enter a Goodreads User ID first.");
              return;
            }

            btn.setButtonText("Testing...");
            btn.setDisabled(true);

            try {
              const res = await GoodreadsService.fetchShelf(userId, "all", 10);
              new Notice(
                `Success! Connected to "${res.shelfTitle}". Found books!`,
                5000
              );
            } catch (err: any) {
              new Notice(`Connection failed: ${err.message}`, 6000);
            } finally {
              btn.setButtonText("Test Connection");
              btn.setDisabled(false);
            }
          })
      );

    container.createEl("h3", { text: "Note Storage & Naming" });

    new Setting(container)
      .setName("Save Folder")
      .setDesc(
        "Vault folder where book notes will be saved. Will be created automatically if missing."
      )
      .addText((text) => {
        text
          .setPlaceholder("e.g. Books or Reading/Goodreads")
          .setValue(this.plugin.settings.folder)
          .onChange(async (val) => {
            this.plugin.settings.folder = val.trim();
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(container)
      .setName("Note Title Format")
      .setDesc("Choose how note file names should be constructed.")
      .addDropdown((dd) =>
        dd
          .addOption("title", "Book Title (e.g. Dune.md)")
          .addOption(
            "title-author",
            "Title - Author (e.g. Dune - Frank Herbert.md)"
          )
          .addOption(
            "author-title",
            "Author - Title (e.g. Frank Herbert - Dune.md)"
          )
          .setValue(this.plugin.settings.noteTitleFormat)
          .onChange(async (val) => {
            this.plugin.settings.noteTitleFormat = val as NoteTitleFormat;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Default Tags")
      .setDesc(
        "Tags added to the frontmatter tags list (comma-separated, without #). Supports dynamic property variables like {{field}}, {{shelf}}, {{author}}, etc."
      )
      .addText((text) =>
        text
          .setPlaceholder("e.g. book, {{field}}")
          .setValue(this.plugin.settings.tagPrefix)
          .onChange(async (val) => {
            this.plugin.settings.tagPrefix = val.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Note Storage Structure")
      .setDesc(
        "Choose whether each book is saved as a single markdown file or as an organized folder containing modular sub-notes."
      )
      .addDropdown((dd) =>
        dd
          .addOption("single", "Single File (e.g. Books/Dune.md)")
          .addOption(
            "folder",
            "Folder per Book (e.g. Books/Dune/Dune.md + sub-notes)"
          )
          .setValue(this.plugin.settings.storageMode)
          .onChange(async (val) => {
            this.plugin.settings.storageMode = val as NoteStorageMode;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.storageMode === "folder") {
      new Setting(container)
        .setName("Generate Highlights & Notes File")
        .setDesc(
          "Generates a dedicated Highlights & Notes.md file inside the book folder."
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.createHighlightsFile)
            .onChange(async (val) => {
              this.plugin.settings.createHighlightsFile = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(container)
        .setName("Generate My Thoughts File")
        .setDesc(
          "Generates a dedicated My Thoughts.md file for personal interpretations, insights, and reviews."
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.createThoughtsFile)
            .onChange(async (val) => {
              this.plugin.settings.createThoughtsFile = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(container)
        .setName("Generate Vocabulary File")
        .setDesc(
          "Generates a dedicated Vocabulary.md file formatted for vocabulary tracking and flashcards."
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.createVocabularyFile)
            .onChange(async (val) => {
              this.plugin.settings.createVocabularyFile = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(container)
        .setName("Include 'Book Documents' Section in Main Note")
        .setDesc(
          "Includes links to sub-documents (Highlights, Thoughts, Vocabulary) under a '## 📁 Book Documents' section in the main book note."
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.includeBookDocuments ?? true)
            .onChange(async (val) => {
              this.plugin.settings.includeBookDocuments = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(container)
        .setName("Vocabulary Heading Level")
        .setDesc(
          "Markdown heading level used for each word entry in Vocabulary.md."
        )
        .addDropdown((dd) =>
          dd
            .addOption("h1", "H1 (#)")
            .addOption("h2", "H2 (##)")
            .addOption("h3", "H3 (###) — Default")
            .addOption("h4", "H4 (####)")
            .setValue(this.plugin.settings.vocabularyHeadingLevel || "h3")
            .onChange(async (val) => {
              this.plugin.settings.vocabularyHeadingLevel = val as HeadingLevel;
              await this.plugin.saveSettings();
            })
        );

      new Setting(container)
        .setName("Highlights & Notes Template File (Vault)")
        .setDesc(
          "Choose a markdown template file from your vault for Highlights & Notes.md. Supports {{highlight}}, {{location}}, {{note}}, {{title}}, {{author}}, and {{book_link}}."
        )
        .addText((text) => {
          text
            .setPlaceholder("e.g. Templates/Highlights.md")
            .setValue(this.plugin.settings.highlightsTemplatePath || "")
            .onChange(async (val) => {
              this.plugin.settings.highlightsTemplatePath = val.trim();
              await this.plugin.saveSettings();
            });
          new FileSuggest(this.app, text.inputEl);
        });

      new Setting(container)
        .setName("My Thoughts Template File (Vault)")
        .setDesc(
          "Choose a markdown template file from your vault for My Thoughts.md. Supports {{title}}, {{author}}, and {{book_link}}."
        )
        .addText((text) => {
          text
            .setPlaceholder("e.g. Templates/Thoughts.md")
            .setValue(this.plugin.settings.thoughtsTemplatePath || "")
            .onChange(async (val) => {
              this.plugin.settings.thoughtsTemplatePath = val.trim();
              await this.plugin.saveSettings();
            });
          new FileSuggest(this.app, text.inputEl);
        });

      new Setting(container)
        .setName("Vocabulary Template File (Vault)")
        .setDesc(
          "Choose a markdown template file from your vault for Vocabulary.md. Supports {{title}}, {{author}}, {{book_link}}, and {{h}}."
        )
        .addText((text) => {
          text
            .setPlaceholder("e.g. Templates/Vocabulary.md")
            .setValue(this.plugin.settings.vocabularyTemplatePath || "")
            .onChange(async (val) => {
              this.plugin.settings.vocabularyTemplatePath = val.trim();
              await this.plugin.saveSettings();
            });
          new FileSuggest(this.app, text.inputEl);
        });

      new Setting(container)
        .setName("Custom 'My Thoughts' Template (Inline Fallback)")
        .setDesc(
          "Inline template for My Thoughts.md if no vault file is selected above. Supports {{title}}, {{author}}, and {{book_link}}."
        )
        .addTextArea((ta) => {
          ta.setPlaceholder("Leave empty to use built-in default template")
            .setValue(this.plugin.settings.customThoughtsTemplate || "")
            .onChange(async (val) => {
              this.plugin.settings.customThoughtsTemplate = val;
              await this.plugin.saveSettings();
            });
          ta.inputEl.rows = 4;
          ta.inputEl.cols = 40;
        });

      new Setting(container)
        .setName("Custom 'Vocabulary' Template (Inline Fallback)")
        .setDesc(
          "Inline template for Vocabulary.md if no vault file is selected above. Supports {{title}}, {{author}}, {{book_link}}, and {{h}}."
        )
        .addTextArea((ta) => {
          ta.setPlaceholder("Leave empty to use built-in default template")
            .setValue(this.plugin.settings.customVocabularyTemplate || "")
            .onChange(async (val) => {
              this.plugin.settings.customVocabularyTemplate = val;
              await this.plugin.saveSettings();
            });
          ta.inputEl.rows = 4;
          ta.inputEl.cols = 40;
        });
    }

    container.createEl("h3", { text: "Editor Behavior" });

    new Setting(container)
      .setName("Open Note After Creation")
      .setDesc("Automatically open the book note in editor after creation.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openNoteAfterCreation)
          .onChange(async (val) => {
            this.plugin.settings.openNoteAfterCreation = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Open Location")
      .setDesc("Where to open newly created or selected book notes.")
      .addDropdown((dd) =>
        dd
          .addOption("new-tab", "New Tab")
          .addOption("active", "Active Tab")
          .addOption("split", "Split Pane (Right)")
          .setValue(this.plugin.settings.openLocation)
          .onChange(async (val) => {
            this.plugin.settings.openLocation = val as OpenLocation;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Overwrite Existing Notes")
      .setDesc(
        "If disabled (recommended), clicking an already saved book will simply open the existing note. If enabled, it will overwrite the note with freshly synced Goodreads data."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.overwriteExisting)
          .onChange(async (val) => {
            this.plugin.settings.overwriteExisting = val;
            await this.plugin.saveSettings();
          })
      );

    container.createEl("h3", { text: "Quick Insert & Snippet Triggers" });

    new Setting(container)
      .setName("Enable Inline Snippet Triggers")
      .setDesc(
        "Automatically expand trigger keywords into templates while typing in the editor (e.g. typing /highlight or /vocab)."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSnippetTriggers)
          .onChange(async (val) => {
            this.plugin.settings.enableSnippetTriggers = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Highlight Snippet Trigger")
      .setDesc(
        "Keyword trigger that automatically expands into a highlight template block."
      )
      .addText((text) =>
        text
          .setPlaceholder("/highlight")
          .setValue(this.plugin.settings.highlightSnippetTrigger)
          .onChange(async (val) => {
            this.plugin.settings.highlightSnippetTrigger = val.trim() || "/highlight";
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Vocabulary Snippet Trigger")
      .setDesc(
        "Keyword trigger that automatically expands into a vocabulary entry block."
      )
      .addText((text) =>
        text
          .setPlaceholder("/vocab")
          .setValue(this.plugin.settings.vocabularySnippetTrigger)
          .onChange(async (val) => {
            this.plugin.settings.vocabularySnippetTrigger = val.trim() || "/vocab";
            await this.plugin.saveSettings();
          })
      );
  }

  // ================= PROPERTIES TAB =================
  private renderPropertiesTab(container: HTMLElement): void {
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

    const fieldLabels: Record<string, string> = {
      title: "Book Title",
      author: "Author Name",
      goodreads_id: "Goodreads Book ID",
      shelf: "Reading Shelf (read, currently-reading, to-read)",
      field: "Book Genre / Shelves",
      genres: "Book Genre / Shelves",
      isbn: "ISBN",
      rating: "My Rating (1-5)",
      rating_stars: "My Rating Stars (★★★★★)",
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

    // Render each property row
    this.plugin.settings.properties.forEach((prop, index) => {
      const row = propList.createDiv({ cls: "gr-prop-row" });

      // Enable/Disable toggle
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

      // Key name input
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

      // Source field badge
      const fieldBadge = row.createSpan({ cls: "gr-prop-field-badge" });
      fieldBadge.setText(fieldLabels[prop.field] || prop.field);

      // Custom value input if custom
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

      // Delete button
      const delBtn = row.createEl("button", {
        cls: "gr-prop-del-btn",
        title: "Delete property"
      });
      setIcon(delBtn, "trash-2");
      delBtn.addEventListener("click", async () => {
        this.plugin.settings.properties.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      });
    });

    // Add New Property Card
    const addCard = container.createDiv({ cls: "gr-add-prop-card" });
    addCard.createEl("h4", { text: "Add Property" });

    const addControls = addCard.createDiv({ cls: "gr-add-prop-controls" });

    // Select Field
    const selectField = addControls.createEl("select", { cls: "gr-select" });
    const availableFields = [
      { id: "field", label: "Book Genre / Shelves (field)" },
      { id: "shelf", label: "Reading Shelf (read, currently-reading, to-read)" },
      { id: "title", label: "Book Title" },
      { id: "author", label: "Author Name" },
      { id: "goodreads_id", label: "Goodreads Book ID" },
      { id: "rating", label: "My Rating (1-5)" },
      { id: "rating_stars", label: "My Rating Stars (★★★★★)" },
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

      const newProp: FrontmatterPropertyConfig = {
        id: `prop-${Date.now()}`,
        key,
        field,
        enabled: true,
        customValue: field === "custom" ? "book" : undefined
      };

      this.plugin.settings.properties.push(newProp);
      await this.plugin.saveSettings();
      new Notice(`Added property "${key}"`);
      this.display();
    });

    // Reset Defaults Button
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
        new Notice("Properties reset to defaults");
        this.display();
      }
    });
  }

  // ================= CONTENT TAB =================
  private renderContentTab(container: HTMLElement): void {
    container.createEl("h3", { text: "Note Content & Sections" });

    new Setting(container)
      .setName("Embed Book Cover in Note Body")
      .setDesc(
        "Embed the book cover image inside the note body. When disabled, the cover image URL will still be kept in your frontmatter properties."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeCover)
          .onChange(async (val) => {
            this.plugin.settings.includeCover = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Include Book Synopsis")
      .setDesc("Include Goodreads book description in the generated note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeDescription)
          .onChange(async (val) => {
            this.plugin.settings.includeDescription = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Include Personal Review & Rating")
      .setDesc(
        "Include your personal Goodreads star rating and written review in the generated note."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeReview)
          .onChange(async (val) => {
            this.plugin.settings.includeReview = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Include Reading Note Sections")
      .setDesc(
        "Adds blank reflection headings for 'Key Takeaways', 'Memorable Quotes', and 'Personal Notes'. Recommended OFF if you prefer clean notes or already extract Kindle highlights."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeReadingSections)
          .onChange(async (val) => {
            this.plugin.settings.includeReadingSections = val;
            await this.plugin.saveSettings();
          })
      );

    if (this.plugin.settings.storageMode === "folder") {
      new Setting(container)
        .setName("Include 'Book Documents' Section")
        .setDesc(
          "Add a '## 📁 Book Documents' section with links to sub-notes inside the main book note (Folder storage mode)."
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.includeBookDocuments ?? true)
            .onChange(async (val) => {
              this.plugin.settings.includeBookDocuments = val;
              await this.plugin.saveSettings();
            })
        );
    }

    container.createEl("h3", { text: "Kindle Notes & Highlights" });

    new Setting(container)
      .setName("Extract Kindle Notes & Highlights")
      .setDesc(
        "Automatically extract your synced Kindle highlights, locations, and personal annotations from Goodreads."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeHighlights)
          .onChange(async (val) => {
            this.plugin.settings.includeHighlights = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Goodreads Session Cookie (Optional)")
      .setDesc(
        "By default, Goodreads marks Kindle highlights as private unless set to 'Visible'. If your highlights are private, paste your `_session_id2` cookie here to fetch them."
      )
      .addText((text) => {
        text
          .setPlaceholder("Optional: paste _session_id2 cookie")
          .setValue(this.plugin.settings.goodreadsCookie)
          .onChange(async (val) => {
            this.plugin.settings.goodreadsCookie = val.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });
  }

  // ================= SHELVES & SYNC TAB =================
  private renderShelvesTab(container: HTMLElement): void {
    container.createEl("h3", { text: "Shelves & Syncing" });

    new Setting(container)
      .setName("Default Shelf")
      .setDesc("Which shelf to load initially when opening the Bookshelf view.")
      .addDropdown((dd) =>
        dd
          .addOption("all", "All Books")
          .addOption("currently-reading", "Currently Reading")
          .addOption("read", "Read")
          .addOption("to-read", "Want to Read")
          .setValue(this.plugin.settings.defaultShelf)
          .onChange(async (val) => {
            this.plugin.settings.defaultShelf = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Custom Shelves")
      .setDesc(
        "Additional Goodreads shelf names to display as tabs (comma-separated, e.g. favorites, sci-fi, biography)."
      )
      .addText((text) =>
        text
          .setPlaceholder("e.g. favorites, non-fiction")
          .setValue(this.plugin.settings.customShelves.join(", "))
          .onChange(async (val) => {
            this.plugin.settings.customShelves = val
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName("Maximum Books to Fetch")
      .setDesc("Limit the number of books retrieved per shelf.")
      .addDropdown((dd) =>
        dd
          .addOption("50", "50 books")
          .addOption("100", "100 books")
          .addOption("200", "200 books")
          .addOption("300", "300 books")
          .setValue(String(this.plugin.settings.maxItems))
          .onChange(async (val) => {
            this.plugin.settings.maxItems = parseInt(val, 10) || 100;
            await this.plugin.saveSettings();
          })
      );
  }
}
