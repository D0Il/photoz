import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const worker = fs.readFileSync(path.join(root, "src", "worker.js"), "utf8");
const dockIcons = fs.readFileSync(path.join(root, "src", "components", "DockIcons.jsx"), "utf8");

const countInstances = (app.match(/className="utilityFileCount"/g) || []).length;
const failures = [];
const check = (name, condition) => { if (!condition) failures.push(name); };

check("no console.assert", !app.includes("console.assert"));
check("worker clean", !worker.includes("async async function"));
check("no undefined LashEyeIcon risk", app.includes("LashEyeIcon") ? dockIcons.includes("export const LashEyeIcon") : true);
check("no visible Select labels", !app.includes(">Select<") && !app.includes(">SELECT<") && !app.includes('"Select"') && !app.includes('"SELECT"'));
check("no actualPageTitle render", !app.includes("{actualPageTitle}"));
check("singular labels", app.includes("PHOTO ALBUM") && !app.includes("PHOTO ALBUMS") && !app.includes("YEARS") && !app.includes("MONTHS") && !app.includes("ERAS"));
check("exactly one utility file count", countInstances === 1);
check("no old count elements", !app.includes("libraryFileCount") && !app.includes("albumFileCountText") && !app.includes("albumFileCount"));
check("no old count positioning", !css.includes("right: 188px"));
check("dock icon exports", dockIcons.includes("export function PhotozAlbumDockIcon") && dockIcons.includes("export function PhotozMirrorDockIcon") && dockIcons.includes("export function PhotozSearchDockIcon"));
check("dock alias exports", dockIcons.includes("export const LashEyeIcon") && dockIcons.includes("export const AnimatedBookDockIcon") && dockIcons.includes("export const SparkSearchDockIcon"));
check("dock pages use current icons", app.includes("icon: PhotozAlbumDockIcon") && app.includes("icon: PhotozMirrorDockIcon") && app.includes("icon: PhotozSearchDockIcon"));
check("dock icon css", css.includes("photozBookPageFlip") && css.includes("photozEyeTopBlink") && css.includes("photozSearchSpark"));
check("no broad important overrides", !css.includes("!important"));

if (failures.length) {
  console.error("PHOTOZ validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PHOTOZ validation passed.");
