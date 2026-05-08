// Usage:
//   node src/index.js [CIK] [YEAR]
//
// Example:
//   node src/index.js 0002012383 2023

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getEdgarFilings, getEdgarHoldings } from "./edgar.js";
import { totalValueUSD, printSummary, groupByCusip } from "./analytics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "../public/data");

const BLACKROCK_CIK = "0002012383";
const OLD_BLACKROCK_CIK = "0001364742";

const CIK         = process.argv[2] || BLACKROCK_CIK;
const TARGET_YEAR = process.argv[3] ? parseInt(process.argv[3]) : null;

async function main() {
  console.log(`Fetching 13F holdings for CIK ${CIK}...\n`);

  const filings = await getEdgarFilings(CIK, TARGET_YEAR);
  const latest  = filings.find((f) => f.form === "13F-HR") || filings[0];

  const { reportDate, filingDate, form } = latest;
  console.log(`  Found: ${form} filed ${filingDate} (period: ${reportDate})`);

  const rawHoldings = await getEdgarHoldings(CIK, latest.accessionNumber);
  console.log(`  ✓ EDGAR: ${rawHoldings.length} raw holdings parsed`);

  const sole = rawHoldings.filter(h => h.investDisc === "SOLE" && !h.putCall);
  if (sole.length < rawHoldings.length)
    console.log(`  ✓ Filtered: dropped ${rawHoldings.length - sole.length} SHARED/DFND/options entries`);

  const holdings = groupByCusip(sole);
  console.log(`  ✓ Grouped: ${holdings.length} unique CUSIPs`);

  printSummary(CIK, reportDate, holdings);

  mkdirSync(DATA_DIR, { recursive: true });

  const output = {
    cik:             CIK,
    date:            reportDate,
    fetched:         new Date().toISOString(),
    total_positions: holdings.length,
    total_value_usd: totalValueUSD(holdings),
    holdings,
  };

  const outFile = join(DATA_DIR, `holdings_${CIK}_${reportDate}.json`);
  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`\n✓ Saved → ${outFile}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
