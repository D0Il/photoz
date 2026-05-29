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
check("search filters render as dropdown not loose buttons", app.includes("searchFilterDropdown") && app.includes("searchFilterTrigger") && app.includes("searchFilterMenu") && !app.includes('className="searchFilters librarySearchFilters"'));
check("corner controls tightened", css.includes("PHOTOZ final prestige/corner pass") && css.includes("padding-top: 2px;") && css.includes("margin: 2px 0 5px;"));
check("dock is larger and more prestigious", css.includes("min-width: 232px;") && css.includes("height: 66px;") && css.includes("photozPrestigeBookFlip"));
check("album search collapsed into nav action", app.includes("albumSearchOpen") && app.includes("setAlbumSearchOpen") && app.includes("albumSearchToggle") && app.includes("<Glasses size={15}") && app.includes("albumQuickCreate"));
check("album search input only unfolds from toggle", app.includes("isAlbums && (props.albumSearchOpen || props.albumCreateOpen)") && !app.includes("newAlbumTrigger") && !app.includes("SEARCH PHOTO ALBUMS"));
check("album search action css exists", css.includes("PHOTOZ album search collapse pass") && css.includes(".albumInlineActions") && css.includes(".albumSearchToggle") && css.includes(".albumQuickCreate"));


check("exactly one utility file count JSX", matchCount(app, /className="utilityFileCount"/g) === 1);
check("exactly one FILES status render", matchCount(app, /className="utilityFileCount"[^>]*>\{safeArray\(memories\)\.length\} FILES<\/span>/g) === 1);
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
check("music glyph is an actual music note", app.includes("musicNoteStem") && app.includes("musicNoteFlag") && app.includes("musicNoteHead") && !app.includes("musicDisc") && css.includes(".musicUtilityIcon .musicNoteStem"));
check("utility spacing is explicitly aligned", css.includes("count is plain text to the LEFT") && css.includes(".floatingUtilityCluster > .utilityFileCount") && css.includes("order: 0") && css.includes(".floatingUtilityCluster > .floatingUtilityRail") && css.includes("order: 1"));

check("settings panel has no redundant header", !settingsPanel.includes("settingsMenuHeader") && !settingsPanel.includes("<strong>SETTINGS</strong>") && !settingsPanel.includes("<Settings"));
check("filter panel has no redundant header", !filterMenu.includes("filterMenuHeader") && !filterMenu.includes("<strong>FILTER</strong>") && !filterMenu.includes("<SlidersHorizontal"));
check("filter menu does not emit native titles", !filterMenu.includes("title: value"));
check("tooltip z-index high", /\[data-tooltip\]::after[\s\S]*z-index:\s*9999/.test(css));
check("tooltip containers overflow visible", css.includes(".dockWrap,") && css.includes(".dock,") && css.includes(".bottomDock,") && css.includes(".floatingUtilityCluster,") && css.includes("overflow: visible"));
check("no broad important overrides", !css.includes("!important"));


check("app exposes active page class for page-specific layout", app.includes('className={"app photozProUI page-" + activePage}'));
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

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


console.log("PHOTOZ validation passed.");
