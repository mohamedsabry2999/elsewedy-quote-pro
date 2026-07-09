// Pricing engines for digital and offset. Numbers are best-effort estimates
// consumed by the wizard UI; admins tune the base rates in pricing_rules.

export interface RuleMap { [key: string]: number }

export function ruleMap(rows: { category: string; key: string; value: number }[]): RuleMap {
  const map: RuleMap = {};
  rows.forEach((r) => { map[`${r.category}.${r.key}`] = Number(r.value); });
  return map;
}

export interface DigitalInput {
  sheetSize: "50x70" | "33x48" | "custom";
  copiesPerSheet: number;
  quantity: number;
  paperKey: string; // pricing_rules key e.g. coated_300gsm
  printingSides: 1 | 2;
  colors: 1 | 4;
  specialInks: number;      // count of pantone spot inks
  finishingKeys: string[];  // e.g. ["matte_lam","spot_uv"]
  wastePctOverride?: number;
  marginPct: number;
  discountPct: number;
}

export interface PricingBreakdown {
  paperCost: number;
  printingCost: number;
  finishingCost: number;
  specialInkCost: number;
  wasteCost: number;
  setupCost: number;
  totalCost: number;
  profit: number;
  subtotal: number;
  discount: number;
  finalPrice: number;
  sheetsNeeded: number;
  wastePct: number;
}

export function calcDigital(input: DigitalInput, rules: RuleMap): PricingBreakdown {
  const wastePct = input.wastePctOverride ?? rules["waste.digital_pct"] ?? 3;
  const baseSheets = Math.ceil(input.quantity / Math.max(1, input.copiesPerSheet));
  const sheetsNeeded = Math.ceil(baseSheets * (1 + wastePct / 100));

  const paperCostPerSheet = (rules[`paper.${input.paperKey}`] ?? 100) / 500; // ream = 500 sheets
  const paperCost = paperCostPerSheet * sheetsNeeded;

  const clickRate = input.colors === 4 ? (rules["printing.digital_click_4c"] ?? 0.9) : (rules["printing.digital_click_1c"] ?? 0.35);
  const clicks = sheetsNeeded * input.printingSides;
  const printingCost = clicks * clickRate;

  const specialInkCost = input.specialInks * 45; // per-color small run allowance
  const finishingCost = input.finishingKeys.reduce((sum, k) => sum + (rules[`finishing.${k}`] ?? 0) * sheetsNeeded, 0);
  const setupCost = 120;
  const wasteCost = (paperCost + printingCost) * 0 + 0; // waste already baked into sheetsNeeded

  const totalCost = paperCost + printingCost + specialInkCost + finishingCost + setupCost + wasteCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;

  return { paperCost, printingCost, finishingCost, specialInkCost, wasteCost, setupCost, totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded, wastePct };
}

export interface OffsetInput {
  quantity: number;
  copiesPerSheet: number;
  paperKey: string;
  colors: number;             // number of colors (plates per side)
  printingSides: 1 | 2;
  finishingKeys: string[];
  wastePctOverride?: number;
  marginPct: number;
  discountPct: number;
}

export function calcOffset(input: OffsetInput, rules: RuleMap): PricingBreakdown {
  const wastePct = input.wastePctOverride ?? rules["waste.offset_pct"] ?? 5;
  const baseSheets = Math.ceil(input.quantity / Math.max(1, input.copiesPerSheet));
  const makeReadyWaste = 250 * input.colors * input.printingSides;
  const sheetsNeeded = Math.ceil(baseSheets * (1 + wastePct / 100)) + makeReadyWaste;

  const paperCost = ((rules[`paper.${input.paperKey}`] ?? 100) / 500) * sheetsNeeded;
  const plateCost = (rules["printing.offset_plate"] ?? 350) * input.colors * input.printingSides;
  const setupCost = rules["printing.offset_makeready"] ?? 450;
  const runCost = (sheetsNeeded / 1000) * (rules["printing.offset_runcost_1000"] ?? 180) * input.colors * input.printingSides;
  const printingCost = plateCost + runCost;
  const finishingCost = input.finishingKeys.reduce((s, k) => s + (rules[`finishing.${k}`] ?? 0) * sheetsNeeded, 0);
  const wasteCost = 0;
  const specialInkCost = 0;

  const totalCost = paperCost + printingCost + finishingCost + setupCost + wasteCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;

  return { paperCost, printingCost, finishingCost, specialInkCost, wasteCost, setupCost, totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded, wastePct };
}
