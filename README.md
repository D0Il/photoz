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

- Ambient music is an icon-only toggle in the utility rail and uses the supplied YouTube video ID QH-CAuEfCAA.

## Password gate

Cloudflare Build variables are build-time only, so the build command runs `scripts/write-access-code.mjs` before Vite. It reads the Build secret `PHOTOZ_ACCESS_CODE` and writes `src/generated-access-code.js`, which is imported only by `src/worker.js`. The frontend app does not import this generated file. At runtime, `/api/unlock` checks `env.PHOTOZ_ACCESS_CODE` first, then the generated Worker-only build fallback.

- Ambient music button refined: quieter icon-only rail control with a subtle active dot.

## Huge build pass

Added source-level product pass for:
- album editor shell: rename, description, parent album, hide from all, cover, delete
- file detail editor shell: title, date, location, caption, tags, rating, ME/star/private/review toggles, download/trash
- upload review panel shell with retry/clear controls
- backup/save confidence strip
- toast/status system
- video badges and video playback modal
- compact loading/error state styling
- responsive QA polish for editor panels and controls

## Video mode pass

Video mode is now a dedicated designed state:
- VIDEOS filter activates a video-mode page class
- cinematic video header with stats
- featured latest video module
- larger 16:9 video grid
- proper video play plates, duration/size labels, and badges
- video cards open playback instead of image detail by default
- cinema playback modal with metadata/actions
- SearchView/GroupView edit/play handlers are now passed as props instead of relying on out-of-scope state

## Video playback correction

Removed the accidental page-level video dashboard/header/featured module. Video mode now means the playback/viewing state only: video cards open a clean theater player with metadata/actions. The videos search filter remains a normal filtered file grid.

## Workflow continuation pass

Added:
- Tools menu entry for upload queue/review
- upload queue records selected files as READY before upload starts
- upload queue summary counts
- retry failed / clear complete / close actions
- backup strip actions for saved/backup timestamps
- file detail restore action for trashed files
- clearer file detail header and trash ribbon
- playback-only video view preserved

- Fixed TDZ runtime crash by moving PHOTOZ workflow derived values after albums/memories state initialization.

- Removed the floating Save/Backup confidence buttons from the main screen; save/backup state is no longer exposed as on-screen UI.

- Changed visible album creation label from `+ New album` to `+`.

- Removed the visible Select control. Long-pressing a file now enters selection mode and selects that file; tapping while selection mode is active toggles items.

- Added hold-and-swipe selection: long-press one file to enter selection, then drag across other files to add them without toggling them off.

- Renamed Tools to Settings and reorganized Settings/Filter panels into grouped, compact controls.

- Replaced the eye symbol with a custom lashed eye icon and center-closing blink animation.

- Dock Albums icon is now a custom animated open book with flipping pages; dock Search icon now has animated sparkle accents.

- Recovery build: removed broad glass/scale override passes that broke page layout; kept stable dock icons, lashed eye, Settings/Filter, hold-swipe selection, PHOTO ALBUMS label, playback-only video, and password fix.

- Fixed missing `withTooltip` helper crash and forced dock PAGES to use animated book / lashed eye / sparkling search icons.

- Removed remaining visible Select controls. Selection remains long-press / hold-swipe only.

- Restored Filter menu as a useful compact control panel: sort, type, source, quality, and view density. Removed the useless ALL/ME/star/video/trash category dump.

- Removed every visible Select control by deleting any button/control that directly toggles selection mode. Long-press and hold-swipe selection remain.

- Forced dock icon visibility at render/CSS level: explicit icon wrapper, SVG sizing, stroke/fill, z-index, and forced PAGES mapping.

- Hard removed visible page title headers across all dock pages.

- Screenshot cleanup: removed actual page title path, added guaranteed dock glyph components, forced dock glyph visibility, hid saving banner, and tightened visible controls.
