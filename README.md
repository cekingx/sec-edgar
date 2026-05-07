# sec-edgar Holdings Viewer

Fetch and visualize institutional investment disclosures from SEC EDGAR. Parses 13F-HR filings (e.g. BlackRock) and iShares ETF CSV exports into a static web dashboard.

## Requirements

- Node.js 18+

## Usage

**Fetch 13F holdings for a CIK and year:**

```bash
node src/index.js <CIK> <YEAR>
# e.g. node src/index.js 0002012383 2025
```

Output is written to `public/data/holdings_{CIK}_{date}.json`.

**Parse an iShares ETF CSV export:**

```bash
node src/ishares-parser.js IBIT_holdings.csv public/data/ibit_holdings.json
node src/ishares-parser.js ETHA_holdings.csv public/data/etha_holdings.json
```

iShares CSV files must be downloaded manually from the iShares website.

**Serve the web viewer:**

```bash
npm run serve
# Open http://localhost:3000
```

## Project Structure

```
src/
  index.js          # CLI entry point
  edgar.js          # SEC EDGAR API client
  parser.js         # 13F XML parser
  analytics.js      # Aggregation functions
  ishares-parser.js # iShares CSV parser
public/
  index.html        # Static web viewer
  data/             # Generated JSON files
```

## Notes

- No database or server required — all data is stored as JSON files.
- SEC EDGAR requires a `User-Agent` header identifying the requester. Update the placeholder in `src/edgar.js` before use.
- See `docs/technical-architecture.md` for a full system overview.
