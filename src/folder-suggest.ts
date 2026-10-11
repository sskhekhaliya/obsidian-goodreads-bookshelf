import { AbstractInputSuggest, App, TFolder } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  inputEl: HTMLInputElement;

  constructor(app: App, textInputEl: HTMLInputElement) {
    super(app, textInputEl);
    this.inputEl = textInputEl;
  }

  protected getSuggestions(query: string): TFolder[] {
    const lowerQuery = query.toLowerCase().trim();
    const folders: TFolder[] = [];
    const files = this.app.vault.getAllLoadedFiles();

    for (const file of files) {
      if (file instanceof TFolder) {
        const displayPath = file.path === "/" ? "" : file.path;
        if (!lowerQuery || displayPath.toLowerCase().includes(lowerQuery)) {
          folders.push(file);
        }
      }
    }

    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    const displayPath = folder.path === "/" ? "(Vault Root)" : folder.path;
    el.setText(displayPath);
  }

  selectSuggestion(folder: TFolder): void {
    const selectedPath = folder.path === "/" ? "" : folder.path;
    this.setValue(selectedPath);
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
}
