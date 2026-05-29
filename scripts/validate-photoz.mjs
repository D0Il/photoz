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
check("no unused legacy dock icon imports in App", !/AnimatedBookDockIcon|SparkSearchDockIcon|DockAlbumGlyph|DockMirrorGlyph|DockSearchGlyph/.test(app));
check("legacy dock aliases remain safe for old imports", dockIcons.includes("export const LashEyeIcon = PhotozMirrorDockIcon") && dockIcons.includes("export const AnimatedBookDockIcon = PhotozAlbumDockIcon") && dockIcons.includes("export const SparkSearchDockIcon = PhotozSearchDockIcon"));
check("no visible Select labels", !app.includes(">Select<") && !app.includes(">SELECT<") && !app.includes('"Select"') && !app.includes('"SELECT"'));
check("no actualPageTitle render", !app.includes("{actualPageTitle}"));
check("singular labels preserved", app.includes("PHOTO ALBUM") && app.includes("YEAR") && app.includes("MONTH") && app.includes("ERA") && !/>PHOTO ALBUMS</.test(app) && !/>YEARS</.test(app) && !/>MONTHS</.test(app) && !/>ERAS</.test(app) && !/return "YEARS"|return "MONTHS"|return "ERAS"/.test(app));
check("search copy updated", app.includes("SEARCH PHOTO ALBUMS") && app.includes("BROWSE") && !app.includes("SEARCH ALBUMS") && !app.includes("SEARCH FILES"));

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
check("dock renderer uses Icon component", /const Icon = page\.Icon;[\s\S]*<Icon size=\{23\} \/>/.test(dockFunction));
check("dock renderer uses tooltip labels", dockFunction.includes("title={page.label}") && dockFunction.includes("aria-label={page.label}") && dockFunction.includes("data-tooltip={page.label}"));
check("dock uses bottomDock class on actual Glass", dockFunction.includes('className="dock bottomDock"'));
check("dock icons are svg elements, not span-wrapped nodes hidden by old dock span rules", /<svg className="photozDockIcon photozDockBook"/.test(dockIcons) && /<svg className="photozDockIcon photozDockEye"/.test(dockIcons) && /<svg className="photozDockIcon photozDockSearch"/.test(dockIcons));
check("dock animated icon CSS targets real dock", css.includes(".dock .photozDockIcon") && css.includes("svg.photozDockIcon") && css.includes("photozBookPageFlip") && css.includes("photozEyeTopBlink") && css.includes("photozSearchSpark"));
check("music glyph is polished note svg", app.includes("musicNoteHead") && app.includes("musicBeam") && app.includes("musicFlag") && css.includes(".musicUtilityIcon .musicNoteHead"));
check("utility spacing is explicitly aligned", css.includes("count is plain text to the LEFT") && css.includes(".floatingUtilityCluster > .utilityFileCount") && css.includes("order: 0") && css.includes(".floatingUtilityCluster > .floatingUtilityRail") && css.includes("order: 1"));

check("settings panel has no redundant header", !settingsPanel.includes("settingsMenuHeader") && !settingsPanel.includes("<strong>SETTINGS</strong>") && !settingsPanel.includes("<Settings"));
check("filter panel has no redundant header", !filterMenu.includes("filterMenuHeader") && !filterMenu.includes("<strong>FILTER</strong>") && !filterMenu.includes("<SlidersHorizontal"));
check("tooltip z-index high", /\[data-tooltip\]::after[\s\S]*z-index:\s*9999/.test(css));
check("tooltip containers overflow visible", css.includes(".dockWrap,") && css.includes(".dock,") && css.includes(".bottomDock,") && css.includes(".floatingUtilityCluster,") && css.includes("overflow: visible"));
check("no broad important overrides", !css.includes("!important"));

check("upload media route uses Worker file endpoint", app.includes('const MEDIA_BASE = "/api/file";'));
check("handleUploadOriginal accepts event or FileList inputs", app.includes('function handleUploadOriginal(eventOrFiles)'));
check("upload flow normalizes event or FileList", app.includes('eventOrFiles && eventOrFiles.target && eventOrFiles.target.files'));
check("worker uses shared media bucket helper", worker.includes('function getMediaBucket(env)'));
check("worker supports both bucket binding names", worker.includes('env.photoz') && worker.includes('env.PHOTOZ_BUCKET'));
check("worker serves legacy media URLs", worker.includes('url.pathname.startsWith("/media/")'));
check("worker file reads do not hard-code PHOTOZ_BUCKET only", !worker.includes('env.PHOTOZ_BUCKET.get(key);'));
check("worker uploads do not hard-code PHOTOZ_BUCKET only", !worker.includes('env.PHOTOZ_BUCKET.put(key'));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}


console.log("PHOTOZ validation passed.");
