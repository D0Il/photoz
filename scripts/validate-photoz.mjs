import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const app = read("src", "App.jsx");
const css = read("src", "styles.css");
const worker = read("src", "worker.js");
const dockIcons = read("src", "components", "DockIcons.jsx");
const filterMenu = read("src", "components", "FilterMenu.jsx");

const failures = [];
const check = (name, condition) => { if (!condition) failures.push(name); };
const matchCount = (source, pattern) => (source.match(pattern) || []).length;
const dockFunction = app.match(/function Dock\(props\) \{[\s\S]*?\n\}/)?.[0] || "";
const utilityCluster = app.match(/<div className="floatingUtilityCluster">[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";
const utilityRail = app.match(/<div className="floatingUtilityRail"[^>]*>[\s\S]*?<\/div>/)?.[0] || "";
const settingsPanel = app.match(/function SettingsPanel\(props\) \{[\s\S]*?function HealthPanel/)?.[0] || "";

check("no console.assert", !app.includes("console.assert"));
check("worker clean", !worker.includes("async async function"));
check("no stale LashEyeIcon reference in App", !app.includes("LashEyeIcon"));

check("no stale pzFindAlbum helper references", !app.includes("pzFindAlbum"));
check("file detail album lookup uses defined albumById", app.includes("const pzActiveAlbumEditor = albumById(albums, pzAlbumEditorId);") && app.includes("const album = albumById(albums, id);"));
check("search query normalizes missing value", app.includes('const terms = String(query || "").trim().toLowerCase().split(/\\s+/).filter(Boolean);'));
check("no unused legacy dock icon imports in App", !/AnimatedBookDockIcon|SparkSearchDockIcon|DockAlbumGlyph|DockMirrorGlyph|DockSearchGlyph/.test(app));
check("legacy dock aliases remain safe for old imports", dockIcons.includes("export const LashEyeIcon = PhotozMirrorDockIcon") && dockIcons.includes("export const AnimatedBookDockIcon = PhotozAlbumDockIcon") && dockIcons.includes("export const SparkSearchDockIcon = PhotozSearchDockIcon"));
check("no visible Select labels", !app.includes(">Select<") && !app.includes(">SELECT<") && !app.includes('"Select"') && !app.includes('"SELECT"'));
check("no actualPageTitle render", !app.includes("{actualPageTitle}"));
check("singular labels preserved", app.includes("PHOTO ALBUM") && app.includes("YEAR") && app.includes("MONTH") && app.includes("ERA") && !/>PHOTO ALBUMS</.test(app) && !/>YEARS</.test(app) && !/>MONTHS</.test(app) && !/>ERAS</.test(app) && !/return "YEARS"|return "MONTHS"|return "ERAS"/.test(app));
check("search copy updated", app.includes('placeholder="SEARCH"') && app.includes("BROWSE") && !app.includes("SEARCH PHOTO ALBUMS") && !app.includes("SEARCH ALBUMS") && !app.includes("SEARCH FILES"));
check("search page uses only global filter button", !app.includes("searchFilterDropdown") && !app.includes("searchFilterTrigger") && !app.includes("searchFilterMenu") && matchCount(app, /aria-label="Filter results"/g) === 0);
check("corner controls tightened", css.includes("PHOTOZ final prestige/corner pass") && css.includes("padding-top: 2px;") && css.includes("margin: 2px 0 5px;"));
check("dock is larger and more prestigious", css.includes("min-width: 232px;") && css.includes("height: 66px;") && css.includes("photozPrestigeBookFlip"));
check("album search collapsed into nav action", app.includes("albumSearchOpen") && app.includes("setAlbumSearchOpen") && app.includes("albumSearchToggle") && app.includes("<CenteredGlassesIcon size={18} />") && app.includes("albumQuickCreate"));
check("album search input only unfolds from toggle", app.includes("isAlbums && (props.albumSearchOpen || props.albumCreateOpen)") && !app.includes("newAlbumTrigger") && !app.includes("SEARCH PHOTO ALBUMS"));
check("album search action css exists", css.includes("PHOTOZ album search collapse pass") && css.includes(".albumInlineActions") && css.includes(".albumSearchToggle") && css.includes(".albumQuickCreate"));


check("exactly one utility file count JSX", matchCount(app, /className="utilityFileCount"/g) === 1);
check("exactly one FILES status render", matchCount(app, /className="utilityFileCount"[^>]*>\{safeArray\(memories\)(?:\.filter\(memoryHasDisplayableFile\))?\.length\} FILES<\/span>/g) === 1);
check("file count is outside utility bubble", utilityCluster.includes("className=\"floatingUtilityRail\"") && utilityCluster.includes("className=\"utilityFileCount\""));
check("file count is left of music bubble", utilityCluster.indexOf("className=\"utilityFileCount\"") !== -1 && utilityCluster.indexOf("className=\"floatingUtilityRail\"") !== -1 && utilityCluster.indexOf("className=\"utilityFileCount\"") < utilityCluster.indexOf("className=\"floatingUtilityRail\""));
check("file count is not inside floatingUtilityRail", !utilityRail.includes("utilityFileCount"));
check("file count is not inside a button", !/<button[\s\S]*className="utilityFileCount"[\s\S]*<\/button>/.test(utilityCluster));
check("no product/header duplicate file count", !/<em>\{memories\.length\} files<\/em>/.test(app));
check("no control-bar count pill duplicate", !app.includes("<Pill>{props.count}</Pill>"));
check("no old count render paths", !/libraryFileCount|albumFileCountText|albumFileCount|topCount|headerCount|filesCount|totalFiles/.test(app));

check("dock icon exports", dockIcons.includes("export function PhotozAlbumDockIcon") && dockIcons.includes("export function PhotozMirrorDockIcon") && dockIcons.includes("export function PhotozSearchDockIcon"));
check("dock pages carry labels and components", app.includes('{ id: "albums", label: "PHOTO ALBUM", Icon: PhotozAlbumDockIcon }') && app.includes('{ id: "mirror", label: "MIRROR", Icon: PhotozMirrorDockIcon }') && app.includes('{ id: "search", label: "SEARCH", Icon: PhotozSearchDockIcon }'));
check("dock renderer uses Icon component", /const Icon = page\.Icon;[\s\S]*<Icon size=\{28\} \/>/.test(dockFunction));
check("dock renderer uses dock-only tooltip labels without native title", !dockFunction.includes("title={page.label}") && dockFunction.includes("aria-label={page.label}") && dockFunction.includes("data-tooltip={page.label}"));
check("dock uses bottomDock class on actual Glass", dockFunction.includes('className="dock bottomDock"'));
check("dock icons are svg elements, not span-wrapped nodes hidden by old dock span rules", /<svg className="photozDockIcon photozDockBook"/.test(dockIcons) && /<svg className="photozDockIcon photozDockEye"/.test(dockIcons) && /<svg className="photozDockIcon photozDockSearch"/.test(dockIcons));
check("dock animated icon CSS targets real dock", css.includes(".dock .photozDockIcon") && css.includes("svg.photozDockIcon") && css.includes("photozPrestigeBookFlip") && css.includes("photozPrestigeSearchSpark"));
check("eye blink is one cohesive group, not split eyelids", dockIcons.includes("eyeBlinkGroup") && dockIcons.includes("eyeOutline") && !dockIcons.includes("eyeTop") && !dockIcons.includes("eyeBottom") && css.includes("photozUnifiedEyeBlink"));
check("music glyph is an actual music note", app.includes("clearMusicNoteSvg") && app.includes("clearMusicBeam") && app.includes("clearMusicCut") && !app.includes("musicDisc") && css.includes(".clearMusicNoteSvg .clearMusicBeam"));
check("polished menu overrides are present", css.includes("PHOTOZ actual menu/music redesign fix") && css.includes(".settingsPopover.polishedMenuPanel::before") && css.includes(".filterPopover button.active"));
check("AmbientMusicControl is defined before use", app.includes("function AmbientMusicControl()") && app.includes("<AmbientMusicControl />"));
check("PzToastStack is defined before use", app.includes("function PzToastStack(props)") && app.includes("<PzToastStack items={pzToasts} />"));
check("PzAlbumEditorPanel is defined before use", app.includes("function PzAlbumEditorPanel(props)") && app.includes("<PzAlbumEditorPanel"));
check("PasswordGate is defined before use", app.includes("function PasswordGate(props)") && app.includes("<PasswordGate onUnlock="));
check("runtime helpers are defined before use", app.includes("function pzUpdateAlbum(items, id, patch)") && app.includes("function pzUpdateMemory(items, id, patch)") && app.includes("function pzNowIso()") && app.includes("function pzIsVideo(memory)") && app.includes("function pzMemoryDisplayName(memory)") && app.includes("function pzVideoRuntime(memory)") && app.includes("function pzVideoSizeLabel(memory)"));
const ambientControl = app.match(/function AmbientMusicControl\(\) \{[\s\S]*?export default function App/)?.[0] || "";
check("ambient music button has no native tooltip title", ambientControl.includes("ambientUtilityButton") && !ambientControl.includes("data-tooltip") && !ambientControl.includes("title={"));
check("utility spacing is explicitly aligned", css.includes("count is plain text to the LEFT") && css.includes(".floatingUtilityCluster > .utilityFileCount") && css.includes("order: 0") && css.includes(".floatingUtilityCluster > .floatingUtilityRail") && css.includes("order: 1"));

check("settings panel has no redundant header", !settingsPanel.includes("settingsMenuHeader") && !settingsPanel.includes("<strong>SETTINGS</strong>") && !settingsPanel.includes("<Settings"));
check("filter panel has no redundant header", !filterMenu.includes("filterMenuHeader") && !filterMenu.includes("<strong>FILTER</strong>") && !filterMenu.includes("<SlidersHorizontal"));
check("filter menu does not emit native titles", !filterMenu.includes("title: value"));
check("tooltip z-index high", /\[data-tooltip\]::after[\s\S]*z-index:\s*9999/.test(css));
check("tooltip containers overflow visible", css.includes(".dockWrap,") && css.includes(".dock,") && css.includes(".bottomDock,") && css.includes(".floatingUtilityCluster,") && css.includes("overflow: visible"));
check("no broad important overrides", !css.includes("!important"));


check("app exposes active page class for page-specific layout", app.includes('className={"app photozProUI page-" + activePage'));
check("empty states deliberately show X marker", app.includes('className="emptyStateX"') && app.includes('>X</span>') && css.includes('.emptyStateX'));
check("empty states are X only with no helper copy", app.includes('className="emptyStateX"') && !app.includes('Upload photos or videos to browse them here.') && !app.includes('Files marked for mirror will appear here.') && !app.includes('Add photos or create a nested album.'));
check("final utility cluster is tight to corner", css.includes('top: 16px;') && css.includes('right: 18px;'));
check("dock tooltips are lifted above icons", css.includes('.photozProUI .dockButton[data-tooltip]::after') && css.includes('bottom: calc(100% + 13px);'));
check("search and mirror control bars hidden by active page class", css.includes('.photozProUI.page-search .controlBar') && css.includes('.photozProUI.page-mirror .controlBar'));
check("empty states are compact with deliberate X not giant debug panels", css.includes('.photozProUI .emptyState,') && css.includes('.emptyStateX') && css.includes('border-radius: 22px;'));

check("upload media route uses Worker file endpoint", app.includes('const MEDIA_BASE = "/api/file";'));
check("handleUploadOriginal accepts event or FileList inputs", app.includes('function handleUploadOriginal(eventOrFiles)'));
check("upload flow normalizes event or FileList", app.includes('eventOrFiles && eventOrFiles.target && eventOrFiles.target.files'));
check("worker uses shared media bucket helper", worker.includes('function getMediaBucket(env)'));
check("worker supports both bucket binding names", worker.includes('env.photoz') && worker.includes('env.PHOTOZ_BUCKET'));
check("worker serves legacy media URLs", worker.includes('url.pathname.startsWith("/media/")'));
check("worker file reads do not hard-code PHOTOZ_BUCKET only", !worker.includes('env.PHOTOZ_BUCKET.get(key);'));
check("worker uploads do not hard-code PHOTOZ_BUCKET only", !worker.includes('env.PHOTOZ_BUCKET.put(key'));

check("non-dock tooltips are disabled", css.includes("Only the bottom dock gets visual tooltips") && css.includes("[data-tooltip]:not(.dockButton)::after"));
check("native title helper functions removed", !app.includes("title: tooltipForText(label)") && !app.includes("title: value"));
check("group pages use framed shell and X-only empty state", app.includes('className="shell groupShell"') && app.includes('<EmptyState />') && css.includes('.photozProUI .groupShell'));
check("runtime filter paths use safe arrays", !app.includes("props.memories.filter") && !app.includes("activeGroup.items.filter") && !app.includes(" : archiveGroups;") && app.includes("duplicateGroups(safeArray(props.memories))") && app.includes("safeArray(props.memories).filter(function (memory)") && app.includes("safeArray(activeGroup && activeGroup.items).filter"));




const undoStateIndex = app.indexOf('const [undoSnapshot, setUndoSnapshot] = useState(null);');
const overlayComputedIndex = app.indexOf('const hasTransientOverlayOpen = Boolean(');
check("undo state is initialized before overlay computed state", undoStateIndex !== -1 && overlayComputedIndex !== -1 && undoStateIndex < overlayComputedIndex);

check("every major popup is closed by overlay manager", app.includes('if (except !== "fileInfo") setActiveMemory(null);') && app.includes('if (except !== "albumEditor") setPzAlbumEditorId(null);') && app.includes('if (except !== "detailEditor") setPzDetailEditorId(null);') && app.includes('if (except !== "undo") setUndoSnapshot(null);'));
check("search filter dropdown is controlled by app overlay manager", !app.includes('const [searchFilterOpen, setSearchFilterOpen] = useState(false);') && app.includes('const searchFilterOpen = Boolean(props.advancedSearchOpen);') && app.includes('closeTransientOverlays("searchFilter")'));
check("album editor is opened through app overlay manager", app.includes('onEditAlbum={function (group) { closeTransientOverlays("albumEditor"); setPzAlbumEditorId(group.id || group.sourceId); }}') && !app.includes('onEditAlbum={function (group) { setPzAlbumEditorId(group.id || group.sourceId); }}'));
check("undo toast hides while another overlay is open", app.includes('settingsOpen || filterControlsOpen || importPanelOpen || uploadQueueOpen || statusOpen || duplicatesOpen || healthOpen || pzUploadRefilterOpen || albumSearchOpen || albumCreateOpen || bulkMoreOpen || advancedSearchOpen || activeMemory || pzAlbumEditorId || pzDetailEditorId) ? null : undoSnapshot'));

check("overlay manager prevents stacked UI", app.includes("function closeTransientOverlays(except)") && app.includes("function toggleOverlay(name, isOpen, setter)") && app.includes("hasTransientOverlayOpen") && app.includes('document.addEventListener("pointerdown", handlePointerDown, true)') && app.includes("Escape"));
check("album search and create are mutually exclusive", app.includes("function setAlbumSearchExclusive(nextValue)") && app.includes("function setAlbumCreateExclusive(nextValue)") && app.includes('closeTransientOverlays("albumSearch")') && app.includes('closeTransientOverlays("albumCreate")'));
check("overlay z-index system exists", css.includes("PHOTOZ overlay discipline pass") && css.includes("--pz-z-menu") && css.includes("--pz-z-modal") && css.includes("has-open-overlay"));

check("upload does not open import panel as second upload popup", !app.includes('setImportPanelOpen(true);\n\n    const imported = batchFiles.map'));
check("upload closes other overlays before queue", app.includes('closeTransientOverlays("queue");'));
check("upload queue is the only upload panel opened", app.includes('setUploadQueueOpen(true);\n    setImportPanelOpen(false);'));
check("upload toast does not stack over any overlay", app.includes('uploadNotice && !hasTransientOverlayOpen'));
check("upload pending strip does not stack over any overlay", app.includes('uploadPendingItems.length && !hasTransientOverlayOpen'));
check("centered glasses svg exists", app.includes("function CenteredGlassesIcon") && app.includes("centeredGlassesIcon") && css.includes("PHOTOZ centered album search glasses glyph"));
check("no forced glasses offset", !css.includes("translateX(-.75px)") && !css.includes("lucide-glasses"));


check("permanent delete handler exists", app.includes("function permanentDeleteMemory"));
check("file info modal wired to permanent delete", app.includes("permanentDeleteMemory={permanentDeleteMemory}"));
check("detail editor wired to permanent delete", app.includes("onPermanentDelete={permanentDeleteMemory}"));
check("delete forever UI exists", app.includes("DELETE FOREVER"));
const deleteForeverCount = (app.match(/DELETE FOREVER/g) || []).length;
check("delete forever has one top-left viewer placement plus confirmation", deleteForeverCount >= 2 && app.includes("fileViewerPrimaryActions") && app.includes("props.permanentDeleteMemory(memory);") && !app.includes("fileViewerDeleteForeverButton"));

check("delete forever uses in-app confirmation not browser confirm", !app.includes("window.confirm") && !app.includes("confirmDelete(") && app.includes("function DeleteConfirmModal(props)") && app.includes("deleteConfirmBackdrop") && app.includes("<DeleteConfirmModal") && app.includes("open={Boolean(deleteConfirmRequest)}"));
check("file info panel has no dead destructive action pile", !app.includes("fileInfoDeletePanel") && !app.includes("fileInfoDeleteActions"));
check("file info album controls keep useful move path", app.includes("fileInfoAlbumControls") && app.includes("props.moveToAlbum(memory, selectedAlbum)") && app.includes("props.addToAlbum(memory, selectedAlbum)") && app.includes("props.removeFromAlbum(memory, selectedAlbum)"));
check("album navigation clears active album context", app.includes("function leaveAlbumContext()") && app.includes('setCurrentAlbumId("");') && app.includes('setActiveGroup(null);') && app.includes('setScreen("home");'));
check("dock navigation uses album-leaving wrapper", app.includes("function navigatePage(pageId)") && app.includes("leaveAlbumContext();\n    setActivePage(pageId);") && app.includes("<Dock active={activePage} setActive={navigatePage} />"));
check("archive nav leaves album before switching year month era", app.includes("function setArchiveFilterFromNav(filter)") && app.includes("leaveAlbumContext();\n    setArchiveFilter(filter);") && app.includes("setArchiveFilter={setArchiveFilterFromNav}"));


// PHOTOZ file integrity pass checks
check("worker exposes access/auth compatibility routes", worker.includes('url.pathname === "/api/unlock"') && worker.includes('url.pathname === "/api/access"') && worker.includes('url.pathname === "/api/auth"'));
check("worker exposes health route", worker.includes('url.pathname === "/api/health"') && worker.includes('handleHealth(env)'));
check("worker exposes delete route", worker.includes('url.pathname === "/api/delete"') && worker.includes('function handleDelete(request, env)'));
check("worker serves HEAD for media existence checks", worker.includes('GET,HEAD,POST,PUT,DELETE,OPTIONS') && worker.includes('if (method === "HEAD")'));
check("worker sanitizes storage keys", worker.includes('function cleanStorageKey(value)') && worker.includes('replace(/^\\/+/, "")') && worker.includes('part !== ".."'));
check("worker upload respects app storage key", worker.includes('requestedKeys[fileIndex]') && worker.includes('["key", "storageKey"]') && worker.includes('storageKey: key,'));
check("worker returns /api/file storage URLs", worker.includes('function fileUrlForKey(key)') && worker.includes('return `/api/file/${encodeStorageKey(key)}`;'));
check("worker can resolve legacy mismatched upload keys", worker.includes('function resolveObjectKey(bucket, key)') && worker.includes('objectKey.endsWith("-" + basename)'));
check("worker delete resolves legacy mismatched keys", worker.includes('const resolvedKey = await resolveObjectKey(bucket, key);') && worker.includes('await bucket.delete(resolvedKey)'));
check("app storage key helper exists", app.includes('function storageKeyFromMemory(memory)') && app.includes('decodeURIComponent(url.split(marker).pop()'));
check("app media urls always use api file route", app.includes('const MEDIA_BASE = "/api/file"') && app.includes('return MEDIA_BASE + "/" + encodedStorageKey(key);'));
check("app strips blob urls before index save", app.includes('if (isBlobUrl(copy.previewUrl)) delete copy.previewUrl;') && app.includes('if (isBlobUrl(copy.storageUrl)) delete copy.storageUrl;'));
check("app upload parses server memory response", app.includes('const serverMemory = safeArray(data.memories || data.files)[0];') && app.includes('return serverMemory ? normalizeMemoryUrl'));
check("app scheduled upload applies server storage response", app.includes('Object.assign(memory, normalizeMemoryUrl(uploadedMemory), { uploadStatus: "r2" });') && app.includes('pair.memory = { ...pair.memory, ...normalizeMemoryUrl(uploadedMemory), uploadStatus: "r2" };'));
check("app missing-file checks use original route and HEAD", app.includes('const url = originalUrlForMemory(memory)') && app.includes('method: "HEAD", cache: "no-store"'));
check("app permanent delete posts storage key helper", app.includes('const key = storageKeyFromMemory(memory);') && app.includes('body: JSON.stringify({ key: key, id: memory.id })'));
check("password gate uses live access endpoint", !app.includes('fetch("/api/auth", {') && app.includes('fetch("/api/access", {'));

check("album file cards receive working detail editor action", app.includes("onEditMemory={function (memory) { closeTransientOverlays(\"detailEditor\"); setPzDetailEditorId(memory.id); }}"));
check("albums can enter selection mode by long press for bulk move and mirror", app.includes("setSelectionMode={setSelectionMode}") && app.includes("onLongSelect={function (memory)") && app.includes("props.setSelectionMode && props.setSelectionMode(true);"));
check("album selection does not reintroduce visible card select button", !app.includes('aria-label="Select file"') && !app.includes('<AlbumSectionHeader show title="FILES"'));

check("album visibility control stays behind edit", !app.includes('>{album.excludeFromAll ? "SHOW IN ALL" : "HIDE FROM ALL"}</button>') && app.includes('<span>HIDE FROM ALL</span>'));
check("sentimental album view has no FILES section header", !app.includes('<AlbumSectionHeader show title="FILES"'));
check("file card quick actions have no visible select button", !app.includes('aria-label="Select file"'));

check("no selectedCountFromMap runtime crash reference", !app.includes("selectedCountFromMap"));

check("viewer uses full viewport shell", css.includes("width: 100vw") && css.includes("height: 100dvh") && css.includes("grid-template-columns: minmax(0, 1fr)"));
check("album and shortcut tooltip css exists", css.includes(".systemRailItem[data-tooltip]::after") && css.includes(".pzAlbumCardActions button[data-tooltip]::after"));

check("worker imports existing R2 media without importing JSON sidecars", worker.includes("function isLikelyMediaObject") && worker.includes("function isLikelyTakeoutSidecarObject") && worker.includes("allObjects.filter(isLikelyMediaObject)"));
check("worker exposes R2 import route", worker.includes('url.pathname === "/api/import-r2"') && worker.includes("handleR2Import(env)"));
check("worker merges Google Takeout sidecars during R2 import", worker.includes("buildTakeoutSidecarMap") && worker.includes("takeoutSidecarPath") && worker.includes("google-takeout-r2"));
check("app exposes R2 import action in repair panel", app.includes("fetchR2Import") && app.includes("IMPORT R2 FOLDER") && app.includes("importR2AndReload={importR2AndReload}"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}



check("media source helper exists", app.includes('function pzMediaSource(memory)'));
check("preview url does not use missing thumb route", !app.includes('return "/thumb/" + memory.storageKey'));
check("fromFile does not overwrite preview with thumb route", !app.includes('previewUrl: "/thumb/" + key'));
check("file info modal centering css exists", css.includes('PHOTOZ file-info stability pass'));
check("file import enriches actual media metadata", app.includes("async function enrichMemoryWithFileMetadata") && app.includes("readMediaElementMetadata") && app.includes("metadata.dimensions"));
check("file info visibly shows core metadata", app.includes("fileInfoCoreMetaPanel") && app.includes("ORIGINAL") && app.includes("FORMAT") && app.includes("MODIFIED") && app.includes("IMPORTED"));
check("file viewer uses user title before filename", app.includes("const displayTitle = String(draftTitle || memory.title") && app.includes("<h2>{displayTitle}</h2>"));
check("file viewer removes backend status/type bloat", !app.includes("<em>TYPE</em>") && !app.includes("statusLabel") && app.includes("fileInfoMediaSymbol"));
check("file viewer buttons have designed tooltips", app.includes('data-tooltip="Favorite"') && app.includes('data-tooltip="Info"') && css.includes("PHOTOZ luxury file viewer behavior pass"));
check("worker preserves original upload metadata", worker.includes("originalName") && worker.includes("customMetadata") && worker.includes("width") && worker.includes("height") && worker.includes("lastModifiedISO"));
check("r2 repair reads object metadata", worker.includes("bucket.head") && worker.includes("object.originalName") && worker.includes("memoryFromObject(object)"));
check("file previewer has dedicated integrity styling", css.includes("PHOTOZ file metadata + previewer integrity pass") && css.includes(".fileInfoCoreMetaPanel") && css.includes(".fileInfoMetaLine"));

check("album file cards receive working detail editor action", app.includes("onEditMemory={function (memory) { closeTransientOverlays(\"detailEditor\"); setPzDetailEditorId(memory.id); }}"));
check("albums can enter selection mode by long press for bulk move and mirror", app.includes("setSelectionMode={setSelectionMode}") && app.includes("onLongSelect={function (memory)") && app.includes("props.setSelectionMode && props.setSelectionMode(true);"));
check("album selection does not reintroduce visible card select button", !app.includes('aria-label="Select file"') && !app.includes('<AlbumSectionHeader show title="FILES"'));

check("no selectedCountFromMap runtime crash reference", !app.includes("selectedCountFromMap"));

check("viewer uses full viewport shell", css.includes("width: 100vw") && css.includes("height: 100dvh") && css.includes("grid-template-columns: minmax(0, 1fr)"));
check("album and shortcut tooltip css exists", css.includes(".systemRailItem[data-tooltip]::after") && css.includes(".pzAlbumCardActions button[data-tooltip]::after"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


check("full-photo preview guarantee block exists", css.includes("PHOTOZ full-photo preview guarantee"));
check("media viewers/cards use contain after full-photo guarantee", css.includes("PHOTOZ full-photo preview guarantee") && /PHOTOZ full-photo preview guarantee[\s\S]*object-fit:\s*contain/.test(css));
check("video thumbnails not forced cropped after full-photo guarantee", !/PHOTOZ full-photo preview guarantee[\s\S]*object-fit:\s*cover/.test(css));
check("album file cards receive working detail editor action", app.includes("onEditMemory={function (memory) { closeTransientOverlays(\"detailEditor\"); setPzDetailEditorId(memory.id); }}"));
check("albums can enter selection mode by long press for bulk move and mirror", app.includes("setSelectionMode={setSelectionMode}") && app.includes("onLongSelect={function (memory)") && app.includes("props.setSelectionMode && props.setSelectionMode(true);"));
check("album selection does not reintroduce visible card select button", !app.includes('aria-label="Select file"') && !app.includes('<AlbumSectionHeader show title="FILES"'));

check("no selectedCountFromMap runtime crash reference", !app.includes("selectedCountFromMap"));

check("viewer uses full viewport shell", css.includes("width: 100vw") && css.includes("height: 100dvh") && css.includes("grid-template-columns: minmax(0, 1fr)"));
check("album and shortcut tooltip css exists", css.includes(".systemRailItem[data-tooltip]::after") && css.includes(".pzAlbumCardActions button[data-tooltip]::after"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


check("file info modal uses portal", app.includes("createPortal(modalNode, document.body)"));
check("premium file viewer CSS marker missing", css.includes("PHOTOZ YES PASS: media viewer must feel like premium photo software"));
check("file info viewer must use a photo-first split layout", css.includes("grid-template-columns: minmax(0, 1fr) clamp(320px, 24vw, 390px)"));
check("file info media must be inset and contained, not stretched/cropped", css.includes("max-width: 100%") && css.includes("object-fit: contain"));

check("album file cards receive working detail editor action", app.includes("onEditMemory={function (memory) { closeTransientOverlays(\"detailEditor\"); setPzDetailEditorId(memory.id); }}"));
check("albums can enter selection mode by long press for bulk move and mirror", app.includes("setSelectionMode={setSelectionMode}") && app.includes("onLongSelect={function (memory)") && app.includes("props.setSelectionMode && props.setSelectionMode(true);"));
check("album selection does not reintroduce visible card select button", !app.includes('aria-label="Select file"') && !app.includes('<AlbumSectionHeader show title="FILES"'));

check("no selectedCountFromMap runtime crash reference", !app.includes("selectedCountFromMap"));

check("viewer uses full viewport shell", css.includes("width: 100vw") && css.includes("height: 100dvh") && css.includes("grid-template-columns: minmax(0, 1fr)"));
check("album and shortcut tooltip css exists", css.includes(".systemRailItem[data-tooltip]::after") && css.includes(".pzAlbumCardActions button[data-tooltip]::after"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


check("light luxury media viewer overrides dark command center", css.includes("PHOTOZ LIGHT LUXURY MEDIA VIEWER PASS") && css.includes("Silver personal photo archive") && css.includes("rgba(248,248,248,.86)"));
check("file viewer action rail uses icon controls", app.includes('aria-label="Photo actions"') && app.includes('<Star size={17} />') && app.includes('<Trash2 size={17} />'));
check("file viewer has tablet zoom controls", app.includes('aria-label="Zoom out"') && app.includes('aria-label="Fit photo"') && app.includes('aria-label="Zoom in"') && app.includes('handleViewerPointerMove') && app.includes('onPointerDown={handleViewerPointerDown}'));
check("file viewer rail has no duplicate info button", !app.includes('<button type="button" aria-label="Info" data-tooltip="Info" className={inspectorOpen ? "active" : ""}'));
check("file viewer uses touch-safe zoom CSS", css.includes('touch-action: none') && css.includes('.zoomLevelButton') && css.includes('.fileInfoPreview.zoomed'));
check("file viewer zoom controls are corner-mounted and out of the main rail", app.includes('className={"fileInfoZoomCorner" + (memory.trashed ? " trashZoomCorner" : "")}') && css.includes('.fileInfoZoomCorner.trashZoomCorner') && !app.includes('className="zoomLevelButton" onClick={resetPhotoZoom}><Maximize2 size={16}'));
check("file info title block moved into info panel", app.includes('fileInfoInspectorTitleBlock') && !app.includes('<header className="fileInfoHeader">\n            <div className="fileInfoTitleBlock">'));

check("card media layering fix exists", css.includes("PHOTOZ card media layering fix"));
check("photo card images scoped to thumbnail", css.includes(".photoCard .photoThumb img"));
check("photo card metadata separated from media", css.includes(".photoCard .photoMeta") && css.includes("grid-template-rows: minmax(0, 1fr) auto"));

check("album file cards receive working detail editor action", app.includes("onEditMemory={function (memory) { closeTransientOverlays(\"detailEditor\"); setPzDetailEditorId(memory.id); }}"));
check("albums can enter selection mode by long press for bulk move and mirror", app.includes("setSelectionMode={setSelectionMode}") && app.includes("onLongSelect={function (memory)") && app.includes("props.setSelectionMode && props.setSelectionMode(true);"));
check("album selection does not reintroduce visible card select button", !app.includes('aria-label="Select file"') && !app.includes('<AlbumSectionHeader show title="FILES"'));

check("no selectedCountFromMap runtime crash reference", !app.includes("selectedCountFromMap"));

check("viewer uses full viewport shell", css.includes("width: 100vw") && css.includes("height: 100dvh") && css.includes("grid-template-columns: minmax(0, 1fr)"));
check("album and shortcut tooltip css exists", css.includes(".systemRailItem[data-tooltip]::after") && css.includes(".pzAlbumCardActions button[data-tooltip]::after"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


check("file viewer primary action rail exposes Trash", app.includes('aria-label="Trash" data-tooltip="Trash"'));
check("file viewer primary action rail has no Archive/Unarchive", !app.includes('data-tooltip={memory.archived ? "Unarchive" : "Archive"}'));
check("file viewer tooltip/action correction CSS exists", css.includes('PHOTOZ file-viewer action correction'));
check("file viewer exposes ME tag instead of separate Mirror shortcut", app.includes('aria-label="Me" data-tooltip="Me"') && app.includes('props.toggleMeFlag(memory)') && app.includes('<UserRound size={17} />') && !app.includes('aria-label="Mirror" data-tooltip="Mirror"'));
check("active memory starred state uses real starred helper", app.includes('isStarred={activeMemory ? isStarredMemory(activeMemory, albums) : false}'));
check("normal app panels do not expose R2 labels", !app.includes('AUDIT R2 FILES') && !app.includes('R2 audit:') && !app.includes('ALL FILES ARE STORED IN R2.') && !app.includes('R2 {stats.r2'));


check("mirror receives albums for starred lookup", app.includes('albums={albums} openGroup={openGroup} openMemory={openMemoryDetail}'));
check("mirror first layer is BOTH me and starred", app.includes('return isMeMemory(memory) && isStarredMemory(memory, albums)'));
check("mirror documents tag multi-membership", app.includes('ME and STARRED are tags, not exclusive folders'));

check("search mode uses broad non-hidden file pool", app.includes('function memoryVisibleInSearch(memory, albums)') && app.includes('!memoryHiddenFromAll(memory) && !memoryExcludedFromAll(memory, albums)') && app.includes('const baseItems = newest(allMemories.filter(function (memory) {'));
check("search filtering passes albums argument correctly", app.includes('return matchesSearchFilter(memory, allAlbums, activeSearchFilter);'));
check("google takeout importer keeps JSON sidecars for metadata", app.includes('function isTakeoutSidecarFile(file)') && app.includes('async function buildTakeoutSidecarMap(files)') && app.includes('memory = applyTakeoutSidecar(memory, file, sidecarForMediaFile(file, sidecarMap));'));
check("bulk import uses stable retry-safe ids and keys", app.includes('function stableFileImportId(file)') && app.includes('id: "memory-" + stableFileImportId(file)') && app.includes('stableFileImportId(file) + "-" + safeName'));
check("import summary reports takeout sidecars and remaining files", app.includes('TAKEOUT {props.importSummary.takeout || 0}') && app.includes('JSON {props.importSummary.sidecars || 0}') && app.includes('LEFT {props.importSummary.remaining || 0}'));
check("upload filtering accepts media plus takeout json sidecars", app.includes('const sidecarFiles = incomingFiles.filter(isTakeoutSidecarFile);') && app.includes('const files = incomingFiles.filter(isMediaUploadFile);') && app.includes('accept={props.folder ? undefined : "image/*,video/*,.json"}'));
check("takeout has explicit tablet-safe import entry", app.includes('label="Takeout"') && app.includes("takeoutUploadButton") && app.includes("Upload Google Takeout photos, videos, and JSON"));
check("backup restore opens a real file picker", app.includes("function ImportBackupButton") && app.includes("Restore backup") && app.includes("<ImportBackupButton onImport={props.importVaultIndex} />"));
check("year month era grouping excludes trash", app.includes('items = safeArray(items).map(normalizeMemoryRecord).filter(function (memory) {') && app.includes('return !memory.trashed;') && app.includes('const archiveGroups = props.archiveFilter === "albums" ? albums : groupBy(props.archiveFilter, groupingSource);'));
check("trashed viewer exposes restore and delete forever in top-left primary actions", app.includes('fileViewerPrimaryActions') && app.includes('aria-label="Restore" data-tooltip="Restore"') && app.includes('aria-label="Delete forever" data-tooltip="Delete forever"') && app.includes('props.permanentDeleteMemory(memory);'));

check("album file cards receive working detail editor action", app.includes("onEditMemory={function (memory) { closeTransientOverlays(\"detailEditor\"); setPzDetailEditorId(memory.id); }}"));
check("albums can enter selection mode by long press for bulk move and mirror", app.includes("setSelectionMode={setSelectionMode}") && app.includes("onLongSelect={function (memory)") && app.includes("props.setSelectionMode && props.setSelectionMode(true);"));
check("album selection does not reintroduce visible card select button", !app.includes('aria-label="Select file"') && !app.includes('<AlbumSectionHeader show title="FILES"'));

check("no selectedCountFromMap runtime crash reference", !app.includes("selectedCountFromMap"));

check("viewer uses full viewport shell", css.includes("width: 100vw") && css.includes("height: 100dvh") && css.includes("grid-template-columns: minmax(0, 1fr)"));
check("album and shortcut tooltip css exists", css.includes(".systemRailItem[data-tooltip]::after") && css.includes(".pzAlbumCardActions button[data-tooltip]::after"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

check("album nav escapes album context", app.includes("function leaveAlbumContext()") && app.includes("function navigatePage(pageId)") && app.includes("leaveAlbumContext();\n    setActivePage(pageId);") && app.includes("function setArchiveFilterFromNav(filter)") && app.includes("YEAR / MONTH / ERA are global archive views"));

check("release filter helper applies type source quality", app.includes("function matchesReleaseFilter") && app.includes('type === "photos"') && app.includes('source === "takeout"') && app.includes('quality === "rated"'));
check("release filters applied to album search mirror and group grids", app.includes("filteredLibraryMemories") && app.includes("filteredSortedMemories(primaryFiltered") && app.includes("filteredSortedMemories(rawItems") && app.includes("filteredSortedMemories(safeArray(group.items)"));
check("view density applies to media grids", app.includes("densityClass(props.viewDensity)") && css.includes(".photoGrid.densityCompact") && css.includes(".photoGrid.densityLarge"));

check('Video cards must open the main PHOTOZ viewer, not a separate playback modal.', !app.includes('props.onPlayVideo(memory);'));
check('Main file viewer must render videos with custom PHOTOZ controls, not native browser controls.', app.includes('className="pzVideoControls"') && app.includes('aria-label="Video timeline"') && !/<video[\s\S]{0,400}\scontrols(?:\s|>|=)/.test(app));
check('Photo cards must enable hold-to-select without a visible Select button.', app.includes('props.setSelectionMode && props.setSelectionMode(true);'));
check("download original is visible in the main viewer and selected toolbar", app.includes('aria-label="Download" data-tooltip="Download"') && app.includes("bulkDownloadSelected") && app.includes("bulkDownload={bulkDownloadSelected}"));
check("tablet downloads use same-tab Worker attachment route", app.includes("function downloadUrlForMemory") && app.includes("download=1") && app.includes("window.location.href = url") && worker.includes("content-disposition") && worker.includes("attachmentName"));
check("unlock persists across tablet browser restarts", app.includes("function rememberUnlocked()") && app.includes("window.localStorage.setItem") && app.includes("function rememberedUnlocked()") && app.includes("window.localStorage.getItem"));
check("PHOTOZ access gate reports missing PHOTOZ_ACCESS_CODE instead of denying silently", app.includes("PHOTOZ_ACCESS_CODE NOT CONFIGURED") && app.includes("checkAccess()") && app.includes("submitAccessCode(code)"));

check("release density classes use strong PHOTOZ-scoped grid rules", css.includes(".photozProUI .photoGrid.densityCompact") && css.includes(".photozProUI .photoGrid.densityLarge") && css.includes("view-densityCompact"));
check("album year month era groups are not tiny chips", css.includes("RELEASE GROUP VIEW FIX") && css.includes("timelineStack.filterFilter .systemRailItem") && css.includes("min-height: 118px"));
check("large filter path is not a dead control", app.includes('quality === "large" && fileSizeBytes(memory) <= 0'));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


check("App hides missing/non-displayable records from normal views", app.includes("memoryHasDisplayableFile"));
check("App exposes clear missing records action", app.includes("fetchClearMissingRecords") && app.includes("CLEAR MISSING RECORDS"));
check("Worker implements clear missing records endpoint", worker.includes("handleClearMissingFiles") && worker.includes("/api/clear-missing-files"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


check('repair buttons must be explicitly clickable', app.includes('data-repair-action="check-archive"'));
check('repair buttons provide immediate visible feedback', app.includes('markRepairClick={markRepairClick}'));
check('repair buttons do not silently disable all actions', !app.includes('disabled={props.repairStatus && props.repairStatus.state === "running"} onClick={props.runHealthCheck}'));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PHOTOZ validation passed.");
