import { readFileSync, writeFileSync } from "fs";
import { resolve, basename } from "path";

function parseNumber(str) {
  if (!str || str === "-") return null;
  return parseFloat(str.replace(/,/g, ""));
}

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

export function parseISharesCsv(csvText) {
  const lines = csvText.split(/\r?\n/);

  const meta = {
    fund: lines[0]?.trim() || "",
    date: null,
    inception_date: null,
    shares_outstanding: null,
    stock_pct: null,
    bond_pct: null,
    cash_pct: null,
    other_pct: null,
  };

  let headerRowIdx = -1;
  let columns = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);

    if (fields[0] === "Fund Holdings as of") {
      meta.date = fields[1] || null;
    } else if (fields[0] === "Inception Date") {
      meta.inception_date = fields[1] || null;
    } else if (fields[0] === "Shares Outstanding") {
      meta.shares_outstanding = parseNumber(fields[1]);
    } else if (fields[0] === "Stock") {
      meta.stock_pct = parseNumber(fields[1]);
    } else if (fields[0] === "Bond") {
      meta.bond_pct = parseNumber(fields[1]);
    } else if (fields[0] === "Cash") {
      meta.cash_pct = parseNumber(fields[1]);
    } else if (fields[0] === "Other") {
      meta.other_pct = parseNumber(fields[1]);
    } else if (fields[0] === "Ticker") {
      columns = fields.map(f => f.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, ""));
      headerRowIdx = i;
      break;
    }
  }

  const holdings = [];
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (!fields[0] || fields[0].length > 20) break; // hit disclaimer text

    const row = {};
    columns.forEach((col, idx) => {
      row[col] = fields[idx] ?? "";
    });

    holdings.push({
      ticker: row["ticker"] || "",
      name: row["name"] || "",
      sector: row["sector"] || "",
      asset_class: row["asset_class"] || "",
      market_value: parseNumber(row["market_value"]),
      weight_pct: parseNumber(row["weight"]),
      notional_value: parseNumber(row["notional_value"]),
      quantity: parseNumber(row["quantity"]),
      currency: row["market_currency"] || "",
    });
  }

  const total_market_value = holdings.reduce((s, h) => s + (h.market_value || 0), 0);

  return {
    fund: meta.fund,
    date: meta.date,
    inception_date: meta.inception_date,
    shares_outstanding: meta.shares_outstanding,
    allocation: {
      stock: meta.stock_pct,
      bond: meta.bond_pct,
      cash: meta.cash_pct,
      other: meta.other_pct,
    },
    total_market_value,
    holdings_count: holdings.length,
    holdings,
    parsed_at: new Date().toISOString(),
  };
}

// CLI entry point
if (process.argv[1] && basename(process.argv[1]) === "ishares-parser.js") {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error("Usage: node src/ishares-parser.js <input.csv> [output.json]");
    process.exit(1);
  }

  const csv = readFileSync(resolve(inputPath), "utf8");
  const result = parseISharesCsv(csv);

  if (outputPath) {
    writeFileSync(resolve(outputPath), JSON.stringify(result, null, 2));
    console.log(`Written to ${outputPath}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
