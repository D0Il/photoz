import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const worker = fs.readFileSync(path.join(root, "src", "worker.js"), "utf8");
const dockIcons = fs.existsSync(path.join(root, "src", "components", "DockIcons.jsx"))
  ? fs.readFileSync(path.join(root, "src", "components", "DockIcons.jsx"), "utf8")
  : "";
const filterMenu = fs.existsSync(path.join(root, "src", "components", "FilterMenu.jsx"))
  ? fs.readFileSync(path.join(root, "src", "components", "FilterMenu.jsx"), "utf8")
  : "";

const failures = [];
const check = (name, condition) => { if (!condition) failures.push(name); };

check("no console.assert", !app.includes("console.assert"));
check("worker clean", !worker.includes("async async function"));
check("no visible Select labels", !app.includes(">Select<") && !app.includes(">SELECT<") && !app.includes('"Select"') && !app.includes('"SELECT"'));
check("no actualPageTitle render", !app.includes("{actualPageTitle}"));
check("singular labels", app.includes("PHOTO ALBUM") && !app.includes("PHOTO ALBUMS") && !app.includes("YEARS") && !app.includes("MONTHS") && !app.includes("ERAS"));
check("utility file count beside controls", app.includes("utilityFileCount") && css.includes(".utilityFileCount"));
check("dock icons restored", app.includes("PhotozAlbumDockIcon") && app.includes("PhotozMirrorDockIcon") && app.includes("PhotozSearchDockIcon"));
check("dock icon file exports", dockIcons.includes("export function PhotozAlbumDockIcon") && dockIcons.includes("export function PhotozMirrorDockIcon") && dockIcons.includes("export function PhotozSearchDockIcon"));
check("music icon polished", app.includes("MusicUtilityIcon") && css.includes(".musicUtilityIcon"));
check("settings/filter headers hidden", css.includes(".settingsMenuHeader") && css.includes(".filterMenuHeader") && !filterMenu.includes("filterMenuHeader"));
check("dock tooltips", app.includes("data-tooltip=") && app.includes("PHOTO ALBUM") && app.includes("MIRROR") && app.includes("SEARCH"));
check("tooltip high z", css.includes("z-index: 9999"));
check("no broad important overrides", !css.includes("!important"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PHOTOZ validation passed.");
