import { parseInfoTableXml } from "./parser.js";

const SEC_HEADERS = { "User-Agent": "your-name your-email@example.com" };

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

function extractFilings(batch) {
  const filings = [];
  batch.form.forEach((form, i) => {
    if (form === "13F-HR" || form === "13F-HR/A") {
      filings.push({
        accessionNumber: batch.accessionNumber[i],
        filingDate:      batch.filingDate[i],
        reportDate:      batch.reportDate[i],
        form,
      });
    }
  });
  return filings;
}

export async function getEdgarFilings(cik, targetYear = null) {
  const cikPadded = cik.replace(/^0+/, "").padStart(10, "0");
  const url  = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
  const data = await fetchJSON(url, SEC_HEADERS);

  let filings = extractFilings(data.filings.recent);

  if (targetYear && !filings.some(f => f.reportDate.startsWith(String(targetYear)))) {
    for (const file of (data.filings.files || [])) {
      const archiveUrl = `https://data.sec.gov/submissions/${file.name}`;
      const archive = await fetchJSON(archiveUrl, SEC_HEADERS);
      const batch = extractFilings(archive);
      filings = filings.concat(batch);
      if (batch.some(f => f.reportDate.startsWith(String(targetYear)))) break;
    }
  }

  if (targetYear) {
    filings = filings.filter(f => f.reportDate.startsWith(String(targetYear)));
  }

  return filings;
}

export async function getEdgarHoldings(cik, accessionNumber) {
  const cikClean = cik.replace(/^0+/, "");
  const accClean = accessionNumber.replace(/-/g, "");

  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikClean}/${accClean}/${accessionNumber}-index.htm`;
  const indexHtml = await fetchText(indexUrl, SEC_HEADERS);

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
