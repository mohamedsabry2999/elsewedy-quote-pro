// Professional PDF export for Elsewedy quotations.
// Strategy: render the full quotation as ONE HTML container (so the browser
// handles Arabic RTL shaping natively), measure each top-level section's
// Y position, then slice the resulting canvas along boundaries that never
// split a quotation item across two pages.
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

const nfmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfmtInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const money = (v: number | null | undefined) => `${nfmt.format(Number(v ?? 0))} ج.م`;
const qty = (v: number | null | undefined) => nfmtInt.format(Number(v ?? 0));
const pct = (v: number | null | undefined) => `${nfmt.format(Number(v ?? 0))}%`;

const dateAr = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

/* ---------- WhatsApp ---------- */
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

/* ---------- Arabic translations ---------- */
const T: Record<string, string> = {
  gloss_lam: "سلوفان لامع", matte_lam: "سلوفان مطفي", spot_uv: "سبوت UV", uv_coating: "طلاء UV",
  cutting: "قص", die_cut: "قص خاص (داي كت)", folding: "طي", scoring: "خدش", perforation: "تخريم",
  spiral: "تجليد سلك", binding: "تجليد", stapling: "دبابيس", hot_foil: "طبع حراري",
  embossing: "بارز", packing: "تغليف", packaging: "تغليف",
  marketing: "تسويقي", digital: "ديجيتال", booklet: "كتيّب / كتالوج",
  stationery: "مطبوعات إدارية",
  coated_100gsm: "كوشيه 100 جم", coated_130gsm: "كوشيه 130 جم", coated_150gsm: "كوشيه 150 جم",
  coated_170gsm: "كوشيه 170 جم", coated_200gsm: "كوشيه 200 جم", coated_250gsm: "كوشيه 250 جم",
  coated_300gsm: "كوشيه 300 جم", coated_350gsm: "كوشيه 350 جم",
  matte_150gsm: "ماط 150 جم", matte_300gsm: "ماط 300 جم", offset_80gsm: "أوفست 80 جم",
  "1": "وجه واحد", "2": "وجهان",
};
const tr = (v: any): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return T[s] ?? s;
};
const trList = (arr: any): string => Array.isArray(arr) ? arr.map(tr).join("، ") : "";

/* ---------- font loader ---------- */
let arabicFontPromise: Promise<void> | null = null;
function ensureArabicFont(): Promise<void> {
  if (arabicFontPromise) return arabicFontPromise;
  arabicFontPromise = (async () => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("__pdf-cairo-font")) {
      const link = document.createElement("link");
      link.id = "__pdf-cairo-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
    try {
      const f = (document as any).fonts;
      if (f?.load) {
        await Promise.all([
          f.load("400 12px Cairo"),
          f.load("500 12px Cairo"),
          f.load("600 12px Cairo"),
          f.load("700 12px Cairo"),
          f.load("800 14px Cairo"),
          // Preload a sample of Arabic glyphs so the browser fetches the
          // Arabic subset before html2canvas snapshots the DOM.
          f.load("700 12px Cairo", "بند رقم عرض السعر بيانات العميل تفاصيل"),
          f.load("800 14px Cairo", "بند رقم عرض السعر"),
        ]);
        await f.ready;
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
      // Extra safety tick — some browsers finish shaping metrics slightly
      // after fonts.ready resolves.
      await new Promise((r) => setTimeout(r, 120));
    } catch { /* ignore */ }
  })();
  return arabicFontPromise;
}

/* ---------- HTML builders ---------- */

const COST_LABELS: Record<string, string> = {
  paperCost: "تكلفة الورق", printingCost: "تكلفة الطباعة", finishingCost: "تكلفة التشطيبات",
  setupCost: "تكلفة الضبط", wasteCost: "تكلفة الهالك", specialInkCost: "أحبار خاصة",
  packagingCost: "تكلفة التغليف", deliveryCost: "تكلفة التسليم", totalCost: "إجمالي التكلفة",
};

function specRow(k: string, v: any): string {
  if (v === null || v === undefined || v === "" || v === 0) return "";
  return `<div class="srow"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

function itemHtml(it: any, index: number, variant: "customer" | "internal"): string {
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
      ? `<div class="srow full"><span class="k">التشطيبات</span><span class="v">${trList(it.finishing_options)}</span></div>`
      : "",
    specs.notes ? specRow("ملاحظات فنية", specs.notes) : "",
  ].filter(Boolean).join("");

  let internal = "";
  if (variant === "internal") {
    const cb = it.cost_breakdown ?? {};
    const rows = Object.entries(cb).filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([k, v]) => `<tr><td>${COST_LABELS[k] ?? k}</td><td class="money">${money(v as number)}</td></tr>`).join("");
    if (rows || it.unit_cost) {
      internal = `<div class="internal" data-pdf-subsection="internal">
        <div class="it-t">تحليل التكلفة الداخلية</div>
        <table>${rows}${it.unit_cost ? `<tr><td>تكلفة الوحدة</td><td class="money">${money(it.unit_cost)}</td></tr>` : ""}</table>
        ${it.profit_margin_pct ? `<div class="sm">هامش الربح: <span class="num">${pct(it.profit_margin_pct)}</span></div>` : ""}
        ${it.internal_notes ? `<div class="sm"><b>ملاحظات داخلية:</b> ${it.internal_notes}</div>` : ""}
      </div>`;
    }
  }

  const num = it.item_number ?? index + 1;
  const custNotes = it.customer_notes ? `<div class="item-notes" data-pdf-subsection="notes"><b>ملاحظة:</b> ${it.customer_notes}</div>` : "";

  // data-pdf-item-num used to emit "تابع بند X" continuation headers when this
  // block spans pages. Sub-sections carry data-pdf-subsection so the slicer can
  // fall back to internal boundaries when a whole item is taller than one page.
  return `
  <div class="item" data-pdf-section="item" data-pdf-item-num="${num}">
    <div class="ihead" data-pdf-subsection="head">
      <div class="it"><span class="ino">بند <span class="n">${num}</span></span><span class="t">${it.title ?? "—"}</span></div>
      <div class="iqty"><span class="num">${qty(it.quantity)}</span> ${it.unit ?? "قطعة"}</div>
    </div>
    ${it.description ? `<div class="idesc" data-pdf-subsection="desc">${it.description}</div>` : ""}
    ${specsInner ? `<div class="specs" data-pdf-subsection="specs">${specsInner}</div>` : ""}
    <table class="price-tbl" data-pdf-subsection="price"><tr>
      <td><div class="lbl">الكمية</div><div class="val"><span class="num">${qty(it.quantity)}</span></div></td>
      <td><div class="lbl">سعر الوحدة</div><div class="val money">${money(it.unit_price)}</div></td>
      <td style="text-align:left"><div class="lbl">الإجمالي</div><div class="val grand money">${money(it.total_price)}</div></td>
    </tr></table>
    ${custNotes}
    ${internal}
  </div>`;
}

/* ---------- main generator ---------- */

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const { quotation, customer, items, brand, variant, salesRepName } = input;

  const primary = brand.primary_color || "#C8102E";
  const secondary = brand.secondary_color || "#EE5A24";
  const accent = brand.accent_color || "#2C3E50";

  const subtotal = Number(quotation.subtotal ?? 0);
  const discount = Number(quotation.discount ?? 0);
  const taxAmount = Number(quotation.tax_amount ?? 0);
  const taxPct = Number(quotation.tax_pct ?? 0);
  const taxEnabled = !!quotation.tax_enabled;
  const finalPrice = Number(quotation.final_price ?? 0);

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quotations/${quotation.id}`;
  const qrDataUrl = brand.show_qr ? await QRCode.toDataURL(qrUrl, { margin: 0, width: 120 }) : "";

  // Build the monolithic container — capture in one shot for correct Arabic shaping,
  // then use per-section DOM measurements to compute page-break points.
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.lang = "ar";
  container.style.width = "780px";
  container.style.padding = "28px 32px 24px";
  container.style.fontFamily = "'Cairo','Noto Kufi Arabic','Tajawal','Segoe UI',Arial,sans-serif";
  container.style.color = "#1f2937";
  container.style.background = "#ffffff";
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.55";
  container.style.direction = "rtl";

  // Ensure Cairo is loaded (idempotent) so the PDF renders consistently on
  // machines without a system Arabic UI font (headless browsers, Windows).
  await ensureArabicFont();


  container.innerHTML = `
    <style>
      *{box-sizing:border-box;letter-spacing:0 !important;}
      /* Arabic must NEVER get letter-spacing — it breaks glyph joining
         (turns "بيانات" into "ن و يات"). Keep Cairo everywhere and only
         isolate numeric runs with unicode-bidi so digits render LTR
         inside RTL text. */
      .num{direction:ltr;unicode-bidi:isolate;display:inline-block;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}
      .money{unicode-bidi:isolate;white-space:nowrap;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}

      .hero{border-bottom:3px solid ${primary};padding-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
      .brand{display:flex;gap:14px;align-items:flex-start;}
      .brand img{max-height:72px;max-width:210px;object-fit:contain;}
      .brand .name{font-size:20px;font-weight:800;color:${primary};line-height:1.3;}
      .brand .name-en{font-size:11px;color:#6b7280;margin-top:2px;line-height:1.3;}
      .brand .meta{font-size:10.5px;color:#6b7280;margin-top:4px;line-height:1.6;}
      .qcard{background:linear-gradient(135deg,${primary},${secondary});color:#fff;padding:14px 18px;border-radius:12px;min-width:210px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);}
      .qcard .k{font-size:11px;opacity:.95;line-height:1.5;margin-bottom:2px;}
      .qcard .v{font-size:18px;font-weight:800;margin-top:2px;line-height:1.4;direction:ltr;unicode-bidi:isolate;}
      .qcard .date{font-size:10.5px;opacity:.95;margin-top:4px;direction:ltr;unicode-bidi:isolate;}
      .badge-int{margin-top:8px;background:#fef3c7;color:#7c5b12;font-size:10px;font-weight:700;padding:5px 10px;border-radius:6px;text-align:center;line-height:1.5;}

      .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
      .info .box{background:#faf7f6;border-right:3px solid ${primary};border-radius:8px;padding:12px 14px;}
      .info .lbl{font-size:10.5px;color:#9ca3af;margin-bottom:5px;font-weight:600;line-height:1.5;}
      .info .name{font-weight:800;font-size:14px;color:${accent};line-height:1.5;margin-bottom:3px;}
      .info .line{font-size:11px;color:#4b5563;margin-top:3px;line-height:1.75;}
      .info .line b{color:${accent};font-weight:700;}

      .sec-title{font-size:13.5px;font-weight:800;color:${primary};border-right:4px solid ${secondary};padding-right:10px;margin:16px 0 8px;line-height:1.5;}

      .item{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;margin-bottom:10px;}
      .ihead{background:linear-gradient(135deg,${primary}0d,${secondary}14);padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #eef0f3;}
      .it{display:flex;gap:10px;align-items:center;font-weight:800;font-size:13px;color:${accent};line-height:1.5;min-width:0;flex:1;}
      .it .t{overflow:hidden;text-overflow:ellipsis;}
      /* Item badge: fixed height, inline-flex centering. Cairo font (NOT
         Segoe) so "بند" joins correctly. Number isolated LTR. */
      .ino{background:${primary};color:#fff;padding:0 10px;height:22px;min-width:56px;border-radius:6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:5px;line-height:1;white-space:nowrap;flex-shrink:0;}
      .ino .n{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;}
      .iqty{font-size:11.5px;color:${primary};font-weight:800;white-space:nowrap;flex-shrink:0;line-height:1.5;}
      .idesc{padding:9px 12px 0;font-size:11px;color:#4b5563;line-height:1.7;}
      .specs{padding:10px 12px 6px;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:11px;color:#374151;}
      .srow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:1px dotted #eef0f3;padding:4px 0;line-height:1.6;}
      .srow.full{grid-column:1/-1;}
      .srow .k{color:#9ca3af;flex-shrink:0;}
      .srow .v{font-weight:600;color:#1f2937;text-align:left;word-break:break-word;}
      .price-tbl{width:100%;border-top:1px dashed #e5e7eb;margin-top:6px;font-size:11.5px;border-collapse:collapse;}
      .price-tbl td{padding:10px 12px;vertical-align:middle;}
      .price-tbl .lbl{color:#9ca3af;font-size:10px;margin-bottom:3px;line-height:1.4;}
      .price-tbl .val{font-weight:700;color:${accent};line-height:1.5;}
      .price-tbl .grand{color:${primary};font-weight:800;font-size:14px;}
      .item-notes{margin:0 12px 10px;padding:7px 10px;background:#f9fafb;border-right:2px solid ${secondary};font-size:10.5px;color:#4b5563;border-radius:4px;line-height:1.75;}
      .internal{margin:0 12px 12px;background:#fefce8;border:1px dashed #d4b34a;border-radius:8px;padding:9px 12px;}
      .internal .it-t{font-size:11px;font-weight:800;color:#7c5b12;margin-bottom:6px;line-height:1.5;}
      .internal table{width:100%;font-size:10.5px;border-collapse:collapse;}
      .internal td{padding:3px 0;color:#7c5b12;line-height:1.6;}
      .internal td:last-child{text-align:left;font-weight:700;}
      .internal .sm{font-size:10px;color:#7c5b12;margin-top:5px;line-height:1.6;}

      .end-block{margin-top:12px;}
      .totals{display:flex;justify-content:flex-end;margin-top:12px;}
      .tbox{min-width:340px;max-width:360px;}
      .tr{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;font-size:12px;border-bottom:1px dotted #e5e7eb;line-height:1.5;}
      .tr .k{color:#6b7280;}
      .tr .v{font-weight:700;color:${accent};}
      .tr.disc .v{color:#b91c1c;}
      .tr-final{background:linear-gradient(135deg,${primary},${secondary});color:#fff;padding:14px 18px;border-radius:10px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.08);line-height:1.5;}
      .tr-final .k{font-size:11.5px;opacity:.95;}
      .tr-final .v{font-size:20px;font-weight:800;}

      .block{border:1px solid #eef0f3;border-radius:8px;padding:10px 14px;background:#fff;margin-top:8px;}
      .block .body{font-size:10.5px;color:#4b5563;line-height:1.9;}
      .bank{background:#faf7f6;border:1px solid #eee;border-radius:8px;padding:10px 14px;font-size:10.5px;color:#374151;margin-top:8px;line-height:1.75;}
      .signrow{display:flex;justify-content:space-between;gap:18px;margin-top:10px;}
      .signrow .sbox{flex:1;border:1px dashed #d1d5db;border-radius:8px;padding:14px;text-align:center;font-size:10.5px;color:#6b7280;min-height:70px;line-height:1.7;}

      .foot{border-top:2px solid ${primary};padding-top:10px;margin-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#6b7280;line-height:1.75;}
      .foot .r img{width:56px;height:56px;}
    </style>

    <div class="hero" data-pdf-section="hero">
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
        ${variant === "internal" ? '<div class="badge-int">نسخة داخلية — لا تُشارك مع العميل</div>' : ""}
      </div>
    </div>

    <div class="info" data-pdf-section="info">
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
        <div class="line"><b>عدد البنود:</b> <span class="num">${items.length}</span></div>
        <div class="line"><b>مدة التسليم:</b> <span class="num">${quotation.delivery_days ?? "—"}</span> يوم</div>
        <div class="line"><b>صلاحية العرض:</b> <span class="num">${quotation.validity_days ?? brand.default_validity_days}</span> يوم</div>
        <div class="line"><b>شروط الدفع:</b> ${quotation.payment_terms ?? brand.default_payment_terms}</div>
        ${salesRepName ? `<div class="line"><b>المندوب:</b> ${salesRepName}</div>` : ""}
      </div>
    </div>

    <div class="sec-title" data-pdf-section="title-items">بنود عرض السعر</div>
    ${items.map((it, i) => itemHtml(it, i, variant)).join("")}

    <div class="end-block" data-pdf-section="totals">
      <div class="totals"><div class="tbox">
        <div class="tr"><span class="k">المجموع قبل الخصم</span><span class="v money">${money(subtotal)}</span></div>
        ${discount > 0 ? `<div class="tr disc"><span class="k">الخصم</span><span class="v money">- ${money(discount)}</span></div>` : ""}
        ${taxEnabled && taxAmount > 0 ? `<div class="tr"><span class="k">الضريبة (<span class="num">${pct(taxPct)}</span>)</span><span class="v money">${money(taxAmount)}</span></div>` : ""}
        <div class="tr-final">
          <span class="k">السعر النهائي ${taxEnabled ? "(شامل الضريبة)" : ""}</span>
          <span class="v money">${money(finalPrice)}</span>
        </div>
      </div></div>
    </div>

    ${brand.default_terms ? `<div data-pdf-section="terms">
      <div class="sec-title">الشروط والأحكام</div>
      <div class="block"><div class="body">
        ${brand.default_terms}<br/>
        هذا العرض ساري لمدة <span class="num">${quotation.validity_days ?? brand.default_validity_days}</span> يوم من تاريخ الإصدار.
      </div></div>
    </div>` : ""}

    ${quotation.customer_notes ? `<div data-pdf-section="notes">
      <div class="sec-title">ملاحظات</div>
      <div class="block"><div class="body">${quotation.customer_notes}</div></div>
    </div>` : ""}

    ${brand.show_bank_details && brand.bank_name ? `<div class="bank" data-pdf-section="bank">
      <b>بيانات التحويل البنكي:</b> ${brand.bank_name}
      ${brand.bank_account ? ` • حساب: <span class="num" dir="ltr">${brand.bank_account}</span>` : ""}
      ${brand.bank_iban ? ` • IBAN: <span class="num" dir="ltr">${brand.bank_iban}</span>` : ""}
      ${brand.bank_swift ? ` • SWIFT: <span class="num" dir="ltr">${brand.bank_swift}</span>` : ""}
    </div>` : ""}

    <div data-pdf-section="signatures">
      <div class="sec-title">التوقيعات</div>
      <div class="signrow">
        <div class="sbox"><b>ختم وتوقيع الشركة</b></div>
        <div class="sbox"><b>موافقة العميل</b><br/><span style="font-size:9.5px">التوقيع والتاريخ</span></div>
      </div>
    </div>

    <div class="foot" data-pdf-section="footer">
      <div class="l">
        ${brand.pdf_footer ?? ""}<br/>
        ${brand.company_name_ar} • ${brand.address ?? ""}<br/>
        <span dir="ltr">${[brand.phone, brand.email, brand.website].filter(Boolean).join(" • ")}</span>
      </div>
      <div class="r">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR"/>` : ""}</div>
    </div>
  `;

  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.colorScheme = "light";
  document.body.appendChild(container);

  // Wait for images (logo, QR) to load so heights are accurate.
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise<void>((res) => {
    img.onload = () => res();
    img.onerror = () => res();
  })));

  // Snapshot section top offsets in CSS pixels relative to the container.
  // PRIMARY breakpoints: whole-item / whole-section starts (preferred cuts).
  // SECONDARY breakpoints: sub-blocks inside an item (fallback for items
  // taller than a single page).
  const rectTop = container.getBoundingClientRect().top;
  const primaryBreaks: number[] = [];
  const secondaryBreaks: number[] = [];
  // Map Y offset (in canvas px, filled after scaling) → item number for
  // continuation headers.
  const itemStartAtY = new Map<number, number>(); // css-px Y → item number
  const itemEndAtY = new Map<number, number>();   // css-px Y (bottom) → item number
  container.querySelectorAll<HTMLElement>("[data-pdf-section]").forEach((n) => {
    const y = Math.floor(n.getBoundingClientRect().top - rectTop);
    if (y >= 0) primaryBreaks.push(y);
    if (n.dataset.pdfSection === "item") {
      const num = Number(n.dataset.pdfItemNum ?? 0);
      if (num > 0) {
        itemStartAtY.set(y, num);
        const bottom = Math.floor(n.getBoundingClientRect().bottom - rectTop);
        itemEndAtY.set(bottom, num);
      }
    }
  });
  container.querySelectorAll<HTMLElement>("[data-pdf-subsection]").forEach((n) => {
    const y = Math.floor(n.getBoundingClientRect().top - rectTop);
    if (y >= 0) secondaryBreaks.push(y);
  });
  primaryBreaks.sort((a, b) => a - b);
  secondaryBreaks.sort((a, b) => a - b);

  // Rasterize
  const canvas = await html2canvas(container, {
    backgroundColor: "#ffffff",
    useCORS: true,
    scale: 2,
    logging: false,
    windowWidth: 800,
    onclone: (doc: Document, el: HTMLElement) => {
      // Strip ONLY app/theme stylesheets. KEEP Google Fonts (Cairo) — removing
      // it causes html2canvas to fall back to a generic font that breaks
      // Arabic shaping (ر / ب / ي get dropped or replaced), producing text
      // like "قم عرض" instead of "رقم عرض" and "شد" instead of "بند".
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
        const href = (l as HTMLLinkElement).href || "";
        if (!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(href)) {
          l.parentNode?.removeChild(l);
        }
      });
      doc.querySelectorAll("style").forEach((s) => { if (!el.contains(s)) s.parentNode?.removeChild(s); });
      const reset = doc.createElement("style");
      reset.textContent = `:root,html,body{color-scheme:light !important;background:#fff !important;color:#1f2937 !important;}
        *{font-family:'Cairo','Noto Kufi Arabic','Tajawal','Segoe UI',Arial,sans-serif !important;letter-spacing:0 !important;}
        .num,.money{font-variant-numeric:tabular-nums !important;font-feature-settings:"tnum" !important;}`;
      doc.head.appendChild(reset);
    },
  });
  document.body.removeChild(container);

  // Convert breakpoints from CSS px (container width=780) to canvas px.
  const cssWidth = 780;
  const cssToCanvas = canvas.width / cssWidth;
  const primaryCanvas = primaryBreaks.map((b) => Math.floor(b * cssToCanvas));
  const secondaryCanvas = secondaryBreaks.map((b) => Math.floor(b * cssToCanvas));
  // Item-continuation tracking in canvas px.
  const itemStarts = new Map<number, number>();
  const itemEnds = new Map<number, number>();
  itemStartAtY.forEach((num, y) => itemStarts.set(Math.floor(y * cssToCanvas), num));
  itemEndAtY.forEach((num, y) => itemEnds.set(Math.floor(y * cssToCanvas), num));

  // Set up A4 page geometry.
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 26;
  const marginBottom = 34;
  const contentW = pageW - marginX * 2;
  const contentH = pageH - marginTop - marginBottom;
  const pxPerPt = canvas.width / contentW;
  const pageHpx = Math.floor(contentH * pxPerPt);

  // Slice with priority: prefer PRIMARY (item/section boundaries). If none is
  // available in the page window, fall back to SECONDARY (in-item sub-blocks).
  // If still nothing, hard-cut at idealEnd. This guarantees whole items stay
  // together whenever they fit within a page, and larger items break at clean
  // sub-boundaries instead of mid-row.
  const findBreak = (arr: number[], startY: number, idealEnd: number, minAdvance: number): number => {
    let chosen = -1;
    for (const b of arr) {
      if (b > startY + minAdvance && b <= idealEnd) chosen = b;
      else if (b > idealEnd) break;
    }
    return chosen;
  };

  // Determine which item (if any) is being continued at a given Y (canvas px):
  // the item whose start ≤ Y and whose end > Y.
  const itemAtY = (y: number): number | null => {
    let best: { num: number; start: number } | null = null;
    itemStarts.forEach((num, start) => {
      if (start <= y) {
        const end = [...itemEnds.entries()].find(([, n]) => n === num)?.[0] ?? 0;
        if (end > y && (!best || start > best.start)) best = { num, start };
      }
    });
    return best ? (best as any).num : null;
  };

  let startY = 0;
  let pageIndex = 0;
  while (startY < canvas.height) {
    const idealEnd = Math.min(startY + pageHpx, canvas.height);
    let endY = idealEnd;
    if (idealEnd < canvas.height) {
      // Require the chosen break to advance at least 30% of the page — this
      // prevents items sitting near the top from wasting most of the page.
      const minAdvance = Math.max(60, Math.floor(pageHpx * 0.30));
      let chosen = findBreak(primaryCanvas, startY, idealEnd, minAdvance);
      if (chosen < 0) chosen = findBreak(secondaryCanvas, startY, idealEnd, minAdvance);
      if (chosen < 0) chosen = findBreak(primaryCanvas, startY, idealEnd, 40);
      if (chosen < 0) chosen = findBreak(secondaryCanvas, startY, idealEnd, 40);
      if (chosen > 0) endY = chosen;
    }

    const sliceH = endY - startY;
    // Continuation header: is the very top of this page inside an item that
    // started earlier?
    const continuedItem = pageIndex > 0 ? itemAtY(startY + 1) : null;
    const headerStripPx = continuedItem ? Math.floor(24 * pxPerPt) : 0;

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH + headerStripPx;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    if (continuedItem) {
      // Small "تابع بند رقم X" strip. We draw it as text on canvas; because
      // this canvas is later embedded as an image, native Arabic shaping is
      // preserved by the browser's canvas 2D text renderer.
      ctx.fillStyle = "#faf7f6";
      ctx.fillRect(0, 0, slice.width, headerStripPx);
      ctx.fillStyle = "#C8102E";
      ctx.fillRect(slice.width - Math.floor(4 * pxPerPt), 0, Math.floor(4 * pxPerPt), headerStripPx);
      ctx.fillStyle = "#1f2937";
      const fontPx = Math.floor(11 * pxPerPt);
      ctx.font = `700 ${fontPx}px Cairo, "Noto Kufi Arabic", Tajawal, Arial, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.direction = "rtl" as CanvasDirection;
      ctx.fillText(`تابع بند رقم ${continuedItem} …`, slice.width - Math.floor(14 * pxPerPt), headerStripPx / 2);
    }
    ctx.drawImage(canvas, 0, startY, canvas.width, sliceH, 0, headerStripPx, canvas.width, sliceH);
    const img = slice.toDataURL("image/jpeg", 0.94);
    if (pageIndex > 0) pdf.addPage();
    const drawH = (sliceH + headerStripPx) / pxPerPt;
    pdf.addImage(img, "JPEG", marginX, marginTop, contentW, drawH);
    startY = endY;
    pageIndex += 1;
  }

  // Page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(140);
    pdf.text(`Page ${i} / ${pageCount}`, pageW / 2, pageH - 14, { align: "center" });
  }

  return pdf.output("blob");
}

// Back-compat shim
export function loadCompanySettings() {
  return {} as any;
}
