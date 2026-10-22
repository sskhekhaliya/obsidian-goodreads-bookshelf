export interface GoodreadsBook {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  coverUrl: string;
  largeCoverUrl: string;
  userRating: number;
  averageRating: number;
  pages: number | null;
  publishedYear: string;
  userReadAt: string;
  userDateAdded: string;
  userShelves: string[];
  userReview: string;
  description: string;
  link: string;
  guid: string;
  shelf: string;
}

export interface GoodreadsHighlight {
  id: string;
  location: string;
  text: string;
  note: string;
  isSpoiler?: boolean;
}

export type OpenLocation = "active" | "new-tab" | "split";
export type NoteTitleFormat = "title" | "title-author" | "author-title";
export type NoteStorageMode = "single" | "folder";
export type HeadingLevel = "h1" | "h2" | "h3" | "h4";

export interface FrontmatterPropertyConfig {
  id: string;
  key: string;
  field: string;
  enabled: boolean;
  customValue?: string;
}

export const DEFAULT_PROPERTIES: FrontmatterPropertyConfig[] = [
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

export interface GoodreadsPluginSettings {
  userId: string;
  folder: string;
  defaultShelf: string;
  customShelves: string[];
  maxItems: number;
  openNoteAfterCreation: boolean;
  openLocation: OpenLocation;
  noteTitleFormat: NoteTitleFormat;
  tagPrefix: string;
  includeCover: boolean;
  includeDescription: boolean;
  includeReview: boolean;
  includeReadingSections: boolean;
  includeHighlights: boolean;
  goodreadsCookie: string;
  overwriteExisting: boolean;
  properties: FrontmatterPropertyConfig[];
  storageMode: NoteStorageMode;
  includeBookDocuments: boolean;
  createHighlightsFile: boolean;
  createThoughtsFile: boolean;
  createVocabularyFile: boolean;
  vocabularyHeadingLevel: HeadingLevel;
  addVocabularyProperty: boolean;
  vocabularyPropertyKey: string;
  vocabularyPropertyValue: string;
  customThoughtsTemplate: string;
  customVocabularyTemplate: string;
  customHighlightsTemplate: string;
  highlightsTemplatePath: string;
  thoughtsTemplatePath: string;
  vocabularyTemplatePath: string;
  enableSnippetTriggers: boolean;
  highlightSnippetTrigger: string;
  vocabularySnippetTrigger: string;
}

export const DEFAULT_SETTINGS: GoodreadsPluginSettings = {
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
  addVocabularyProperty: true,
  vocabularyPropertyKey: "type",
  vocabularyPropertyValue: "vocabulary",
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
