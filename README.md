# Goodreads Bookshelf for Obsidian

An elegant Obsidian plugin to browse your **Goodreads bookshelves** directly within Obsidian and generate rich, formatted book notes with a single click — complete with **Kindle Highlights & Annotations**.

[![Buy Me a Book](https://img.shields.io/badge/Buy%20Me%20a%20Book-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)
[![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.0+-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- 📚 **Visual Bookshelf View**: Browse your books in a stunning grid with book covers, star ratings, page counts, and publication years, or switch to a clean list view.
- 🖍️ **Kindle Notes & Highlights Extraction**: Automatically pull your Kindle highlights, progress locations (`Location: 2%`), and personal annotations for each book from Goodreads into your notes.
- ⚡ **1-Click Note Creation**: Click any book to generate a structured reading note with YAML frontmatter, cover image, synopsis, and highlights.
- 🗂️ **Multi-Shelf Support**: Seamlessly switch between `All Books`, `Currently Reading`, `Read`, and `Want to Read` (plus custom shelves like `favorites`, `sci-fi`, etc.).
- 🔍 **Real-Time Search & Filters**: Search books by title, author, or tags. Filter by vault status (`Saved in Vault` vs `Not Yet Saved`).
- 🚀 **Quick Search Modal**: Press `Ctrl+P` (or `Cmd+P`) and use **Goodreads: Search Goodreads Books & Create Note** to quickly look up any book and create notes without leaving your current note.
- 🔄 **Sync Highlights for Active Note**: Command to sync/refresh Kindle highlights on any existing book note at any time.
- 📦 **Batch Save**: One-click action to save all visible books on a shelf into your vault.
- 🏷️ **Smart Clean Filenames**: Automatically strips long subtitles (separated by `:` or `—` and edition tags) from file names while preserving the full book title in frontmatter properties.
- ⚙️ **Smart Settings & Property Manager**:
  - Customize, add, remove, and rename YAML frontmatter properties.
  - Enter numeric User ID or paste your full Goodreads profile URL.
  - Interactive "Verify Connection" test button.
  - Folder selector with autocomplete suggestions.
  - Configurable note title patterns (`Title`, `Title - Author`, `Author - Title`).
  - Toggle cover images, descriptions, reviews, highlights, and template sections.

---

## 🚀 Quick Start

### 1. Find Your Goodreads User ID
1. Open [Goodreads](https://www.goodreads.com/) in your browser.
2. Click your profile picture in the top-right and select **Profile**.
3. Look at the URL in your browser's address bar:
   ```
   https://www.goodreads.com/user/show/12345678-your-name
   ```
4. Copy the numbers (e.g. `12345678`) or simply paste the entire URL into the plugin settings.

> **Note**: Make sure your Goodreads profile is set to **Public** so that your bookshelf RSS feed can be fetched.

### 2. Configure Plugin Settings
1. Go to **Obsidian Settings** → **Goodreads Bookshelf**.
2. Paste your **Goodreads User ID** or profile URL.
3. Choose the **Save Folder** (e.g. `Books` or `Reading`).
4. Click **Test Connection** to verify that your bookshelf is accessible.

### 3. Extracting Kindle Notes & Highlights
Goodreads stores Kindle highlights linked to your Amazon account under `https://www.goodreads.com/notes/<book-id>/<user-id>`.

- **If your highlights are Visible / Public on Goodreads**: The plugin automatically extracts them when creating a note — no credentials needed!
- **If your highlights are Private**: Goodreads sets Kindle highlights to private by default. You can either:
  1. Set them to **Visible** on Goodreads: Go to **My Books** → **Kindle Notes & Highlights** → click on a book and toggle notes to visible.
  2. **OR** enter your Goodreads `_session_id2` cookie in the plugin settings under **Goodreads Session Cookie (Optional)** to allow the plugin to fetch your private notes.

---

## 📝 Generated Book Note Structure

Each generated note contains structured YAML frontmatter for compatibility with Dataview and Obsidian properties:

```markdown
---
title: "The Long Ships"
author: "Frans G. Bengtsson"
goodreads_id: "10081041"
shelf: "read"
isbn: "159017416X"
rating: 5
rating_stars: "★★★★★"
average_rating: 4.38
pages: 528
published: "1941"
date_added: 2026-09-11
date_read: 2026-08-18
cover: "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1328302275l/10081041.jpg"
goodreads_url: "https://www.goodreads.com/review/show/3634418775"
tags:
  - book
  - read
  - adventure
  - historical-fiction
---

![Book Cover|240](https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1328302275l/10081041.jpg)

## Synopsis
Frans Gunnar Bengtsson’s The Long Ships resurrects the fantastic world of the tenth century AD...

## My Review
**Rating:** ★★★★★ (5/5)

I love good historical fiction that brings an era to life, and this did this with the viking era magically well.

## Highlights & Annotations

> In France the Northmen were so feared that, in 911, Charles the Simple ceded part of his kingdom to them; this came to be known as Normandy, the Northmen’s land.
> — *Location: 2%*

> “For man can triumph over man, and weapon over weapon; against the gods we can pit sacrifice, and against witchcraft, contrary magic; but against bad luck no man has anything to oppose.”
> — *Location: 6%*

> The pork was rancid, the stockfish mildewed, the meal stale, the bread maggoty...
> — *Location: 8%*
> **Note:** Fascinating detail about daily life on a viking voyage.
```

---

## ⌨️ Available Commands

| Command | Description |
|---|---|
| `Open Goodreads Bookshelf View` | Opens the visual bookshelf view in a tab |
| `Search Goodreads Books & Create Note` | Quick switcher style search modal to search and create a note |
| `Sync Highlights for Active Book Note` | Fetches and updates latest Goodreads highlights for the currently open note |
| `Refresh Goodreads Bookshelf` | Reloads books from the Goodreads RSS feed |

---

## 🛠️ Development & Building

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Start esbuild watch mode for development
npm run dev

# Run TypeScript typechecks
npm run check
```

---

## ☕ Support

If you find **Goodreads Bookshelf** helpful for your reading and note-taking workflow, consider supporting my work:

[![Buy Me a Book](https://img.shields.io/badge/Buy%20Me%20a%20Book-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)

---

## 📄 License & Credits

- **Author**: [SSKhekhaliya](https://www.sskhekhaliya.in/)
- **Support**: [buymeacoffee.com/sskhekhaliya](https://buymeacoffee.com/sskhekhaliya)
- **License**: MIT License © [SSKhekhaliya](https://www.sskhekhaliya.in/)
- Built with ❤️ for the [Obsidian](https://obsidian.md) community.
