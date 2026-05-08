import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseISharesCsv, parseISharesBondCsv } from "./ishares-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "../public/data");
const config    = JSON.parse(readFileSync(join(__dirname, "ishare.json"), "utf8"));

async function fetchCsv(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  for (const [ticker, url] of Object.entries(config)) {
    process.stdout.write(`Fetching ${ticker}... `);
    const csv    = await fetchCsv(url);
    const isBond = csv.split(/\r?\n/).slice(1, 15).some(l => l.startsWith("Name,"));
    const result = isBond ? parseISharesBondCsv(csv) : parseISharesCsv(csv);
    const outFile = join(DATA_DIR, `${ticker.toLowerCase()}_holdings.json`);
    writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`✓ ${result.holdings_count} holdings (showing ${result.holdings.length}) → ${outFile}`);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
