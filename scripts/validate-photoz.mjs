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
const utilityRail = app.match(/<div className="floatingUtilityRail">[\s\S]*?<\/div>/)?.[0] || "";
const settingsPanel = app.match(/function SettingsPanel\(props\) \{[\s\S]*?function HealthPanel/)?.[0] || "";

check("no console.assert", !app.includes("console.assert"));
check("worker clean", !worker.includes("async async function"));
check("no stale LashEyeIcon reference in App", !app.includes("LashEyeIcon"));
check("no unused legacy dock icon imports in App", !/AnimatedBookDockIcon|SparkSearchDockIcon|DockAlbumGlyph|DockMirrorGlyph|DockSearchGlyph/.test(app));
check("legacy dock aliases remain safe for old imports", dockIcons.includes("export const LashEyeIcon = PhotozMirrorDockIcon") && dockIcons.includes("export const AnimatedBookDockIcon = PhotozAlbumDockIcon") && dockIcons.includes("export const SparkSearchDockIcon = PhotozSearchDockIcon"));
check("no visible Select labels", !app.includes(">Select<") && !app.includes(">SELECT<") && !app.includes('"Select"') && !app.includes('"SELECT"'));
check("no actualPageTitle render", !app.includes("{actualPageTitle}"));
check("singular labels preserved", app.includes("PHOTO ALBUM") && !app.includes("PHOTO ALBUMS") && !app.includes("YEARS") && !app.includes("MONTHS") && !app.includes("ERAS"));

check("exactly one utility file count JSX", matchCount(app, /className="utilityFileCount"/g) === 1);
check("exactly one FILES status render", matchCount(app, /utilityFileCount[^\n]*>\{safeArray\(memories\)\.length\} FILES<\/span>/g) === 1);
check("file count is in floating utility rail", utilityRail.includes("<AmbientMusicControl />") && utilityRail.includes("className=\"utilityFileCount\"") && utilityRail.indexOf("<AmbientMusicControl />") < utilityRail.indexOf("className=\"utilityFileCount\""));
check("file count is not inside a button", !/<button[\s\S]*className="utilityFileCount"[\s\S]*<\/button>/.test(utilityRail));
check("no product/header duplicate file count", !/<em>\{memories\.length\} files<\/em>/.test(app));
check("no control-bar count pill duplicate", !app.includes("<Pill>{props.count}</Pill>"));
check("no old count render paths", !/libraryFileCount|albumFileCountText|albumFileCount|topCount|headerCount|filesCount|totalFiles/.test(app));

check("dock icon exports", dockIcons.includes("export function PhotozAlbumDockIcon") && dockIcons.includes("export function PhotozMirrorDockIcon") && dockIcons.includes("export function PhotozSearchDockIcon"));
check("dock pages carry labels and components", app.includes('{ id: "albums", label: "PHOTO ALBUM", Icon: PhotozAlbumDockIcon }') && app.includes('{ id: "mirror", label: "MIRROR", Icon: PhotozMirrorDockIcon }') && app.includes('{ id: "search", label: "SEARCH", Icon: PhotozSearchDockIcon }'));
check("dock renderer uses Icon component", /const Icon = page\.Icon;[\s\S]*<Icon size=\{23\} \/>/.test(dockFunction));
check("dock renderer uses tooltip labels", dockFunction.includes("title={page.label}") && dockFunction.includes("aria-label={page.label}") && dockFunction.includes("data-tooltip={page.label}"));
check("dock uses bottomDock class on actual Glass", dockFunction.includes('className="dock bottomDock"'));
check("dock animated icon CSS targets real dock", css.includes(".dock .photozDockIcon") && css.includes("photozBookPageFlip") && css.includes("photozEyeTopBlink") && css.includes("photozSearchSpark"));

check("settings panel has no redundant header", !settingsPanel.includes("settingsMenuHeader") && !settingsPanel.includes("<strong>SETTINGS</strong>") && !settingsPanel.includes("<Settings"));
check("filter panel has no redundant header", !filterMenu.includes("filterMenuHeader") && !filterMenu.includes("<strong>FILTER</strong>") && !filterMenu.includes("<SlidersHorizontal"));
check("tooltip z-index high", /\[data-tooltip\]::after[\s\S]*z-index:\s*9999/.test(css));
check("tooltip containers overflow visible", css.includes(".dockWrap,") && css.includes(".dock,") && css.includes(".bottomDock,") && css.includes("overflow: visible"));
check("no broad important overrides", !css.includes("!important"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PHOTOZ validation passed.");
