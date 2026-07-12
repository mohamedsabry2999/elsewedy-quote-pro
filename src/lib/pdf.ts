// Professional PDF export for Elsewedy quotations.
// Per-section rendering with smart pagination (no item split across pages
// unless a single item exceeds a full page), Latin digits, translated
// technical terms, and a pinned footer on every page.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import type { BrandSettings } from "./brand";

export interface QuotationPdfInput {
  quotation: any;
  customer: any;
  items: any[];
  brand: BrandSettings;
  variant: "customer" | "internal";
  salesRepName?: string | null;
}

/* ---------- formatting helpers ---------- */

// Latin digits so numbers never get mangled by html2canvas Arabic-Indic shaping.
const nfmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfmtInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const money = (v: number | null | undefined) => `${nfmt.format(Number(v ?? 0))} ج.م`;
const qty = (v: number | null | undefined) => nfmtInt.format(Number(v ?? 0));
const pct = (v: number | null | undefined) => `${nfmt.format(Number(v ?? 0))}%`;

const dateAr = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  // Latin digits to stay stable inside RTL content.
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

/* ---------- WhatsApp helpers (kept from previous module) ---------- */
export function whatsappMessage(customerName: string, quotationNumber: string, companyEn: string, egyptTz = "Africa/Cairo"): string {
  const now = new Date();
  const hourStr = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: egyptTz }).format(now);
  const hour = parseInt(hourStr, 10);
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  return `${greeting} أستاذ/ة ${customerName}\n\nمرفق لحضرتك عرض السعر الخاص بـ ${quotationNumber} من ${companyEn}.\n\nبرجاء المراجعة، ويسعدنا الرد على أي استفسار من حضرتك.\n\nتحياتنا،\n${companyEn}`;
}
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/* ---------- Arabic translations for internal codes ---------- */
const T: Record<string, string> = {
  // finishing
  gloss_lam: "سلوفان لامع",
  matte_lam: "سلوفان مطفي",
  spot_uv: "سبوت UV",
  uv_coating: "طلاء UV",
  cutting: "قص",
  die_cut: "قص خاص (داي كت)",
  folding: "طي",
  scoring: "خدش",
  perforation: "تخريم",
  spiral: "تجليد سلك",
  binding: "تجليد",
  stapling: "دبابيس",
  hot_foil: "طبع حراري",
  embossing: "بارز",
  packing: "تغليف",
  packaging: "تغليف",
  // category
  marketing: "تسويقي",
  digital: "ديجيتال",
  booklet: "كتيّب / كتالوج",
  packaging_cat: "تغليف",
  stationery: "مطبوعات إدارية",
  // material / paper
  coated_100gsm: "كوشيه 100 جم",
  coated_130gsm: "كوشيه 130 جم",
  coated_150gsm: "كوشيه 150 جم",
  coated_170gsm: "كوشيه 170 جم",
  coated_200gsm: "كوشيه 200 جم",
  coated_250gsm: "كوشيه 250 جم",
  coated_300gsm: "كوشيه 300 جم",
  coated_350gsm: "كوشيه 350 جم",
  matte_150gsm: "ماط 150 جم",
  matte_300gsm: "ماط 300 جم",
  offset_80gsm: "أوفست 80 جم",
  // sides
  "1": "وجه واحد",
  "2": "وجهان",
  // colors
  "CMYK 4/4": "4 ألوان / 4 ألوان",
  "CMYK 4/0": "4 ألوان / بدون",
};

const tr = (v: any): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return T[s] ?? s;
};

const trList = (arr: any): string => {
  if (!Array.isArray(arr)) return "";
  return arr.map(tr).join("، ");
};

/* ---------- constants for page geometry (pt) ---------- */
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN_X = 32;
const MARGIN_TOP = 32;
const FOOTER_H = 46; // reserved area for footer band + page number
const CONTENT_W = A4_W - MARGIN_X * 2;
const CONTENT_BOTTOM = A4_H - FOOTER_H; // usable y-limit
const SECTION_GAP = 8; // pt between rendered sections

/* ---------- shared stylesheet used inside the offscreen stage ---------- */
function stageStyles(primary: string, secondary: string, accent: string): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0;}
    .stage{font-family:'Cairo','Tajawal','Segoe UI',Arial,sans-serif;color:#1f2937;background:#fff;font-size:11.5px;line-height:1.55;direction:rtl;}
    .num{font-family:'Segoe UI',Arial,sans-serif;direction:ltr;unicode-bidi:isolate;display:inline-block;}
    .money{font-family:'Segoe UI',Arial,sans-serif;unicode-bidi:isolate;white-space:nowrap;}

    /* HEADER */
    .hero{padding:0 0 12px;border-bottom:3px solid ${primary};display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
    .hero .brand{display:flex;gap:12px;align-items:flex-start;flex:1;}
    .hero .brand img{max-height:70px;max-width:200px;object-fit:contain;}
    .hero .brand .name{font-size:20px;font-weight:800;color:${primary};letter-spacing:-.2px;}
    .hero .brand .name-en{font-size:11px;color:#6b7280;margin-top:2px;letter-spacing:.5px;}
    .hero .brand .meta{font-size:10px;color:#6b7280;margin-top:4px;line-height:1.5;}
    .hero .qcard{background:linear-gradient(135deg,${primary},${secondary});color:#fff;padding:12px 16px;border-radius:12px;min-width:200px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);}
    .hero .qcard .k{font-size:10px;opacity:.92;letter-spacing:.5px;}
    .hero .qcard .v{font-size:18px;font-weight:800;margin-top:2px;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:.5px;}
    .hero .qcard .date{font-size:10px;opacity:.9;margin-top:4px;}
    .badge-internal{margin-top:8px;background:#fef3c7;color:#7c5b12;font-size:9.5px;font-weight:700;padding:4px 10px;border-radius:6px;text-align:center;}

    /* INFO */
    .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
    .info .box{background:#faf7f6;border-right:3px solid ${primary};border-radius:8px;padding:11px 13px;}
    .info .lbl{font-size:10px;color:#9ca3af;margin-bottom:4px;letter-spacing:.3px;}
    .info .name{font-weight:800;font-size:13px;color:${accent};}
    .info .line{font-size:11px;color:#4b5563;margin-top:3px;}
    .info .line b{color:${accent};font-weight:700;}

    /* SECTION HEADING */
    .sec-title{font-size:13px;font-weight:800;color:${primary};border-right:4px solid ${secondary};padding-right:10px;margin:14px 0 8px;}

    /* ITEM CARD */
    .item{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;}
    .item .head{background:linear-gradient(135deg,${primary}0d,${secondary}14);padding:9px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eef0f3;}
    .item .head .t{display:flex;gap:10px;align-items:center;font-weight:800;font-size:13px;color:${accent};}
    .item .head .no{background:${primary};color:#fff;padding:3px 10px;border-radius:6px;font-size:10.5px;font-weight:800;font-family:'Segoe UI',Arial,sans-serif;}
    .item .head .qty{font-size:11.5px;color:${primary};font-weight:800;}
    .item .desc{padding:9px 12px 0;font-size:11px;color:#4b5563;}
    .specs{padding:8px 12px 4px;display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;font-size:11px;color:#374151;}
    .specs .row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #eef0f3;padding:2px 0;}
    .specs .row .k{color:#9ca3af;}
    .specs .row .v{font-weight:600;color:#1f2937;}
    .price-tbl{width:100%;border-top:1px dashed #e5e7eb;margin-top:6px;font-size:11.5px;border-collapse:collapse;}
    .price-tbl td{padding:8px 12px;}
    .price-tbl .lbl{color:#9ca3af;font-size:10px;}
    .price-tbl .val{font-weight:700;color:${accent};}
    .price-tbl .grand{color:${primary};font-weight:800;font-size:13px;}
    .item-notes{margin:0 12px 10px;padding:6px 10px;background:#f9fafb;border-right:2px solid ${secondary};font-size:10.5px;color:#4b5563;border-radius:4px;}

    /* INTERNAL */
    .internal{margin:0 12px 12px;background:#fefce8;border:1px dashed #d4b34a;border-radius:8px;padding:8px 12px;}
    .internal .t{font-size:11px;font-weight:800;color:#7c5b12;margin-bottom:5px;}
    .internal table{width:100%;font-size:10.5px;border-collapse:collapse;}
    .internal td{padding:2px 0;color:#7c5b12;}
    .internal td:last-child{text-align:left;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;}
    .internal .sm{font-size:10px;color:#7c5b12;margin-top:5px;}

    /* TOTALS */
    .totals{display:flex;justify-content:flex-end;}
    .totals-box{min-width:320px;max-width:360px;}
    .tr{display:flex;justify-content:space-between;padding:6px 12px;font-size:12px;border-bottom:1px dotted #e5e7eb;}
    .tr .k{color:#6b7280;}
    .tr .v{font-weight:700;color:${accent};}
    .tr.disc .v{color:#b91c1c;}
    .tr-final{background:linear-gradient(135deg,${primary},${secondary});color:#fff;padding:14px 16px;border-radius:10px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,.06);}
    .tr-final .k{font-size:11px;opacity:.92;}
    .tr-final .v{font-size:19px;font-weight:800;}

    /* TERMS / NOTES */
    .block{border:1px solid #eef0f3;border-radius:8px;padding:10px 14px;background:#fff;}
    .block .body{font-size:10.5px;color:#4b5563;line-height:1.7;}

    /* BANK */
    .bank{background:#faf7f6;border:1px solid #eee;border-radius:8px;padding:9px 12px;font-size:10.5px;color:#374151;}

    /* SIGNATURE */
    .signrow{display:flex;justify-content:space-between;gap:24px;margin-top:6px;}
    .signrow .box{flex:1;border:1px dashed #d1d5db;border-radius:8px;padding:14px;text-align:center;font-size:10.5px;color:#6b7280;min-height:80px;}

    /* FOOTER (drawn once per page, image) */
    .footer{border-top:2px solid ${primary};padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#6b7280;}
    .footer .left{max-width:70%;line-height:1.5;}
    .footer .right{text-align:left;font-family:'Segoe UI',Arial,sans-serif;}
  `;
}

/* ---------- offscreen rendering pipeline ---------- */

type Stage = { host: HTMLDivElement; root: HTMLDivElement };

function mountStage(styles: string): Stage {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${CONTENT_W}pt`;
  host.style.zIndex = "-1";
  host.style.pointerEvents = "none";
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  host.appendChild(styleEl);
  const root = document.createElement("div");
  root.className = "stage";
  // Width in CSS pixels — html2canvas uses windowWidth for scaling.
  root.style.width = `${CONTENT_W}px`;
  host.appendChild(root);
  document.body.appendChild(host);
  return { host, root };
}

async function renderSection(stage: Stage, html: string, opts?: { className?: string }): Promise<{ imgData: string; heightPt: number }> {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("dir", "rtl");
  wrapper.lang = "ar";
  wrapper.style.direction = "rtl";
  wrapper.style.fontFamily = "'Cairo','Tajawal','Segoe UI',Arial,sans-serif";
  if (opts?.className) wrapper.className = opts.className;
  wrapper.innerHTML = html;
  // Empty previous, keep only this section
  stage.root.replaceChildren(wrapper);
  // Wait a frame so layout & fonts settle
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const canvas = await html2canvas(wrapper, {
    backgroundColor: "#ffffff",
    useCORS: true,
    scale: 2,
    logging: false,
    windowWidth: CONTENT_W,
    onclone: (doc: Document, el: HTMLElement) => {
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => l.parentNode?.removeChild(l));
      doc.querySelectorAll("style").forEach((s) => { if (!el.contains(s) && !s.textContent?.includes(".stage")) s.parentNode?.removeChild(s); });
      const reset = doc.createElement("style");
      reset.textContent = `:root,html,body{color-scheme:light !important;background:#fff !important;color:#1f2937 !important;}`;
      doc.head.appendChild(reset);
    },
  });
  // Convert canvas pixel height → PDF points at CONTENT_W width.
  const scaleFactor = CONTENT_W / canvas.width;
  const heightPt = canvas.height * scaleFactor;
  const imgData = canvas.toDataURL("image/jpeg", 0.94);
  return { imgData, heightPt };
}

/* ---------- HTML builders ---------- */

function heroHtml(brand: BrandSettings, quotation: any, variant: "customer" | "internal"): string {
  return `
  <div class="hero">
    <div class="brand">
      ${brand.logo_url ? `<img src="${brand.logo_url}" alt="logo" crossorigin="anonymous"/>` : ""}
      <div>
        <div class="name">${brand.company_name_ar}</div>
        <div class="name-en">${brand.company_name_en}</div>
        <div class="meta">${brand.address ?? ""}</div>
        <div class="meta" dir="ltr">${[brand.phone, brand.email, brand.website].filter(Boolean).join(" • ")}</div>
        ${brand.tax_number ? `<div class="meta">الرقم الضريبي: <span class="num">${brand.tax_number}</span></div>` : ""}
      </div>
    </div>
    <div>
      <div class="qcard">
        <div class="k">رقم عرض السعر</div>
        <div class="v">${quotation.quotation_number}</div>
        <div class="date">${dateAr(quotation.created_at)}</div>
      </div>
      ${variant === "internal" ? '<div class="badge-internal">نسخة داخلية — لا تُشارك مع العميل</div>' : ""}
    </div>
  </div>`;
}

function infoHtml(customer: any, quotation: any, itemsCount: number, brand: BrandSettings, salesRepName?: string | null): string {
  return `
  <div class="info">
    <div class="box">
      <div class="lbl">بيانات العميل</div>
      <div class="name">${customer?.company_name ?? "—"}</div>
      ${customer?.contact_person ? `<div class="line">${customer.contact_person}</div>` : ""}
      ${customer?.phone ? `<div class="line" dir="ltr">${customer.phone}</div>` : ""}
      ${customer?.email ? `<div class="line" dir="ltr">${customer.email}</div>` : ""}
      ${customer?.address ? `<div class="line">${customer.address}</div>` : ""}
    </div>
    <div class="box">
      <div class="lbl">تفاصيل العرض</div>
      <div class="line"><b>عدد البنود:</b> <span class="num">${itemsCount}</span></div>
      <div class="line"><b>مدة التسليم:</b> <span class="num">${quotation.delivery_days ?? "—"}</span> يوم</div>
      <div class="line"><b>صلاحية العرض:</b> <span class="num">${quotation.validity_days ?? brand.default_validity_days}</span> يوم</div>
      <div class="line"><b>شروط الدفع:</b> ${quotation.payment_terms ?? brand.default_payment_terms}</div>
      ${salesRepName ? `<div class="line"><b>المندوب:</b> ${salesRepName}</div>` : ""}
    </div>
  </div>`;
}

function specRow(k: string, v: any): string {
  if (v === null || v === undefined || v === "" || v === 0) return "";
  return `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

function itemHtml(it: any, index: number, variant: "customer" | "internal", primary: string, continued = false): string {
  const specs = it.specs ?? {};
  const specsInner = [
    specRow("الفئة", tr(it.category)),
    specRow("المقاس", it.size),
    specRow("المادة", tr(it.material)),
    specRow("GSM", it.gsm ? `<span class="num">${it.gsm}</span>` : ""),
    specRow("طريقة الطباعة", tr(it.printing_method)),
    specRow("الأوجه", tr(it.printing_sides)),
    specRow("الألوان", tr(it.colors)),
    Array.isArray(it.finishing_options) && it.finishing_options.length
      ? `<div class="row" style="grid-column:1/-1"><span class="k">التشطيبات</span><span class="v">${trList(it.finishing_options)}</span></div>`
      : "",
    specs.notes ? specRow("ملاحظات فنية", specs.notes) : "",
  ].filter(Boolean).join("");

  const internal = variant === "internal" ? internalHtml(it) : "";
  const custNotes = it.customer_notes ? `<div class="item-notes"><b>ملاحظة:</b> ${it.customer_notes}</div>` : "";
  const num = it.item_number ?? index + 1;

  return `
  <div class="item">
    <div class="head">
      <div class="t">
        <span class="no">بند ${num}${continued ? " (تابع)" : ""}</span>
        <span>${it.title ?? "—"}</span>
      </div>
      <div class="qty"><span class="num">${qty(it.quantity)}</span> ${it.unit ?? "قطعة"}</div>
    </div>
    ${it.description ? `<div class="desc">${it.description}</div>` : ""}
    ${specsInner ? `<div class="specs">${specsInner}</div>` : ""}
    <table class="price-tbl"><tr>
      <td><div class="lbl">الكمية</div><div class="val"><span class="num">${qty(it.quantity)}</span></div></td>
      <td><div class="lbl">سعر الوحدة</div><div class="val money">${money(it.unit_price)}</div></td>
      <td style="text-align:left"><div class="lbl">الإجمالي</div><div class="val grand money">${money(it.total_price)}</div></td>
    </tr></table>
    ${custNotes}
    ${internal}
  </div>`;
}

const COST_LABELS: Record<string, string> = {
  paperCost: "تكلفة الورق", printingCost: "تكلفة الطباعة", finishingCost: "تكلفة التشطيبات",
  setupCost: "تكلفة الضبط", wasteCost: "تكلفة الهالك", specialInkCost: "أحبار خاصة",
  packagingCost: "تكلفة التغليف", deliveryCost: "تكلفة التسليم", totalCost: "إجمالي التكلفة",
};

function internalHtml(it: any): string {
  const cb = it.cost_breakdown ?? {};
  const rows = Object.entries(cb).filter(([, v]) => typeof v === "number" && v !== 0)
    .map(([k, v]) => `<tr><td>${COST_LABELS[k] ?? k}</td><td class="money">${money(v as number)}</td></tr>`).join("");
  if (!rows && !it.unit_cost) return "";
  return `<div class="internal">
    <div class="t">تحليل التكلفة الداخلية</div>
    <table>${rows}${it.unit_cost ? `<tr><td>تكلفة الوحدة</td><td class="money">${money(it.unit_cost)}</td></tr>` : ""}</table>
    ${it.profit_margin_pct ? `<div class="sm">هامش الربح: <span class="num">${pct(it.profit_margin_pct)}</span></div>` : ""}
    ${it.internal_notes ? `<div class="sm"><b>ملاحظات داخلية:</b> ${it.internal_notes}</div>` : ""}
  </div>`;
}

function totalsHtml(quotation: any): string {
  const subtotal = Number(quotation.subtotal ?? 0);
  const discount = Number(quotation.discount ?? 0);
  const taxAmount = Number(quotation.tax_amount ?? 0);
  const taxPct = Number(quotation.tax_pct ?? 0);
  const taxEnabled = !!quotation.tax_enabled;
  const finalPrice = Number(quotation.final_price ?? 0);
  return `
  <div class="totals"><div class="totals-box">
    <div class="tr"><span class="k">المجموع قبل الخصم</span><span class="v money">${money(subtotal)}</span></div>
    ${discount > 0 ? `<div class="tr disc"><span class="k">الخصم</span><span class="v money">- ${money(discount)}</span></div>` : ""}
    ${taxEnabled && taxAmount > 0 ? `<div class="tr"><span class="k">الضريبة (<span class="num">${pct(taxPct)}</span>)</span><span class="v money">${money(taxAmount)}</span></div>` : ""}
    <div class="tr-final">
      <span class="k">السعر النهائي ${taxEnabled ? "(شامل الضريبة)" : ""}</span>
      <span class="v money">${money(finalPrice)}</span>
    </div>
  </div></div>`;
}

function termsHtml(brand: BrandSettings, quotation: any): string {
  if (!brand.default_terms) return "";
  return `<div class="block"><div class="body">
    ${brand.default_terms}<br/>
    هذا العرض ساري لمدة <span class="num">${quotation.validity_days ?? brand.default_validity_days}</span> يوم من تاريخ الإصدار.
  </div></div>`;
}

function notesHtml(quotation: any): string {
  if (!quotation.customer_notes) return "";
  return `<div class="block"><div class="body">${quotation.customer_notes}</div></div>`;
}

function bankHtml(brand: BrandSettings): string {
  if (!brand.show_bank_details || !brand.bank_name) return "";
  const parts = [
    brand.bank_account ? `حساب: <span class="num" dir="ltr">${brand.bank_account}</span>` : "",
    brand.bank_iban ? `IBAN: <span class="num" dir="ltr">${brand.bank_iban}</span>` : "",
    brand.bank_swift ? `SWIFT: <span class="num" dir="ltr">${brand.bank_swift}</span>` : "",
  ].filter(Boolean).join(" • ");
  return `<div class="bank"><b>بيانات التحويل البنكي:</b> ${brand.bank_name}${parts ? " • " + parts : ""}</div>`;
}

function signatureHtml(): string {
  return `<div class="signrow">
    <div class="box"><b>ختم وتوقيع الشركة</b></div>
    <div class="box"><b>موافقة العميل</b><br/><span style="font-size:9.5px">التوقيع والتاريخ</span></div>
  </div>`;
}

function footerHtml(brand: BrandSettings, qrDataUrl: string): string {
  const contact = [brand.phone, brand.email, brand.website].filter(Boolean).join(" • ");
  return `<div class="footer">
    <div class="left">
      ${brand.pdf_footer ?? ""}<br/>
      ${brand.company_name_ar} • ${brand.address ?? ""}<br/>
      <span dir="ltr">${contact}</span>
    </div>
    <div class="right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" width="52" height="52" alt="QR"/>` : ""}
    </div>
  </div>`;
}

/* ---------- main generator ---------- */

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const { quotation, customer, items, brand, variant, salesRepName } = input;

  const primary = brand.primary_color || "#C8102E";
  const secondary = brand.secondary_color || "#EE5A24";
  const accent = brand.accent_color || "#2C3E50";
  const stage = mountStage(stageStyles(primary, secondary, accent));

  try {
    const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quotations/${quotation.id}`;
    const qrDataUrl = brand.show_qr ? await QRCode.toDataURL(qrUrl, { margin: 0, width: 120 }) : "";

    // Pre-render footer once — it's placed identically on every page.
    const footer = await renderSection(stage, footerHtml(brand, qrDataUrl));
    // Cap footer height so it always fits reserved band.
    const footerDrawH = Math.min(footer.heightPt, FOOTER_H - 14);

    // Build ordered list of sections to place.
    type Section = { imgData: string; heightPt: number; keepWithNext?: boolean; keepWithPrev?: boolean };
    const sections: Section[] = [];

    const hero = await renderSection(stage, heroHtml(brand, quotation, variant));
    sections.push({ ...hero });

    const info = await renderSection(stage, infoHtml(customer, quotation, items.length, brand, salesRepName));
    sections.push({ ...info });

    // Items section title
    const secTitle = await renderSection(stage, `<div class="sec-title">بنود عرض السعر</div>`);
    sections.push({ ...secTitle, keepWithNext: true });

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const html = itemHtml(it, i, variant, primary, false);
      const rendered = await renderSection(stage, html);
      sections.push({ ...rendered });
    }

    // Totals
    const totals = await renderSection(stage, totalsHtml(quotation));
    sections.push({ ...totals, keepWithPrev: false });

    // Terms
    const terms = termsHtml(brand, quotation);
    if (terms) {
      const t = await renderSection(stage, `<div class="sec-title">الشروط والأحكام</div>${terms}`);
      sections.push({ ...t });
    }

    // Notes
    const notes = notesHtml(quotation);
    if (notes) {
      const n = await renderSection(stage, `<div class="sec-title">ملاحظات</div>${notes}`);
      sections.push({ ...n });
    }

    // Bank
    const bank = bankHtml(brand);
    if (bank) {
      const b = await renderSection(stage, bank);
      sections.push({ ...b });
    }

    // Signature
    const sig = await renderSection(stage, `<div class="sec-title">التوقيعات</div>${signatureHtml()}`);
    sections.push({ ...sig });

    /* ---------- Place sections into pages with smart pagination ---------- */
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    let y = MARGIN_TOP;
    let pageIndex = 0;

    const drawFooterOn = (page: number) => {
      pdf.setPage(page);
      const fy = A4_H - footerDrawH - 20;
      pdf.addImage(footer.imgData, "JPEG", MARGIN_X, fy, CONTENT_W, footerDrawH);
    };

    const newPage = () => {
      pageIndex += 1;
      pdf.addPage();
      y = MARGIN_TOP;
    };

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const usable = CONTENT_BOTTOM - y;

      // If this section is a "keep-with-next" title, ensure the following section also fits.
      const needsWithNext = s.keepWithNext && sections[i + 1]
        ? s.heightPt + SECTION_GAP + sections[i + 1].heightPt
        : s.heightPt;

      if (needsWithNext > usable && y > MARGIN_TOP) {
        newPage();
      }

      // If a single section is taller than an entire page, slice it — but we
      // still keep the item on its own set of pages so nothing else mixes in.
      const fullPageH = CONTENT_BOTTOM - MARGIN_TOP;
      if (s.heightPt > fullPageH) {
        // Slice: draw as many full-page pieces as needed. y already MARGIN_TOP.
        // Convert imgData to a temporary <img> to grab pixel dims for slicing.
        const img = new Image();
        img.src = s.imgData;
        await new Promise((r) => { img.onload = () => r(null); });
        const scale = CONTENT_W / img.width;
        const pageHeightPx = Math.floor(fullPageH / scale);
        let drawn = 0;
        while (drawn < img.height) {
          const sliceH = Math.min(pageHeightPx, img.height - drawn);
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = sliceH;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, drawn, img.width, sliceH, 0, 0, img.width, sliceH);
          const data = c.toDataURL("image/jpeg", 0.94);
          if (drawn > 0 || y !== MARGIN_TOP) { newPage(); }
          pdf.addImage(data, "JPEG", MARGIN_X, MARGIN_TOP, CONTENT_W, sliceH * scale);
          drawn += sliceH;
          y = MARGIN_TOP + sliceH * scale + SECTION_GAP;
        }
        continue;
      }

      pdf.addImage(s.imgData, "JPEG", MARGIN_X, y, CONTENT_W, s.heightPt);
      y += s.heightPt + SECTION_GAP;
    }

    // Draw footer + page numbers on every page
    const pageCount = pdf.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      drawFooterOn(p);
      pdf.setPage(p);
      pdf.setFontSize(9);
      pdf.setTextColor(140);
      pdf.text(`Page ${p} / ${pageCount}`, A4_W / 2, A4_H - 8, { align: "center" });
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(stage.host);
  }
}

// Back-compat shim
export function loadCompanySettings() {
  return {} as any;
}
