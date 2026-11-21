// Rule-of-thumb solar sizing used when qualifying a lead.
// 1 kW rooftop ~ 4 units/day ~ 120 units/month; average tariff ~ Rs 8/unit; ~ 100 sq.ft per kW.
const TARIFF_PER_UNIT = 8;
const UNITS_PER_KW_MONTH = 120;
const SQFT_PER_KW = 100;
const MIN_KW = 1;
const MAX_KW = 5; // Phase-1 templates cover 1-5 kW

function suggestKw({ monthlyUnits, monthlyBill, roofAreaSqft, sanctionedLoadKw }) {
  const units = monthlyUnits ?? (monthlyBill ? monthlyBill / TARIFF_PER_UNIT : null);
  if (!units) return { suggestedKw: null, basis: null };

  const byConsumption = units / UNITS_PER_KW_MONTH;
  const limits = [byConsumption];
  if (roofAreaSqft) limits.push(roofAreaSqft / SQFT_PER_KW);
  if (sanctionedLoadKw) limits.push(sanctionedLoadKw);

  const raw = Math.min(...limits);
  const suggestedKw = Math.min(MAX_KW, Math.max(MIN_KW, Math.round(raw)));
  return {
    suggestedKw,
    basis: {
      monthlyUnits: Math.round(units),
      byConsumptionKw: Number(byConsumption.toFixed(2)),
      roofLimitKw: roofAreaSqft ? Number((roofAreaSqft / SQFT_PER_KW).toFixed(2)) : null,
      sanctionedLoadKw: sanctionedLoadKw ?? null,
    },
  };
}

module.exports = { suggestKw, TARIFF_PER_UNIT, UNITS_PER_KW_MONTH, SQFT_PER_KW };
