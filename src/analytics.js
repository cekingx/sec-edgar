export function groupByCusip(holdings) {
  const byKey = {};
  holdings.forEach(h => {
    const key = h.cusip || h.issuer;
    if (!byKey[key]) byKey[key] = { ...h, value_1000s: 0, shares: 0 };
    byKey[key].value_1000s += h.value_1000s || 0;
    byKey[key].shares += h.shares || 0;
  });
  return Object.values(byKey);
}

export function topHoldings(holdings, n = 20) {
  return groupByCusip(holdings)
    .sort((a, b) => (b.value_1000s || 0) - (a.value_1000s || 0))
    .slice(0, n);
}

export function totalValueUSD(holdings) {
  return holdings.reduce((sum, h) => sum + (h.value_1000s || 0), 0) * 1000;
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
    const valM   = (h.value_1000s / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 });
    const shares = h.shares.toLocaleString();
    console.log(
      `${String(i + 1).padEnd(6)}${issuer} ${valM.padStart(11)}  ${shares.padStart(16)}`
    );
  });
}
