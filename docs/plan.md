# Plan — 4-Quarter Position Change Tracker

## Goal

Fetch the 4 most recent 13F-HR filings for a given CIK, identify the top 20 holdings by value in the latest quarter, and show how shares and value have changed across all 4 quarters. Output is a new JSON file consumed by a new web UI tab with color-coded deltas.

---

## Agreed Design Decisions

| Decision | Choice |
|---|---|
| Metrics | Shares delta + value delta |
| Quarter range | Most recent 4 available 13F-HR filings |
| Output | New JSON file + new web UI tab |
| Key positions | Top 20 by value from the most recent quarter only |
| Missing quarters | `null` for shares/value; delta is `0` |
| CLI entry point | New file `src/quarterly.js` |
| Web UI | Color-coded deltas — green = increase, red = decrease |

---

## Output JSON Schema

File: `public/data/quarterly_changes_{CIK}.json`

```json
{
  "cik": "0002012383",
  "generated": "2025-01-01T00:00:00.000Z",
  "quarters": ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"],
  "holdings": [
    {
      "cusip": "...",
      "issuer": "...",
      "quarters": [
        { "date": "2024-03-31", "shares": 1000, "value_1000s": 5000 },
        { "date": "2024-06-30", "shares": 1200, "value_1000s": 6100 },
        { "date": "2024-09-30", "shares": null, "value_1000s": null },
        { "date": "2024-12-31", "shares": 1500, "value_1000s": 7800 }
      ],
      "deltas": [
        { "shares": 200, "value_1000s": 1100 },
        { "shares": 0, "value_1000s": 0 },
        { "shares": 0, "value_1000s": 0 }
      ]
    }
  ]
}
```

`deltas[i]` is the change from `quarters[i]` to `quarters[i+1]`. `0` when either side is missing.

---

## Implementation Steps

### Step 1 — Extend `src/edgar.js`

Add a new exported function `getLatestNFilings(cik, n = 4)` that:
- Fetches the submissions JSON for the CIK
- Extracts all 13F-HR filings (paginating into archive batches if needed)
- Sorts by `reportDate` descending
- Returns the top `n` filings (metadata only — accession numbers + dates)

The existing `getEdgarFilings` and `getEdgarHoldings` remain unchanged.

### Step 2 — Add delta logic to `src/analytics.js`

Add two new exported functions:

**`buildQuarterlyChanges(filingsData, top20Cusips)`**
- `filingsData`: array of `{ date, holdings }` objects sorted oldest → newest
- `top20Cusips`: array of CUSIP strings from the most recent quarter
- For each CUSIP in `top20Cusips`, look up shares and value_1000s in each quarter (null if not present)
- Compute `deltas` array: `deltas[i] = quarters[i+1] - quarters[i]`, `0` if either side is null
- Returns the holdings array ready for JSON output

**`top20Cusips(holdings)`**
- Takes a grouped holdings array
- Sorts by value_1000s descending
- Returns array of the top 20 CUSIP strings

### Step 3 — Create `src/quarterly.js`

New CLI entry point:

```
node src/quarterly.js [CIK]
```

Pipeline:
1. Call `getLatestNFilings(cik, 4)` → array of 4 filing metadata objects
2. For each filing, call `getEdgarHoldings` then `groupByCusip` → `{ date, holdings }`
3. Identify `top20Cusips` from the most recent quarter's holdings
4. Call `buildQuarterlyChanges(filingsData, top20Cusips)` → structured holdings array
5. Print a summary table to stdout
6. Write `public/data/quarterly_changes_{CIK}.json`

### Step 4 — Add web UI tab to `public/index.html`

Add a "Quarterly Changes" tab alongside the existing tabs.

Table layout:
- Rows: 20 holdings (issuer name + CUSIP)
- Columns: one pair (shares, value) per quarter + delta columns between quarters
- Delta cells: green background for positive, red for negative, plain for null

The tab loads `quarterly_changes_{CIK}.json` on first click (lazy load, same pattern as existing tabs).

---

## Files Changed

| File | Change |
|---|---|
| `src/edgar.js` | Add `getLatestNFilings` |
| `src/analytics.js` | Add `top20Cusips`, `buildQuarterlyChanges` |
| `src/quarterly.js` | New file — CLI entry point |
| `public/index.html` | New "Quarterly Changes" tab |

No existing behavior is modified.
