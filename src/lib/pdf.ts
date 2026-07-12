// PDF generation for Elsewedy quotations — multi-item, brand-aware, smart pagination.
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { currency, dateAr, number, percent } from "./format";
import type { BrandSettings } from "./brand";

export interface QuotationPdfInput {
  quotation: any;
  customer: any;
  items: any[];
  brand: BrandSettings;
  variant: "customer" | "internal";
  salesRepName?: string | null;
}

/** Cairo/Egypt-time WhatsApp greeting per user spec */
export function whatsappMessage(
  customerName: string,
  quotationNumber: string,
  companyEn: string,
  egyptTz = "Africa/Cairo",
): string {
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

function itemSpecsBlock(it: any): string {
  const specs = it.specs ?? {};
  const rows: string[] = [];
  const push = (label: string, val: any) => { if (val !== undefined && val !== null && val !== "" && val !== 0) rows.push(`<div><span class="lbl">${label}:</span> ${val}</div>`); };
  push("الفئة", it.category);
  push("المقاس", it.size);
  push("المادة", it.material);
  push("GSM", it.gsm);
  push("طريقة الطباعة", it.printing_method);
  push("الأوجه", it.printing_sides);
  push("الألوان", it.colors);
  if (Array.isArray(it.finishing_options) && it.finishing_options.length) {
    rows.push(`<div><span class="lbl">التشطيبات:</span> ${it.finishing_options.join("، ")}</div>`);
  }
  if (specs.notes) push("ملاحظات", specs.notes);
  if (it.customer_notes) push("ملاحظات للعميل", it.customer_notes);
  return rows.length ? `<div class="specs">${rows.join("")}</div>` : "";
}

function internalCostBlock(it: any, primary: string): string {
  const cb = it.cost_breakdown ?? {};
  const entries = Object.entries(cb).filter(([, v]) => typeof v === "number" && v !== 0);
  if (!entries.length && !it.unit_cost) return "";
  const rows = entries.map(([k, v]) => `<tr><td>${labelCost(k)}</td><td>${currency(v as number)}</td></tr>`).join("");
  return `<div class="internal">
    <div class="internal-title" style="color:${primary}">تحليل التكلفة الداخلية</div>
    <table class="internal-table">${rows}${it.unit_cost ? `<tr><td>تكلفة الوحدة</td><td>${currency(it.unit_cost)}</td></tr>` : ""}</table>
    ${it.profit_margin_pct ? `<div class="internal-small">هامش الربح: ${percent(it.profit_margin_pct)}</div>` : ""}
    ${it.internal_notes ? `<div class="internal-small"><b>ملاحظات داخلية:</b> ${it.internal_notes}</div>` : ""}
  </div>`;
}

function labelCost(k: string): string {
  const m: Record<string, string> = {
    paperCost: "تكلفة الورق", printingCost: "تكلفة الطباعة", finishingCost: "تكلفة التشطيبات",
    setupCost: "تكلفة الضبط", wasteCost: "تكلفة الهالك", specialInkCost: "أحبار خاصة",
    packagingCost: "تكلفة التغليف", deliveryCost: "تكلفة التسليم", totalCost: "إجمالي التكلفة",
  };
  return m[k] ?? k;
}

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const { quotation, customer, items, brand, variant, salesRepName } = input;

  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.width = "800px";
  container.style.padding = "36px 40px";
  container.style.fontFamily = "'Cairo', 'Tajawal', Arial, sans-serif";
  container.style.color = "#1a1a1a";
  container.style.background = "#ffffff";
  container.style.fontSize = "12.5px";
  container.style.lineHeight = "1.55";

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quotations/${quotation.id}`;
  const qrDataUrl = brand.show_qr ? await QRCode.toDataURL(qrUrl, { margin: 0, width: 90 }) : "";

  const primary = brand.primary_color || "#C8102E";
  const secondary = brand.secondary_color || "#EE5A24";
  const accent = brand.accent_color || "#2C3E50";

  const subtotal = Number(quotation.subtotal ?? 0);
  const discount = Number(quotation.discount ?? 0);
  const taxAmount = Number(quotation.tax_amount ?? 0);
  const taxPct = Number(quotation.tax_pct ?? 0);
  const taxEnabled = !!quotation.tax_enabled;
  const finalPrice = Number(quotation.final_price ?? 0);

  const itemsHtml = items.map((it: any, i: number) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">
          <span class="item-no">بند ${it.item_number ?? i + 1}</span>
          <span>${it.title ?? "—"}</span>
        </div>
        <div class="item-qty">${number(it.quantity)} ${it.unit ?? "قطعة"}</div>
      </div>
      ${it.description ? `<div class="item-desc">${it.description}</div>` : ""}
      ${itemSpecsBlock(it)}
      <table class="item-price">
        <tr>
          <td>الكمية</td><td>${number(it.quantity)}</td>
          <td>سعر الوحدة</td><td>${currency(it.unit_price)}</td>
          <td>الإجمالي</td><td class="grand">${currency(it.total_price)}</td>
        </tr>
      </table>
      ${variant === "internal" ? internalCostBlock(it, primary) : ""}
    </div>
  `).join("");

  container.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .head { border-bottom: 3px solid ${secondary}; padding-bottom: 14px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
      .brand-block { display:flex; gap:14px; align-items:flex-start; }
      .brand-block img { max-height: 72px; max-width: 220px; object-fit: contain; }
      .brand-name { font-size: 20px; font-weight: 800; color: ${primary}; }
      .brand-name-en { font-size: 12px; color:#6b7280; margin-top: 2px; }
      .brand-meta { font-size: 10.5px; color:#6b7280; margin-top: 6px; }
      .quote-card { background: linear-gradient(135deg, ${primary}, ${secondary}); color:#fff; padding:10px 14px; border-radius:10px; min-width:200px; }
      .quote-card .k { font-size:10px; opacity:.85; }
      .quote-card .v { font-size:18px; font-weight:800; font-family: 'Courier New', monospace; }
      .internal-badge { margin-top:8px; text-align:center; background:#fef3c7; color:#7c5b12; font-size:10px; font-weight:700; padding:4px 8px; border-radius:6px; }

      .info { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px; }
      .info .box { background:#f8f4f2; border-right:3px solid ${primary}; border-radius:8px; padding:12px; }
      .info .lbl { font-size:10px; color:#6b7280; margin-bottom:4px; }
      .info .name { font-weight:700; font-size:13px; }
      .info .line { font-size:11px; color:#6b7280; margin-top:2px; }

      .section-title { font-size:13px; font-weight:700; color:${primary}; border-right:4px solid ${secondary}; padding-right:10px; margin: 18px 0 8px; }

      .item { border:1px solid #e5e7eb; border-radius:10px; margin-bottom:10px; overflow:hidden; page-break-inside: avoid; break-inside: avoid; }
      .item-head { background: linear-gradient(135deg, ${primary}08, ${secondary}12); padding:8px 12px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e5e7eb; }
      .item-title { display:flex; gap:8px; align-items:center; font-weight:700; font-size:13px; color: ${accent}; }
      .item-no { background:${primary}; color:#fff; padding:2px 8px; border-radius:6px; font-size:10.5px; font-weight:700; }
      .item-qty { font-size:11.5px; color: ${primary}; font-weight:700; }
      .item-desc { padding: 8px 12px 0; font-size:11.5px; color:#4b5563; }
      .specs { padding: 8px 12px; font-size:11px; color:#374151; display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; }
      .specs .lbl { color:#6b7280; }
      .item-price { width:100%; border-top:1px dashed #e5e7eb; margin-top:6px; font-size:11.5px; }
      .item-price td { padding: 8px 12px; }
      .item-price td:nth-child(odd) { color:#6b7280; font-size:10.5px; }
      .item-price td.grand { color:${primary}; font-weight:800; font-size:13px; }
      .internal { margin: 0 12px 12px; background:#fefce8; border:1px dashed #d4b34a; border-radius:8px; padding:8px 10px; }
      .internal-title { font-size:11px; font-weight:700; margin-bottom:4px; }
      .internal-table { width:100%; font-size:10.5px; }
      .internal-table td { padding: 2px 0; }
      .internal-small { font-size:10px; color:#7c5b12; margin-top:4px; }

      .totals { margin-top:14px; display:flex; justify-content:flex-end; page-break-inside: avoid; }
      .totals-box { min-width:320px; }
      .totals-row { display:flex; justify-content:space-between; padding:5px 10px; font-size:12px; }
      .totals-row.discount { color:#b91c1c; }
      .totals-final { background: linear-gradient(135deg, ${primary}, ${secondary}); color:#fff; padding:12px 14px; border-radius:10px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; }
      .totals-final .k { font-size:11px; opacity:.9; }
      .totals-final .v { font-size:20px; font-weight:800; }

      .terms { margin-top:16px; page-break-inside: avoid; }
      .terms-body { font-size:10.5px; color:#4b5563; }

      .footer { margin-top:22px; display:flex; justify-content:space-between; align-items:center; border-top:2px solid ${primary}; padding-top:12px; page-break-inside: avoid; }
      .footer-txt { font-size:9.5px; color:#6b7280; }
      .bank { margin-top:8px; padding:8px 10px; background:#f8f4f2; border-radius:6px; font-size:10px; color:#374151; }
    </style>

    <div class="head">
      <div class="brand-block">
        ${brand.logo_url ? `<img src="${brand.logo_url}" alt="logo" />` : ""}
        <div>
          <div class="brand-name">${brand.company_name_ar}</div>
          <div class="brand-name-en">${brand.company_name_en}</div>
          <div class="brand-meta">${brand.address ?? ""}</div>
          <div class="brand-meta" dir="ltr">${[brand.phone, brand.email, brand.website].filter(Boolean).join(" • ")}</div>
          ${brand.tax_number ? `<div class="brand-meta">الرقم الضريبي: ${brand.tax_number}</div>` : ""}
        </div>
      </div>
      <div>
        <div class="quote-card">
          <div class="k">رقم عرض السعر</div>
          <div class="v">${quotation.quotation_number}</div>
          <div class="k" style="margin-top:4px;">${dateAr(quotation.created_at)}</div>
        </div>
        ${variant === "internal" ? '<div class="internal-badge">نسخة داخلية — لا تُشارك مع العميل</div>' : ""}
      </div>
    </div>

    <div class="info">
      <div class="box">
        <div class="lbl">بيانات العميل</div>
        <div class="name">${customer?.company_name ?? "—"}</div>
        ${customer?.contact_person ? `<div class="line">${customer.contact_person}</div>` : ""}
        ${customer?.phone ? `<div class="line" dir="ltr">${customer.phone}</div>` : ""}
        ${customer?.email ? `<div class="line" dir="ltr">${customer.email}</div>` : ""}
      </div>
      <div class="box">
        <div class="lbl">تفاصيل العرض</div>
        <div class="line"><b>عدد البنود:</b> ${items.length}</div>
        <div class="line"><b>مدة التسليم:</b> ${quotation.delivery_days ?? "—"} يوم</div>
        <div class="line"><b>صلاحية العرض:</b> ${quotation.validity_days ?? brand.default_validity_days} يوم</div>
        <div class="line"><b>شروط الدفع:</b> ${quotation.payment_terms ?? brand.default_payment_terms}</div>
        ${salesRepName ? `<div class="line"><b>المندوب:</b> ${salesRepName}</div>` : ""}
      </div>
    </div>

    <div class="section-title">بنود عرض السعر</div>
    ${itemsHtml}

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row"><span>المجموع قبل الخصم</span><b>${currency(subtotal)}</b></div>
        ${discount > 0 ? `<div class="totals-row discount"><span>الخصم</span><b>- ${currency(discount)}</b></div>` : ""}
        ${taxEnabled && taxAmount > 0 ? `<div class="totals-row"><span>الضريبة (${percent(taxPct)})</span><b>${currency(taxAmount)}</b></div>` : ""}
        <div class="totals-final">
          <span class="k">السعر النهائي ${taxEnabled ? "(شامل الضريبة)" : ""}</span>
          <span class="v">${currency(finalPrice)}</span>
        </div>
      </div>
    </div>

    ${brand.default_terms ? `<div class="terms">
      <div class="section-title">الشروط والأحكام</div>
      <div class="terms-body">${brand.default_terms}</div>
      <div class="terms-body" style="margin-top:4px;">هذا العرض ساري لمدة ${quotation.validity_days ?? brand.default_validity_days} يوم من تاريخ الإصدار.</div>
    </div>` : ""}

    ${quotation.customer_notes ? `<div class="terms"><div class="section-title">ملاحظات</div><div class="terms-body">${quotation.customer_notes}</div></div>` : ""}

    ${brand.show_bank_details && brand.bank_name ? `<div class="bank">
      <b>بيانات التحويل البنكي:</b> ${brand.bank_name}
      ${brand.bank_account ? ` • حساب: <span dir="ltr">${brand.bank_account}</span>` : ""}
      ${brand.bank_iban ? ` • IBAN: <span dir="ltr">${brand.bank_iban}</span>` : ""}
      ${brand.bank_swift ? ` • SWIFT: <span dir="ltr">${brand.bank_swift}</span>` : ""}
    </div>` : ""}

    <div class="footer">
      <div class="footer-txt">
        ${brand.pdf_footer ?? ""}<br/>
        ${brand.company_name_ar} • ${brand.address ?? ""}<br/>
        <span dir="ltr">${brand.phone ?? ""} • ${brand.email ?? ""}</span>
      </div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" width="80" height="80" alt="QR" />` : ""}
    </div>
  `;

  // Isolate from app CSS (Tailwind v4 uses oklch which html2canvas cannot parse).
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.colorScheme = "light";
  document.body.appendChild(container);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  await pdf.html(container, {
    callback: () => {},
    x: 20, y: 20,
    width: 555, windowWidth: 800,
    autoPaging: "text",
    margin: [30, 20, 30, 20],
    html2canvas: {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: 2,
      logging: false,
      onclone: (clonedDoc: Document) => {
        // Remove ALL app stylesheets so oklch/oklab CSS variables never reach html2canvas.
        clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
          // Preserve our inline <style> that lives INSIDE the cloned container.
          if (!container.contains(el) && !clonedDoc.body.contains(el.closest("[dir='rtl']") as Node | null)) {
            el.parentNode?.removeChild(el);
          }
        });
        // Neutralize inherited CSS custom properties that resolve to oklch on :root/body.
        const reset = clonedDoc.createElement("style");
        reset.textContent = `
          :root, html, body { color-scheme: light !important; background: #ffffff !important; color: #1a1a1a !important; }
          :root * { --tw-ring-color: transparent; }
        `;
        clonedDoc.head.appendChild(reset);
      },
    } as any,
  });
  document.body.removeChild(container);

  // Page numbers + brand-color footer bar
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(`صفحة ${i} من ${pageCount}`, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 14, { align: "center" });
  }

  return pdf.output("blob");
}

// Back-compat: old imports.
export function loadCompanySettings() {
  // Deprecated — kept to avoid breaking older imports; prefer useBrand()/fetchBrand().
  return {} as any;
}
