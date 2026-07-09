// Pricing engines. Numbers are best-effort estimates consumed by the wizard.
// Admins tune the base rates in `pricing_rules` (see /pricing and /finishing).

export interface RuleMap { [key: string]: number }

export function ruleMap(rows: { category: string; key: string; value: number }[]): RuleMap {
  const map: RuleMap = {};
  rows.forEach((r) => { map[`${r.category}.${r.key}`] = Number(r.value); });
  return map;
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

/* ============================== Digital ============================== */

export interface DigitalInput {
  sheetSize: "50x70" | "33x48" | "custom";
  copiesPerSheet: number;
  quantity: number;
  paperKey: string;
  printingSides: 1 | 2;
  colors: 1 | 4;
  specialInks: number;
  finishingKeys: string[];
  wastePctOverride?: number;
  marginPct: number;
  discountPct: number;
}

export function calcDigital(input: DigitalInput, rules: RuleMap): PricingBreakdown {
  const wastePct = input.wastePctOverride ?? rules["waste.digital_pct"] ?? 3;
  const baseSheets = Math.ceil(input.quantity / Math.max(1, input.copiesPerSheet));
  const sheetsNeeded = Math.ceil(baseSheets * (1 + wastePct / 100));

  const paperCostPerSheet = (rules[`paper.${input.paperKey}`] ?? 100) / 500;
  const paperCost = paperCostPerSheet * sheetsNeeded;

  const clickRate = input.colors === 4 ? (rules["printing.digital_click_4c"] ?? 0.9) : (rules["printing.digital_click_1c"] ?? 0.35);
  const clicks = sheetsNeeded * input.printingSides;
  const printingCost = clicks * clickRate;

  const specialInkCost = input.specialInks * 45;
  const finishingCost = input.finishingKeys.reduce((s, k) => s + (rules[`finishing.${k}`] ?? 0) * sheetsNeeded, 0);
  const setupCost = 120;
  const wasteCost = 0;

  const totalCost = paperCost + printingCost + specialInkCost + finishingCost + setupCost + wasteCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;

  return { paperCost, printingCost, finishingCost, specialInkCost, wasteCost, setupCost, totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded, wastePct };
}

/* ============================== Offset ============================== */

export interface OffsetInput {
  quantity: number;
  copiesPerSheet: number;
  paperKey: string;
  colors: number;
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

  const totalCost = paperCost + printingCost + finishingCost + setupCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;

  return { paperCost, printingCost, finishingCost, specialInkCost: 0, wasteCost: 0, setupCost, totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded, wastePct };
}

/* ============================== Packaging (Folding cartons) ============================== */

export interface PackagingInput {
  quantity: number;
  boxLengthCm: number;   // L
  boxWidthCm: number;    // W
  boxHeightCm: number;   // H
  boardKey: string;      // pricing_rules paper.* key (board)
  colors: number;
  printingSides: 1 | 2;
  finishingKeys: string[];
  hasDieCut: boolean;
  hasGluing: boolean;
  wastePctOverride?: number;
  marginPct: number;
  discountPct: number;
}

export function calcPackaging(input: PackagingInput, rules: RuleMap): PricingBreakdown {
  // Approximate unfolded blank area (a very common straight-tuck / reverse-tuck estimate):
  // area ≈ (2L + 2W + tab) * (H + 2W + flaps). We simplify to (2L+2W+3) * (H+2W+4).
  const blankLenCm = 2 * input.boxLengthCm + 2 * input.boxWidthCm + 3;
  const blankHeiCm = input.boxHeightCm + 2 * input.boxWidthCm + 4;
  const blankAreaCm2 = Math.max(50, blankLenCm * blankHeiCm);

  // Fit into a 70x100 offset sheet (700x1000 mm ≈ 70x100 cm) with 1cm gutter.
  const sheetL = 100, sheetW = 70;
  const upsL = Math.max(1, Math.floor(sheetL / (blankLenCm + 1)));
  const upsW = Math.max(1, Math.floor(sheetW / (blankHeiCm + 1)));
  const copiesPerSheet = Math.max(1, upsL * upsW);

  const wastePct = input.wastePctOverride ?? rules["waste.packaging_pct"] ?? rules["waste.offset_pct"] ?? 6;
  const baseSheets = Math.ceil(input.quantity / copiesPerSheet);
  const makeReady = 300 * input.colors * input.printingSides;
  const sheetsNeeded = Math.ceil(baseSheets * (1 + wastePct / 100)) + makeReady;

  const paperCost = ((rules[`paper.${input.boardKey}`] ?? 180) / 500) * sheetsNeeded;
  const plateCost = (rules["printing.offset_plate"] ?? 350) * input.colors * input.printingSides;
  const runCost = (sheetsNeeded / 1000) * (rules["printing.offset_runcost_1000"] ?? 180) * input.colors * input.printingSides;
  const dieCutCost = input.hasDieCut ? (rules["finishing.die_cut"] ?? 0.35) * sheetsNeeded + (rules["printing.die_setup"] ?? 800) : 0;
  const gluingCost = input.hasGluing ? (rules["finishing.gluing"] ?? 0.2) * input.quantity : 0;
  const finishingCost = input.finishingKeys.reduce((s, k) => s + (rules[`finishing.${k}`] ?? 0) * sheetsNeeded, 0) + dieCutCost + gluingCost;
  const printingCost = plateCost + runCost;
  const setupCost = rules["printing.offset_makeready"] ?? 450;

  const totalCost = paperCost + printingCost + finishingCost + setupCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;

  return { paperCost, printingCost, finishingCost, specialInkCost: 0, wasteCost: 0, setupCost, totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded, wastePct };
}

/* ============================== Labels / Stickers ============================== */

export interface LabelsInput {
  quantity: number;
  labelWidthMm: number;
  labelHeightMm: number;
  materialKey: string;   // pricing_rules paper.* (label stock)
  method: "digital" | "flexo";
  colors: number;
  laminateKey?: string;  // finishing.* (e.g. gloss_lam)
  hasDieCut: boolean;
  form: "roll" | "sheet";
  wastePctOverride?: number;
  marginPct: number;
  discountPct: number;
}

export function calcLabels(input: LabelsInput, rules: RuleMap): PricingBreakdown {
  const areaM2PerLabel = (input.labelWidthMm * input.labelHeightMm) / 1_000_000;
  const wastePct = input.wastePctOverride ?? rules["waste.labels_pct"] ?? 4;
  const totalAreaM2 = areaM2PerLabel * input.quantity * (1 + wastePct / 100);

  const materialRate = rules[`paper.${input.materialKey}`] ?? rules["paper.label_pp_white"] ?? 55; // per m²
  const paperCost = totalAreaM2 * materialRate;

  const clickRate = input.method === "digital"
    ? (rules["printing.label_digital_m2"] ?? 22)
    : (rules["printing.label_flexo_m2"] ?? 9);
  const plateCost = input.method === "flexo" ? (rules["printing.flexo_plate"] ?? 220) * input.colors : 0;
  const printingCost = totalAreaM2 * clickRate * Math.max(1, input.colors / 4) + plateCost;

  const laminateCost = input.laminateKey ? (rules[`finishing.${input.laminateKey}`] ?? 0) * totalAreaM2 * 500 : 0;
  const dieSetup = input.hasDieCut ? (rules["printing.label_die"] ?? 350) : 0;
  const finishingCost = laminateCost + dieSetup;
  const setupCost = rules["printing.label_setup"] ?? 180;

  const sheetsNeeded = input.form === "roll" ? Math.ceil(totalAreaM2 * 100) / 100 : Math.ceil(totalAreaM2 * 5);

  const totalCost = paperCost + printingCost + finishingCost + setupCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;

  return { paperCost, printingCost, finishingCost, specialInkCost: 0, wasteCost: 0, setupCost, totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded, wastePct };
}

/* ============================== Finishing-only service ============================== */

export interface FinishingOnlyInput {
  sheetsCount: number;
  finishingKeys: string[];
  marginPct: number;
  discountPct: number;
}

export function calcFinishingOnly(input: FinishingOnlyInput, rules: RuleMap): PricingBreakdown {
  const finishingCost = input.finishingKeys.reduce((s, k) => s + (rules[`finishing.${k}`] ?? 0) * input.sheetsCount, 0);
  const setupCost = (rules["finishing.setup"] ?? 150) * Math.max(1, input.finishingKeys.length);
  const totalCost = finishingCost + setupCost;
  const profit = totalCost * (input.marginPct / 100);
  const subtotal = totalCost + profit;
  const discount = subtotal * (input.discountPct / 100);
  const finalPrice = subtotal - discount;
  return {
    paperCost: 0, printingCost: 0, finishingCost, specialInkCost: 0, wasteCost: 0, setupCost,
    totalCost, profit, subtotal, discount, finalPrice, sheetsNeeded: input.sheetsCount, wastePct: 0,
  };
}
