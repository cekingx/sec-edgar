export function groupByCusip(holdings) {
  const byKey = {};
  holdings.forEach(h => {
    const key = h.cusip || h.issuer;
    if (!byKey[key]) byKey[key] = { ...h, value_usd: 0, shares: 0 };
    byKey[key].value_usd += h.value_usd || 0;
    byKey[key].shares += h.shares || 0;
  });
  return Object.values(byKey);
}

export function topHoldings(holdings, n = 20) {
  return groupByCusip(holdings)
    .sort((a, b) => (b.value_usd || 0) - (a.value_usd || 0))
    .slice(0, n);
}

export function totalValueUSD(holdings) {
  return holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);
}

export function top20Cusips(holdings) {
  return [...holdings]
    .sort((a, b) => (b.value_usd || 0) - (a.value_usd || 0))
    .slice(0, 20)
    .map(h => h.cusip || h.issuer);
}

export function buildQuarterlyChanges(filingsData, top20CusipList) {
  const dates = filingsData.map(f => f.date);

  return top20CusipList.map(cusip => {
    const issuer = filingsData
      .map(f => f.holdings.find(h => (h.cusip || h.issuer) === cusip))
      .find(h => h)?.issuer || cusip;

    const quarters = dates.map(date => {
      const filing = filingsData.find(f => f.date === date);
      const h = filing?.holdings.find(h => (h.cusip || h.issuer) === cusip);
      return {
        date,
        shares:      h ? (h.shares      ?? null) : null,
        value_usd: h ? (h.value_usd ?? null) : null,
      };
    });

    const deltas = quarters.slice(0, -1).map((q, i) => {
      const next = quarters[i + 1];
      const sharesNull  = q.shares      === null || next.shares      === null;
      const valueNull   = q.value_usd === null || next.value_usd === null;
      return {
        shares:      sharesNull ? 0 : next.shares      - q.shares,
        value_usd: valueNull  ? 0 : next.value_usd - q.value_usd,
      };
    });

    return { cusip, issuer, quarters, deltas };
  });
}

export function printSummary(fund, date, holdings) {
  const top   = topHoldings(holdings, 20);
  const total = totalValueUSD(holdings);

  console.log("\n" + "=".repeat(70));
  console.log(`  ${fund} 13F Holdings — ${date}`);
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
    const issuer = (h.issuer || "").slice(0, 35).padEnd(35);
    const valM   = (h.value_usd / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 });
    const shares = h.shares.toLocaleString();
    console.log(
      `${String(i + 1).padEnd(6)}${issuer} ${valM.padStart(11)}  ${shares.padStart(16)}`
    );
  });
}
