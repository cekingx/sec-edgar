// ============================================================
// BlackRock 13F Holdings Fetcher — Node.js
// ============================================================
// Tries FMP first, falls back to SEC EDGAR (always free).
//
// Usage:
//   node blackrock13f.js                     → EDGAR fallback
//   FMP_API_KEY=your_key node blackrock13f.js → FMP first
//
// Output: prints top 20 + saves blackrock_holdings.json
// ============================================================

import { parseStringPromise } from "xml2js";
import { writeFileSync } from "fs";

const BLACKROCK_CIK = "0002012383";
const SEC_HEADERS   = { "User-Agent": "your-name your-email@example.com" };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

// ══════════════════════════════════════════════════════════════════════════════
// PATH 2 — SEC EDGAR direct (always free, 10 req/sec limit)
// ══════════════════════════════════════════════════════════════════════════════

async function getEdgarFilings(cik) {
  // EDGAR wants CIK zero-padded to 10 digits
  const cikPadded = cik.replace(/^0+/, "").padStart(10, "0");
  const url  = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
  const data = await fetchJSON(url, SEC_HEADERS);

  const recent = data.filings.recent;
  const filings = [];

  recent.form.forEach((form, i) => {
    if (form === "13F-HR" || form === "13F-HR/A") {
      filings.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate:      recent.filingDate[i],
        reportDate:      recent.reportDate[i],
        form,
      });
    }
  });

  return filings;
}

async function getEdgarHoldings(cik, accessionNumber) {
  const cikClean = cik.replace(/^0+/, "");
  const accClean = accessionNumber.replace(/-/g, "");

  // 1. Fetch the filing index page to locate the XML info table
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikClean}/${accClean}/${accessionNumber}-index.htm`;
  const indexHtml = await fetchText(indexUrl, SEC_HEADERS);

  // 2. Find XML file — exclude xsl-rendered versions (HTML masquerading as .xml)
  const xmlMatches = [...indexHtml.matchAll(/href="([^"]*\.xml)"/gi)]
    .map((m) => m[1])
    .filter((p) => !p.toLowerCase().includes("xsl"));
  let xmlPath = xmlMatches.find(
    (p) => p.toLowerCase().includes("infotable") || p.toLowerCase().includes("form13f")
  ) || xmlMatches[0];

  if (!xmlPath) throw new Error(`No XML found in filing index: ${accessionNumber}`);

  const xmlUrl  = xmlPath.startsWith("http") ? xmlPath : `https://www.sec.gov${xmlPath}`;
  const xmlText = await fetchText(xmlUrl, SEC_HEADERS);

  return parseInfoTableXml(xmlText);
}

async function parseInfoTableXml(xmlText) {
  const parsed = await parseStringPromise(xmlText, { explicitArray: false, ignoreAttrs: true });

  // The root element varies: informationTable or ns1:informationTable etc.
  const root = parsed["informationTable"] ||
    parsed[Object.keys(parsed).find((k) => k.includes("informationTable"))];

  if (!root) throw new Error("Could not find informationTable root in XML");

  const entries = root["infoTable"] || root[Object.keys(root).find((k) => k.includes("infoTable"))];
  const arr     = Array.isArray(entries) ? entries : [entries];

  return arr.map((e) => ({
    issuer:      e["nameOfIssuer"]          || "",
    cusip:       e["cusip"]                 || "",
    class:       e["titleOfClass"]          || "",
    value_1000s: parseInt(e["value"] || 0), // stored in $thousands by SEC
    shares:      parseInt(e["shrsOrPrnAmt"]?.["sshPrnamt"] || 0),
    investDisc:  e["investmentDiscretion"]  || "",
    putCall:     e["putCall"]               || "",
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Analytics
// ══════════════════════════════════════════════════════════════════════════════

function topHoldings(holdings, n = 20) {
  return [...holdings]
    .sort((a, b) => (b.value_1000s || b.value || 0) - (a.value_1000s || a.value || 0))
    .slice(0, n);
}

function totalValueUSD(holdings) {
  const total = holdings.reduce((sum, h) => sum + (h.value_1000s || h.value || 0), 0);
  return total * 1000; // SEC stores in $thousands
}

function printSummary(date, holdings) {
  const top   = topHoldings(holdings, 20);
  const total = totalValueUSD(holdings);

  console.log("\n" + "=".repeat(70));
  console.log(`  BlackRock 13F Holdings — ${date}`);
  console.log(`  Total positions : ${holdings.length.toLocaleString()}`);
  console.log(`  Total equity    : $${(total / 1e12).toFixed(2)}T`);
  console.log("=".repeat(70));
  console.log(
    "Rank".padEnd(6) +
    "Issuer".padEnd(36) +
    "Value ($M)".padStart(12) +
    "Shares".padStart(18)
  );
  console.log("-".repeat(74));

  top.forEach((h, i) => {
    const issuer  = (h.issuer || h.nameOfIssuer || "").slice(0, 35).padEnd(35);
    const val     = (h.value_1000s || h.value || 0);
    const valM    = (val / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 });
    const shares  = (h.shares || 0).toLocaleString();
    console.log(
      `${String(i + 1).padEnd(6)}${issuer} ${valM.padStart(11)}  ${shares.padStart(16)}`
    );
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("Fetching BlackRock 13F holdings...\n");
  let date, holdings;

  console.log("Trying SEC EDGAR...");
  const filings = await getEdgarFilings(BLACKROCK_CIK);

  // Prefer original filing over amendment; use most recent
  const latest = filings.find((f) => f.form === "13F-HR") || filings[0];
  date = latest.reportDate;
  console.log(`  Found: ${latest.form} filed ${latest.filingDate} (period: ${date})`);

  holdings = await getEdgarHoldings(BLACKROCK_CIK, latest.accessionNumber);
  console.log(`  ✓ EDGAR: ${holdings.length} holdings parsed`);

  // --- Output ---
  printSummary(date, holdings);

  const output = {
    fund:     "BlackRock",
    cik:      BLACKROCK_CIK,
    date,
    fetched:  new Date().toISOString(),
    total_positions: holdings.length,
    total_value_usd: totalValueUSD(holdings),
    holdings,
  };

  writeFileSync("blackrock_holdings.json", JSON.stringify(output, null, 2));
  console.log("\n✓ Saved → blackrock_holdings.json");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
