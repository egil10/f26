// Download the raw wikitext of the Wikipedia squads article into data-raw/.
// Run `node scripts/parse-squads.mjs` afterwards to regenerate public/*.json.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data-raw", "squads.wikitext");
const URL = "https://en.wikipedia.org/w/index.php?title=2026_FIFA_World_Cup_squads&action=raw";

const res = await fetch(URL, { headers: { "User-Agent": "f26-quiz/1.0 (squad data fetch)" } });
if (!res.ok) throw new Error(`HTTP ${res.status} fetching squads wikitext`);
const text = await res.text();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(text.length / 1024).toFixed(0)} KB)`);
