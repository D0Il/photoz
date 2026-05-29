# PHOTOZ

PHOTOZ is a personal photo library interface for albums, Mirror/ME photos, and chronological search.

## Current behavior

- **Albums** is for real albums and album organization.
- **★** shows every file marked starred.
- **?** shows unassigned files.
- **Trash** uses a real trash-can icon.
- **Search** is the chronological file grid.
- **Search filters** are All, Photos, and Videos.
- **Search excludes Trash**.
- **Search respects Hide from All**.
- **Hide from All** is an album-card toggle that keeps that album’s contents out of Search’s All grid.
- **Nested albums inside a Hide from All album** are also excluded from Search’s All grid.
- **Mirror/ME** shows ME files that are also starred by default.
- **Mirror/ME All** is an inline toggle that shows every ME file.
- **Albums does not show global All, Hidden, or Videos shortcuts**.
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

- Search and Mirror empty states now use compact `X` copy.

- Runtime array guards added so missing data cannot crash `.filter()`/`.map()` paths.

- Menus, floating panels, modals, and popups now share a finalized glass panel system.

- Page headers and search placeholders are uppercase; duplicate Albums subtitle removed.

- Filter and Select utility controls are icon-only with accessible labels.

- Added accessible tooltips, subtle UI click sounds, and polished hover/press/panel animations.

- Ambient music toggle with volume control added to the top utility area.

## Password gate

The entry gate validates through `/api/unlock` against the Cloudflare Worker secret/env var named `PHOTOZ_ACCESS_CODE`. `wrangler.toml` sets `keep_vars = true` so dashboard-managed variables/secrets are preserved during `npx wrangler deploy`.
