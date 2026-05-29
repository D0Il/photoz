# PHOTOZ / EYE Vault

This is a Cloudflare Workers Builds project, not a Pages-only project.

Use these Cloudflare Build settings:

Build command:
bun run build

Deploy command:
npx wrangler deploy

Non-production branch deploy command:
npx wrangler deploy

The project uses Wrangler static assets:

- Vite builds the React app into `dist`
- Wrangler deploys `src/worker.js`
- `[assets] directory = "./dist"` serves the built app
- R2 bucket binding is `photoz`

The Worker API routes:

- GET /api/index
- PUT /api/index
- POST /api/upload

R2 objects:

- `vault-index.json`
- uploaded original files, unmodified
- sidecar `*.metadata.json` files

Cloudflare docs used:
- Workers Vite projects use a package build script and Wrangler deploy.
- Workers static assets are configured with `[assets] directory = "./dist"`.
- R2 bindings are configured in `wrangler.toml`.


## Album home rules

Albums are the real home layer for files. Timeline is only a filtered view.

- Every memory must belong to at least one non-star album.
- `UNASSIGNED` is permanent and cannot be deleted.
- New photos go to `UNASSIGNED`.
- New videos go to `VIDEOS`.
- If a custom album is deleted, any orphaned files are automatically returned to `UNASSIGNED`.
- The index save/load path runs `ensureAlbumCoverage()` so old indexes cannot leave files outside albums.


## Albums + filter view update

Albums and Timeline are merged.

- Albums is the default/main archive page.
- The top filter switches between: ALBUMS, YEARS, MONTHS, ERAS.
- ALBUMS is the real home layer.
- YEARS/MONTHS/ERAS are filter views only.
- Every file must still belong to at least one album.


## Styling pass

Updated from generic default UI to a tighter custom archive style: condensed typography, custom dock labels, stronger glass depth, sharper card hierarchy, and no Tailwind dependency.


## Concrete background

The uploaded gray concrete texture is included at:

`public/bg-concrete.jpg`

The app shell floats above it through the `.app` and `.shell` styles in `src/styles.css`.


## Glass refinement pass

Updated the UI glass system:
- clearer glass with less fog
- stronger inner highlights
- darker contact shadows
- layered pseudo-element reflections
- sharper controls, cards, dock, modal, and shell separation from the concrete background


## No shell flash

Removed the PHOTOZ corner mark and changed the React animation key so the floating glass shell stays mounted when switching pages. Only the internal page content changes now.


## Hide saved status

The sync pill no longer shows the normal `SAVED` state. It only appears for active/problem states such as loading, saving, uploading, local, or failed.


## Baseline archive requirements

This app must support the basic archive loop:

- Upload image/video files.
- Preserve original file metadata.
- Save original files unmodified to R2.
- Save and reload `vault-index.json`.
- Keep every file inside at least one album.
- Keep `UNASSIGNED` as the permanent fallback album.
- Create/edit/delete albums.
- Delete photos/videos from the UI.
- Delete removed files from R2 and delete their metadata sidecar.
- Remove deleted files from every album and from the persisted index.
- Keep Timeline/Year/Month/Era as filter views, not file homes.


## Smoked glass pass

Reduced the milky/frosted look:
- lowered white fill opacity across glass surfaces
- reduced blur strength
- added darker smoked transparency
- kept edge highlights and contact shadows so glass still has depth


## Worker media route

Photos display through the Worker route:

`/media/<storageKey>`

This reads directly from the bound R2 bucket `photoz`, so the app no longer depends on the public R2 bucket URL being readable. Older saved index records are normalized on load from the old public R2 URL to `/media/<storageKey>`.


## Compact album titles

Album/folder cards no longer use oversized title typography inside the cards. Titles are compact footer labels with the item count beside them.


## ME album system

Automatic facial organizing has been removed.

The app now uses a manual ME system:

- `ME` is a permanent core album.
- Photos can be added to or removed from the ME album from the photo modal.
- Photos can also be marked `ME` without being placed in the ME album.
- The `ME` marker is independent metadata and is shown as a small badge on the photo tile.
- The old Mirror page/nav item is removed.


## Mirror + ME corrected model

Mirror is a real page again.

Mirror displays:
- every photo with `isMe: true`
- every photo inside the permanent `ME` album

The `ME` album is a normal album/home. The `MARK ME` flag is separate metadata for photos that live in another album but should still appear on Mirror.


## Mirror owns the ME album

The permanent `ME` album is not shown as a normal folder on Albums.

- Mirror is the visual page for the ME album.
- `MOVE TO MIRROR` puts the photo in the hidden `ME` album and removes it from `UNASSIGNED`.
- `MARK ME` is separate metadata. It lets a photo stay in another album while also appearing on Mirror.
- Mirror displays both hidden ME-album photos and photos marked `isMe: true`.


## Mirror without ME album

The `ME` album has been removed entirely.

- Mirror is its own home/view, not a hidden album.
- `MOVE TO MIRROR` sets `inMirror: true` and removes the file from normal albums.
- `REMOVE FROM MIRROR` clears `inMirror`; if the file is not in a normal album, it returns to `UNASSIGNED`.
- `MARK ME` sets `isMe: true`; the photo can stay in a normal album and also appear on Mirror.
- Mirror displays files where `inMirror === true` or `isMe === true`.


## Search requirements

Search is now an actual archive search, not just a title search.

It searches:
- title
- file name
- album names
- year / month / date / era
- file kind
- upload status
- storage key
- ME and Mirror flags
- metadata name/type/size/lastModified/path/signature

Search filters:
- ALL
- PHOTOS
- VIDEOS
- ME
- MIRROR
- UNASSIGNED
- FAILED


## Album assignment requirements

The photo modal now supports album management:

- Shows which albums the photo currently belongs to.
- ADD places the photo into the chosen album while keeping existing album memberships.
- MOVE removes the photo from normal albums, clears Mirror-home status, and places it into the chosen album.
- REMOVE removes the photo from the chosen album; if it has no home left, it returns to UNASSIGNED.


## Photo detail editing

The photo modal now supports editing persisted display details:

- Title
- Display date
- Era

Saving details updates the index, recalculates year/month/sort fields from the edited date, and keeps metadata/original file untouched.


## Bulk management

Selection mode supports multi-photo management:

- SELECT turns on bulk selection.
- ADD adds selected photos to the chosen album.
- MOVE moves selected photos to the chosen album and clears Mirror-home status.
- MARK ME marks all selected photos as ME.
- MIRROR moves selected photos to Mirror.
- DELETE deletes selected photos from the index, albums, and R2.


## Upload status panel

The app now has an upload status panel:

- shows total files
- shows R2 / queued / failed / local counts
- lists failed/local files
- failed/local files are visible instead of silently becoming blank
- after a refresh, true retry requires reselecting the original file because browsers do not keep File objects for security reasons


## Backup and original download

Added archive escape hatches:

- EXPORT downloads the current `vault-index.json` model as a local JSON backup.
- DOWNLOAD in the photo modal opens/downloads the original stored file through the Worker media route.
- Export does not alter R2; it is a local safety copy of the index.


## Backup import and restore

Added IMPORT for saved vault index backups.

- EXPORT creates a local JSON backup of the index.
- IMPORT reads a saved JSON backup, normalizes it, restores memories/albums, and saves it back to R2 as the live index.
- Import restores organization/index data only. It does not upload missing original files; originals must already exist in R2 for media to display.


## Delete protection

Single delete and bulk delete now ask for confirmation before removing records from the index and deleting their R2 objects/metadata sidecars.


## Five-basics pass

Added five archive basics in one pass:

1. STAR / UNSTAR photos into the star album.
2. Set album cover from the photo modal.
3. Sort controls: newest, oldest, title, status.
4. Empty states for blank pages/cards.
5. Duplicate finder based on file signature/name/size/date.


## Bulk management plus pass

Added five bulk basics:

1. SELECT ALL selects every memory in the vault.
2. STAR selected files.
3. UNSTAR selected files.
4. UNMARK ME selected files.
5. REMOVE FROM MIRROR selected files.


## UI usage five pass

Added five usage/UI basics:

1. Grid size control: compact / normal / large.
2. Folder search on Albums/Albums.
3. Video-aware tiles using video elements and VIDEO badge.
4. Metadata toggle in the modal instead of always showing JSON.
5. Copy media URL button in the modal.


## Ten archive upgrades pass

Added ten archive upgrades:

1. STARRED search filter.
2. RECENT search filter.
3. Largest sort.
4. Smallest sort.
5. Pinned albums.
6. Pin/unpin album action.
7. Clear album cover.
8. Storage total in Status panel.
9. `/api/health` Worker route.
10. HEALTH button/panel to check R2/index status.


## Ten more archive basics

Added ten more archive basics:

1. Tags field on each memory.
2. Edit tags in the modal.
3. Tag chips on photo tiles.
4. TAGGED search filter.
5. UNTAGGED search filter.
6. Album stats: count and total size.
7. Virtual ALL folder at top of Albums/Albums.
8. Virtual STARRED folder at top of Albums/Albums.
9. Missing-file checker through HEAD requests to media URLs.
10. Status cleanup action to mark failed/local records for reselection.


## Ten product upgrades pass

Added ten more product/archive upgrades:

1. Album descriptions.
2. Edit album description.
3. Album detail stats/description display.
4. Star badge on tiles.
5. Mirror badge on tiles.
6. File info row in modal.
7. OPEN original in new tab.
8. INVERT selection.
9. SELECT current visible view.
10. App version label in Health.


## Archive control pass

Added ten archive-control basics:

1. Album lock/unlock.
2. Locked albums cannot be deleted.
3. Archived flag for photos/videos.
4. ARCHIVED search filter.
5. ARCHIVE / UNARCHIVE from modal.
6. Bulk archive selected.
7. Bulk unarchive selected.
8. Archive badge on tiles.
9. Archived files excluded from normal ALL virtual folder.
10. ARCHIVED virtual folder in Albums/Albums.


## Trash system pass

Added ten trash/recycle-bin basics:

1. Recycle bin behavior instead of immediate permanent delete.
2. TRASH virtual folder.
3. Restore from trash.
4. Permanently delete from trash.
5. Bulk delete moves to trash first.
6. Bulk restore selected.
7. Trash badge on tiles.
8. TRASH search filter.
9. Trash excluded from normal views.
10. Purge trash action in Status panel.


## Fifteen archive upgrades pass

Added fifteen archive upgrades:

1. Caption/notes field.
2. Location field.
3. Event field.
4. Edit caption/location/event in modal.
5. Search captions.
6. Search locations.
7. Search events.
8. NOTED search filter.
9. LOCATED search filter.
10. Bulk apply tags.
11. Bulk clear tags.
12. Bulk set era.
13. Export selected JSON.
14. Export CSV manifest.
15. Copy storage key from modal.


## Rating and label pass

Added fifteen rating/label upgrades:

1. Rating field.
2. Edit rating in modal.
3. RATED search filter.
4. UNRATED search filter.
5. Rating badge on tiles.
6. Rating sort.
7. Bulk set rating.
8. Bulk clear rating.
9. Color/label field.
10. Edit label in modal.
11. Label badge on tiles.
12. LABELED search filter.
13. UNLABELED search filter.
14. Bulk set label.
15. Bulk clear label.


## Review/private + album sort pass

Added fifteen durability/organization upgrades:

1. Review flag.
2. REVIEW search filter.
3. Bulk mark review.
4. Bulk clear review.
5. Private flag.
6. PRIVATE search filter.
7. Bulk mark private.
8. Bulk clear private.
9. Review/private badges.
10. Stronger duplicate key fallback.
11. Album sort by title.
12. Album sort by count.
13. Album sort by size.
14. Album sort controls.
15. Index validation report in Health.


## Fifteen maintenance upgrades pass

Added fifteen maintenance/search upgrades:

1. Date range search fields.
2. Minimum rating search field.
3. ORIGINALS search filter.
4. NEEDS-FILE search filter.
5. Bulk clear caption/location/event.
6. Bulk set location.
7. Bulk set event.
8. Bulk set caption.
9. Repair index button.
10. Remove bad album refs repair.
11. Return missing-home files to UNASSIGNED repair.
12. Duplicate album-name guard.
13. Album created/updated timestamps.
14. Memory updated timestamp on edits.
15. Health panel repair report.


## Stabilize and simplify pass

This pass reduces feature pileup without deleting functionality:

- Adds `INDEX_SCHEMA_VERSION`.
- Adds migration helpers for memories, albums, and saved indexes.
- Moves STATUS, DUPES, HEALTH, EXPORT, CSV, and IMPORT into one TOOLS drawer.
- Simplifies the top control bar.
- Collapses bulk actions into primary actions plus MORE.
- Reduces tile badge clutter by showing secondary badges on hover.
- Converts search filters into a horizontal scroller instead of a giant wrapping chip wall.
- Adds modal section labels for DETAILS and ORGANIZE.
- Renames the private action to PRIVATE TAG to avoid implying real security before auth exists.


## Optional access gate

Added an optional access gate for the personal archive.

Worker behavior:
- `/api/access` checks/unlocks access.
- If `PHOTOZ_ACCESS_CODE` is set in Cloudflare Pages/Worker environment variables, private Worker routes require the access cookie.
- If `PHOTOZ_ACCESS_CODE` is not set, the app stays open like before.

Set this in Cloudflare environment variables:

`PHOTOZ_ACCESS_CODE=your-private-code`

This protects the Worker routes for index/media/upload/delete. Cloudflare Access can still be added later for full domain-level protection.


## Upload queue pass

Added a real visible upload queue:

- Queue opens automatically when files are selected.
- Shows queued/uploading/done/failed counts.
- Tracks recent queue rows by file name.
- Updates rows as each file begins upload and finishes/fails.
- Adds QUEUE inside the TOOLS drawer.
- Adds CLEAR FINISHED so the active queue can stay clean.


## Preview / thumbnail foundation pass

Added a performance foundation for large archives:

- New Worker route: `/thumb/<storageKey>`.
- The thumb route first checks `thumbs/<storageKey>.webp`.
- If no generated thumbnail exists yet, it falls back to the original object.
- App records now normalize `previewUrl` alongside `storageUrl`.
- Photo tiles use `previewUrl` first.
- Image tiles lazy-load and decode async.
- If preview loading fails, tiles fall back to the original media URL.
- Modal large preview uses the original route.
- Health panel now has CHECK ROUTES for access/health route sanity.

This does not generate thumbnails yet. It creates the route and UI architecture so thumbnail generation can be added later without rewriting the archive UI.


## Import performance pass

Added ten import/performance upgrades:

1. Import mode panel.
2. Upload batch size setting.
3. Queue concurrency setting.
4. Skip duplicate uploads by file signature.
5. Import summary after upload selection.
6. Large-file warning count.
7. Album path preservation display in modal.
8. TAKEOUT search filter.
9. Album path/takeout search boost.
10. Upload queue pause/resume control.

Note: concurrency/batch settings are exposed for the import workflow UI. The current upload runner remains conservative; deeper parallel upload scheduling can be wired to those settings next.


## De-bloat cleanup pass

This pass removes the metadata-feature pileup from the main product surface.

Kept useful archive features:
- Albums
- Mirror / ME
- Search
- Upload queue/import
- Star
- Tags
- Archive
- Trash
- Backup/export
- Access gate
- Thumbnail foundation
- Health/tools

De-emphasized database-like clutter:
- Rating
- Label
- Review
- Private tag

Those legacy fields are not destroyed from saved records, but they are no longer promoted as core photo-software controls.

UI cleanup:
- Search now has primary filters plus MORE.
- Virtual albums are visually separated from real albums.
- Bulk actions are simplified to practical archive actions.
- Tile badges are reduced.
- Modal keeps useful details/organize controls and buries legacy metadata.


## Workflow cleanup pass

This pass focuses on real archive workflows instead of adding fields.

Added:
- Duplicate review workflow with a clear keeper candidate.
- TRASH OTHERS action for duplicate groups.
- Undo foundation for major organization actions.
- Undo bar for last organization/destructive action.
- System folder badge for virtual albums.
- Real album count now excludes system albums.
- Search placeholder is now photo/archive language instead of database language.

Undo currently covers major index-level changes such as album moves, archive/trash/restore, bulk archive/trash/restore, Mirror moves, and duplicate review trashing.


## Scheduler and safety pass

Added upload scheduler and index safety:

- Queue concurrency setting now controls how many queued uploads start at once.
- Pause stops new queued uploads from starting.
- Resume restarts queued uploads.
- Failed uploads can be retried while the browser still has the File object.
- Batch size limits how many selected files enter a batch.
- Upload rows stay tied to their in-memory File object during the session.
- New Worker route: `/api/backup-index`.
- Import and repair trigger an index backup before changing the live index.
- Backups are stored under `index-backups/`.


## Build syntax hotfix

Fixed invalid JSX/JavaScript syntax in `src/App.jsx` where searchable text fragments were accidentally pasted inside an object literal. This resolves the Vite error:

`Expected ',' or '}' but found '.'`


## Build hotfix verified

Fixed Cloudflare/Vite build failures:
- removed invalid searchable-text fragments accidentally pasted into an object literal
- removed stray `</AccessGate>` closing tag in `App.jsx`

Verified locally with `npm run build`.


## Hard visual declutter pass

Reduced visible clutter:

- Sort/grid/album sort moved behind a single VIEW button.
- Top bar is now SELECT / VIEW / TOOLS / UPLOAD.
- Search shows only primary filters first.
- Search advanced filters stay behind MORE.
- Date/rating advanced search only appears when MORE is open.
- Bulk bar is reduced to count, destination, MOVE, TRASH, MORE, CLEAR.
- Extra bulk actions stay inside MORE.
- Metadata-style badges remain hidden.


## Shape system cleanup

Adjusted the visual language so the UI is glass, not bubbles:

- Main surfaces are rounded glass panes.
- Cards are softened rectangles.
- Buttons and inputs are rectangular glass controls.
- Only true chips/badges remain pill-shaped.
- Reduced puffy shadows/padding on controls.
- Kept the glass depth/highlights while making the product feel less toy-like.


## Tools and modal simplification

Cleaned the remaining product bloat:

- Tools are grouped into Import, Archive Care, and Backup.
- Import panel now shows normal choices first.
- Batch size and upload slots are hidden behind Advanced Import.
- Health/repair buttons now use human language.
- Modal file/storage details are hidden behind File Details.
- Raw data stays behind Raw Data.
- Legacy rating/label/review/private panel is removed from the visible modal.
- Archive is labeled as Hidden in filter UI.


## Final product polish pass

Reduced remaining product/admin feel:

- System albums now render as compact shortcut cards instead of full album cards.
- Album/photo action clusters are quieter until hover.
- Modal actions are grouped into a calmer grid.
- Technical/raw details are visually contained.
- Several admin labels were rewritten into normal photo-archive language.
- Search/filter visual weight is reduced.


## Product clarity pass

Improved product feel without adding feature bloat:

- Added a simple Albums/Mirror/Search page header.
- Made the toolbar more compact.
- Made View/Tools panels feel lighter.
- Tightened album hierarchy and spacing.
- Made search filters lighter.
- Made the modal media-first with details beside it on larger screens.
- Reduced visual dominance of bulk/tools/status panels.


## Ruthless reduction pass

Reduced remaining generic/admin bloat:

- Removed redundant product header subtitle.
- Tools are shorter and calmer.
- Search advanced controls no longer expose rating.
- Legacy rating/label/review/private actions are removed from bulk UI.
- Modal action copy is shorter and less admin-like.
- Panels are visually subordinate to albums/photos.
- System albums are treated as shortcuts.
- Content hierarchy now favors albums and media over controls.


## Album wording hotfix

Removed user-facing folder language from the product UI.

- Main archive view now displays Albums language.
- Search copy no longer says albums.
- Album search/create wording is album-first.
- Internal compatibility remains for old saved `albums` view values.


## Album wording and system shortcut fix

Fixed:
- Removed user-facing Folder/Folders wording.
- System items no longer render as album cards.
- System items now render as compact flat shortcuts above real albums.
- Real albums remain the only large album cards.


## Tools overlay cleanup

Made Tools/View/Import/Queue/Status panels visually lighter:

- Panels are compact trays instead of big dashboard blocks.
- Tool sections are small rows, not cards.
- Buttons are quieter and less bubbly.
- Status stats are subtle, not bubble confetti.
- Queue/duplicate panels read more like lists.
- Main albums/photos stay visually dominant.


## Actual system/tools/star fix

Fixed at source level:
- System shortcuts render with `SystemShortcutCard`, not `GroupCard`.
- System shortcuts are flat utility links, not album cards.
- Tools panel renders as a compact dropdown list, not section cards.
- Starred displays as `★`.
- Folder wording is removed from user-facing labels.


## Amazing UI overhaul

Polished PHOTOZ as an album-first private photo archive:

- Premium cinematic glass shell.
- Editorial Albums/Mirror/Search header.
- Real albums now dominate visually.
- System shortcuts are compact utility links, not albums.
- Starred uses `★`.
- Tools/View are refined dropdowns.
- Search is calmer and more elegant.
- Modal is media-first.
- Legacy metadata clutter remains hidden.


## Preserved design / clean CSS consolidation

This build starts from the best-looking visual design and consolidates it instead of replacing it with a random simplified stylesheet.

- Preserves the premium glass/album-card design language.
- Removes `!important` priority flags.
- Removes shipped console assertion tests.
- Splits system shortcuts out of the album grid at source level.
- Hides native file inputs.
- Keeps actual rendered-class coverage for dock, albumTile, groupGrid, photoOverlay, modalCard, etc.

## Albums-only cards hotfix
- System/utility groups are detected with `isSystemAlbumGroup`.
- All, ★, Hidden, Trash, Unassigned, and Videos render in the shortcut rail.
- Only true user albums render as large album cards.
- Preserves the visual design and keeps zero `!important`.


## API index crash hotfix

Fixed:
- `/api/index` returns a safe empty index instead of crashing.
- Frontend normalizes missing `memories` / `albums` to empty arrays.
- Album/search/mirror helpers guard array operations.
- Removed shipped console assertions.
- `/favicon.ico` returns 204 instead of triggering worker errors.

## Final combined API + UI fix
Includes:
- API/index crash protection.
- Arrays normalized so `.filter()` cannot crash on undefined.
- Dock restored as a rounded pill.
- View/Tools removed from main toolbar and moved to tiny utility rail.
- Search bars and album create row reduced.
- Headers reduced.
- Album cards widened and shortened.
- Mirror bar made compact.
- Cluttered search copy shortened.
- System shortcuts stay out of album cards.
- No `!important`.


## Utility rail refinement

- Removed the visible "Shortcuts" label.
- Made utility rail items larger and more intentional.
- Kept them visually distinct from real album cards.
- No `!important` rules.


## Compact header fix

Removed the giant hero/header treatment:

- Page titles are compact labels, not huge brick titles.
- Header spacing is reduced.
- Albums/Mirror/Search headers stay small on tablet/mobile.
- No `!important` rules.


## Select / Upload / Folder placement fix

Moved the library actions out of the main toolbar:

- Select / Upload / Folder now live in a detached corner action cluster.
- Main toolbar is reserved for album/view navigation.
- View/Tools stay separate in the tiny utility rail.
- Headers remain compact.
- No `!important` rules.


## Tools/filter structure fix

Changed:
- Removed subtitles from every Tools item.
- Removed the "Tools" word header inside the tools dropdown.
- Replaced Tools button with cog symbol.
- Renamed View to Filter.
- Moved Upload and Folder into Tools.
- Removed Upload/Folder from the main visible action cluster.
- No `!important` rules.


## Album editor cleanup

Changed the album editor from an admin-looking row into a compact album control:

- Removed the visible count pill.
- Changed FIND ALBUM to Search albums.
- Changed NEW ALBUM to New album.
- Replaced CREATE with a small + button.
- Kept zero `!important` rules.


## Split album search and creation

Changed the album editor so search and creation are not exposed at the same time:

- Default shows only Search albums + a small + button.
- Clicking + reveals the Album name field and create button.
- Removed the always-visible New album field from the main row.
- No `!important` rules.


## Product layout structure fix

Fixed the scattered control-panel layout:

- Tools menu is small, anchored, titleless, and subtitle-free.
- Cog remains the tools trigger.
- Filter is named Filter and stays separate.
- Upload/Folder are inside Tools only.
- Select is no longer stranded in the middle.
- Album search/create is aligned under the album tabs.
- Header is more compact.
- Utility rail is larger and intentional.
- No `!important` rules.


## Screenshot exact layout fix

Fixed the visible layout problems from the screenshot:

- Header is compact instead of giant.
- Select no longer overlaps the album search.
- Select stays in the top rail.
- Tools menu is compact and clear.
- Upload/Folder remain inside Tools with visible labels.
- Tool subtitles stay hidden.
- No blank-looking upload/folder cells.
- No `!important` rules.


## Nested albums and Hide from All

Added:
- Albums can be created inside the currently open album.
- Opening a real album navigates into that album level.
- Albums can contain nested albums and direct photos.
- Albums have a Hide from All / Show in All action.
- Hiding an album from All also hides photos inside its nested child albums from All.
- Root utility views remain separate from real album cards.


## Requested nav/header/search/select/mirror cleanup

Changed:
- Bottom nav is icon-only.
- Page headers use a different smaller serif treatment, not the same huge bold headline style.
- Select is beside Filter in the top-right utility rail.
- Album search and album creation are separate controls.
- Mirror “All” control is labeled All and enlarged.
- Tools remains cog-based with Upload/Folder inside.


## Hard upload/index crash fix

- Removed duplicate normalizers.
- `/api/index`, `/api/load-index`, and `/api/backup-index` return safe JSON instead of 500.
- Worker supports both `PHOTOZ_INDEX`, `photoz`, and `PHOTOZ_BUCKET` bindings.
- Upload endpoint returns safe JSON even if storage binding is unavailable.
- Frontend normalizes missing memories/albums/memoryIds before `.filter()` or `.map()`.


## Clean chrome layout fix

Fixed the layout problems from the screenshots:
- Removed the billboard title treatment.
- Prevented duplicated system utility pills by excluding core/system albums from real album groups.
- Filter and Tools close each other instead of overlapping into one mess.
- Select lives beside Filter.
- Tools menu is a compact popover with clear Upload/Folder labels.
- Album search and New album are separate controls.
- Mirror All button is real-sized and labeled All.
- Bottom dock remains icon-only.


## Screenshot visual reset

Changed based on the supplied screenshots:
- Smaller page identity instead of large headline.
- Deduped system rail.
- Clean separated album search/new-album controls.
- Compact non-overlapping Filter/Tools popovers.
- Select beside Filter.
- Mirror All is full-sized and labeled All.
- Empty states and search controls reduced.


## Dock fix

Changed the bottom nav:
- Fully icon-only source and CSS.
- Smaller floating capsule.
- Three equal circular icon buttons.
- Active state is a subtle ring/fill instead of a chunky blob.
- Removed old dock sizing leaks.
