// Usage:
//   node src/quarterly.js [CIK]
//
// Example:
//   node src/quarterly.js 0002012383

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getLatestNFilings, getEdgarHoldings } from "./edgar.js";
import { groupByCusip, top20Cusips, buildQuarterlyChanges } from "./analytics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "../public/data");

const BLACKROCK_CIK = "0002012383";
const CIK = process.argv[2] || BLACKROCK_CIK;

async function main() {
  console.log(`Fetching 4 most recent 13F-HR filings for CIK ${CIK}...\n`);

  const latestFilings = await getLatestNFilings(CIK, 4);
  console.log(`  Found ${latestFilings.length} filing(s):`);
  latestFilings.forEach(f => console.log(`    ${f.reportDate}  ${f.form}  filed ${f.filingDate}`));
  console.log();

  // Fetch oldest → newest so deltas read left-to-right chronologically
  const sorted = [...latestFilings].sort((a, b) => a.reportDate.localeCompare(b.reportDate));

  const filingsData = [];
  for (const filing of sorted) {
    console.log(`  Fetching holdings for ${filing.reportDate}…`);
    const raw = await getEdgarHoldings(CIK, filing.accessionNumber);
    const holdings = groupByCusip(raw);
    console.log(`    ✓ ${raw.length} raw → ${holdings.length} unique CUSIPs`);
    filingsData.push({ date: filing.reportDate, holdings });
  }

  const mostRecent = filingsData[filingsData.length - 1];
  const cusips = top20Cusips(mostRecent.holdings);
  console.log(`\n  Top 20 CUSIPs from ${mostRecent.date}:`);
  cusips.forEach((c, i) => {
    const h = mostRecent.holdings.find(h => (h.cusip || h.issuer) === c);
    const valM = ((h?.value_1000s || 0) / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 });
    console.log(`    ${String(i + 1).padEnd(3)} ${c.padEnd(12)} ${(h?.issuer || "").slice(0, 36).padEnd(36)} $${valM}M`);
  });

  const holdings = buildQuarterlyChanges(filingsData, cusips);
  const quarters  = filingsData.map(f => f.date);

  const output = {
    cik: CIK,
    generated: new Date().toISOString(),
    quarters,
    holdings,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  const outFile = join(DATA_DIR, `quarterly_changes_${CIK}.json`);
  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`\n✓ Saved → ${outFile}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
