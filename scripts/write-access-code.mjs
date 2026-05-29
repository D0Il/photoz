import fs from "node:fs";
import path from "node:path";

const value = String(process.env.PHOTOZ_ACCESS_CODE || "").trim();
const outPath = path.resolve("src/generated-access-code.js");

fs.writeFileSync(
  outPath,
  `// Generated at build time for the Worker bundle only. Do not edit.
export const BUILD_TIME_PHOTOZ_ACCESS_CODE = ${JSON.stringify(value)};
`,
  "utf8"
);

console.log(value ? "PHOTOZ_ACCESS_CODE loaded from Cloudflare Build secret for Worker unlock." : "PHOTOZ_ACCESS_CODE was not present during build.");
