# PHOTOZ

PHOTOZ is a personal photo library interface for albums, Mirror/ME photos, and chronological search.

## Current behavior

- **Albums** is for real albums and album organization.
- **Search** is the chronological file grid.
- **Search filters** are All, Photos, and Videos.
- **Search excludes Trash**.
- **Search respects Hide from All**.
- **Hide from All** is an album-card toggle that keeps that album’s contents out of Search’s All grid.
- **Nested albums inside a Hide from All album** are also excluded from Search’s All grid.
- **Mirror All** is an inline toggle, not a folder/page opener.
- **Albums does not show global All, Hidden, or Videos shortcuts; Trash and Unassigned use compact symbols.**.
- **The Albums view switcher** only appears on Albums.
- **Tools** lives in the cog menu.
- **Select** opens a compact selection tray.
- **Bottom dock** is icon-only.

## Development

```bash
npm install
npm run dev
npm run build
```

Deploy with your existing Cloudflare/Workers flow after replacing the repo files.

## API note

The Worker guards `/api/index`, `/api/load-index`, `/api/backup-index`, `/api/save-index`, and `/api/upload` so missing index data should not crash the UI.

- Album shortcuts use compact symbols/icons: `★`, trash-can icon, and `?`.

- Search bar input now fills the glass bubble instead of appearing undersized.
