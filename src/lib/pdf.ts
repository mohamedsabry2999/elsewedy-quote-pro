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
      internal = `<div class="internal">
        <div class="it-t">تحليل التكلفة الداخلية</div>
        <table>${rows}${it.unit_cost ? `<tr><td>تكلفة الوحدة</td><td class="money">${money(it.unit_cost)}</td></tr>` : ""}</table>
        ${it.profit_margin_pct ? `<div class="sm">هامش الربح: <span class="num">${pct(it.profit_margin_pct)}</span></div>` : ""}
        ${it.internal_notes ? `<div class="sm"><b>ملاحظات داخلية:</b> ${it.internal_notes}</div>` : ""}
      </div>`;
    }
  }

  const num = it.item_number ?? index + 1;
  const custNotes = it.customer_notes ? `<div class="item-notes"><b>ملاحظة:</b> ${it.customer_notes}</div>` : "";

  return `
  <div class="item" data-pdf-section="item">
    <div class="ihead">
      <div class="it"><span class="ino">بند ${num}</span><span>${it.title ?? "—"}</span></div>
      <div class="iqty"><span class="num">${qty(it.quantity)}</span> ${it.unit ?? "قطعة"}</div>
    </div>
    ${it.description ? `<div class="idesc">${it.description}</div>` : ""}
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
  container.style.fontFamily = "'Cairo','Tajawal','Segoe UI',Arial,sans-serif";
  container.style.color = "#1f2937";
  container.style.background = "#ffffff";
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.55";
  container.style.direction = "rtl";

  container.innerHTML = `
    <style>
      *{box-sizing:border-box;}
      .num{font-family:'Segoe UI',Arial,sans-serif;direction:ltr;unicode-bidi:isolate;display:inline-block;}
      .money{font-family:'Segoe UI',Arial,sans-serif;unicode-bidi:isolate;white-space:nowrap;}

      .hero{border-bottom:3px solid ${primary};padding-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
      .brand{display:flex;gap:14px;align-items:flex-start;}
      .brand img{max-height:72px;max-width:210px;object-fit:contain;}
      .brand .name{font-size:20px;font-weight:800;color:${primary};}
      .brand .name-en{font-size:11px;color:#6b7280;margin-top:2px;letter-spacing:.4px;}
      .brand .meta{font-size:10.5px;color:#6b7280;margin-top:4px;}
      .qcard{background:linear-gradient(135deg,${primary},${secondary});color:#fff;padding:12px 16px;border-radius:12px;min-width:210px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);}
      .qcard .k{font-size:10px;opacity:.92;letter-spacing:.4px;}
      .qcard .v{font-size:18px;font-weight:800;margin-top:3px;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:.6px;}
      .qcard .date{font-size:10px;opacity:.9;margin-top:4px;}
      .badge-int{margin-top:8px;background:#fef3c7;color:#7c5b12;font-size:9.5px;font-weight:700;padding:4px 10px;border-radius:6px;text-align:center;}

      .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
      .info .box{background:#faf7f6;border-right:3px solid ${primary};border-radius:8px;padding:12px 14px;}
      .info .lbl{font-size:10px;color:#9ca3af;margin-bottom:4px;letter-spacing:.3px;}
      .info .name{font-weight:800;font-size:13.5px;color:${accent};}
      .info .line{font-size:11px;color:#4b5563;margin-top:3px;}
      .info .line b{color:${accent};font-weight:700;}

      .sec-title{font-size:13px;font-weight:800;color:${primary};border-right:4px solid ${secondary};padding-right:10px;margin:16px 0 8px;}

      .item{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;margin-bottom:10px;}
      .ihead{background:linear-gradient(135deg,${primary}0d,${secondary}14);padding:9px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eef0f3;}
      .it{display:flex;gap:10px;align-items:center;font-weight:800;font-size:13px;color:${accent};}
      .ino{background:${primary};color:#fff;padding:3px 10px;border-radius:6px;font-size:10.5px;font-weight:800;font-family:'Segoe UI',Arial,sans-serif;}
      .iqty{font-size:11.5px;color:${primary};font-weight:800;}
      .idesc{padding:9px 12px 0;font-size:11px;color:#4b5563;}
      .specs{padding:8px 12px 4px;display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;font-size:11px;color:#374151;}
      .srow{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #eef0f3;padding:3px 0;}
      .srow.full{grid-column:1/-1;}
      .srow .k{color:#9ca3af;}
      .srow .v{font-weight:600;color:#1f2937;}
      .price-tbl{width:100%;border-top:1px dashed #e5e7eb;margin-top:6px;font-size:11.5px;border-collapse:collapse;}
      .price-tbl td{padding:9px 12px;}
      .price-tbl .lbl{color:#9ca3af;font-size:10px;}
      .price-tbl .val{font-weight:700;color:${accent};}
      .price-tbl .grand{color:${primary};font-weight:800;font-size:13.5px;}
      .item-notes{margin:0 12px 10px;padding:6px 10px;background:#f9fafb;border-right:2px solid ${secondary};font-size:10.5px;color:#4b5563;border-radius:4px;}
      .internal{margin:0 12px 12px;background:#fefce8;border:1px dashed #d4b34a;border-radius:8px;padding:8px 12px;}
      .internal .it-t{font-size:11px;font-weight:800;color:#7c5b12;margin-bottom:5px;}
      .internal table{width:100%;font-size:10.5px;border-collapse:collapse;}
      .internal td{padding:2px 0;color:#7c5b12;}
      .internal td:last-child{text-align:left;font-weight:700;}
      .internal .sm{font-size:10px;color:#7c5b12;margin-top:5px;}

      .end-block{margin-top:12px;}
      .totals{display:flex;justify-content:flex-end;margin-top:12px;}
      .tbox{min-width:340px;max-width:360px;}
      .tr{display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;border-bottom:1px dotted #e5e7eb;}
      .tr .k{color:#6b7280;}
      .tr .v{font-weight:700;color:${accent};}
      .tr.disc .v{color:#b91c1c;}
      .tr-final{background:linear-gradient(135deg,${primary},${secondary});color:#fff;padding:14px 18px;border-radius:10px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.08);}
      .tr-final .k{font-size:11.5px;opacity:.92;}
      .tr-final .v{font-size:20px;font-weight:800;}

      .block{border:1px solid #eef0f3;border-radius:8px;padding:10px 14px;background:#fff;margin-top:8px;}
      .block .body{font-size:10.5px;color:#4b5563;line-height:1.75;}
      .bank{background:#faf7f6;border:1px solid #eee;border-radius:8px;padding:10px 14px;font-size:10.5px;color:#374151;margin-top:8px;}
      .signrow{display:flex;justify-content:space-between;gap:18px;margin-top:10px;}
      .signrow .sbox{flex:1;border:1px dashed #d1d5db;border-radius:8px;padding:14px;text-align:center;font-size:10.5px;color:#6b7280;min-height:70px;}

      .foot{border-top:2px solid ${primary};padding-top:10px;margin-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#6b7280;}
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
  const rectTop = container.getBoundingClientRect().top;
  const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-section], .item"));
  const breakPoints: number[] = []; // ordered list of Y offsets that are safe page-break candidates
  for (const n of nodes) {
    const y = n.getBoundingClientRect().top - rectTop;
    if (y >= 0) breakPoints.push(Math.floor(y));
  }
  breakPoints.sort((a, b) => a - b);

  // Rasterize
  const canvas = await html2canvas(container, {
    backgroundColor: "#ffffff",
    useCORS: true,
    scale: 2,
    logging: false,
    windowWidth: 800,
    onclone: (doc: Document, el: HTMLElement) => {
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => l.parentNode?.removeChild(l));
      doc.querySelectorAll("style").forEach((s) => { if (!el.contains(s)) s.parentNode?.removeChild(s); });
      const reset = doc.createElement("style");
      reset.textContent = `:root,html,body{color-scheme:light !important;background:#fff !important;color:#1f2937 !important;}`;
      doc.head.appendChild(reset);
    },
  });
  document.body.removeChild(container);

  // Convert breakPoints from CSS px (container width=780) to canvas px.
  // html2canvas at scale 2 → canvas.width ≈ 800*2 = 1600 (windowWidth was 800).
  const cssWidth = 780;
  const cssToCanvas = canvas.width / cssWidth;
  const breaksCanvas = breakPoints.map((b) => Math.floor(b * cssToCanvas));

  // Set up A4 page geometry.
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 28;
  const marginTop = 26;
  const marginBottom = 34; // reserved for page number
  const contentW = pageW - marginX * 2;
  const contentH = pageH - marginTop - marginBottom;
  const pxPerPt = canvas.width / contentW;
  const pageHpx = Math.floor(contentH * pxPerPt);

  // Slice the canvas into pages, choosing a break at the largest breakpoint
  // that lies within the current page window; if none, force-cut at pageHpx.
  let startY = 0;
  let pageIndex = 0;
  while (startY < canvas.height) {
    const idealEnd = Math.min(startY + pageHpx, canvas.height);
    let endY = idealEnd;
    if (idealEnd < canvas.height) {
      // find the largest breakpoint strictly greater than startY and <= idealEnd
      let chosen = -1;
      for (const b of breaksCanvas) {
        if (b > startY + 40 && b <= idealEnd) chosen = b;
        else if (b > idealEnd) break;
      }
      // If the very next breakpoint is only slightly past idealEnd and the
      // "content since last break" is tall (a single item bigger than one page),
      // we still have to hard-cut at idealEnd — fall through.
      if (chosen > 0) endY = chosen;
    }

    const sliceH = endY - startY;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, startY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const img = slice.toDataURL("image/jpeg", 0.94);
    if (pageIndex > 0) pdf.addPage();
    const drawH = sliceH / pxPerPt;
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
