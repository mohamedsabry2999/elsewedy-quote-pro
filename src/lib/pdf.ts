// PDF generation for Elsewedy quotations. Uses jsPDF + autoTable.
// Because embedding an Arabic TTF at runtime is heavy, we render Arabic text
// as inline SVG via a canvas-to-image pipeline for the header/title, but keep
// tabular content in Arabic using the default helvetica font with Unicode.
// jsPDF supports Unicode when a font that contains the glyphs is embedded.
// We embed Cairo-Regular from @fontsource/cairo at runtime.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { currency, dateAr, number, percent } from "./format";
import type { PricingBreakdown } from "./pricing";

export interface CompanySettings {
  name: string;
  name_en: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_number?: string;
  terms?: string;
  footer?: string;
}

export const DEFAULT_COMPANY: CompanySettings = {
  name: "مطبعة السويدي",
  name_en: "Elsewedy Print House",
  address: "المنطقة الصناعية، العاشر من رمضان، الشرقية، مصر",
  phone: "+20 100 000 0000",
  email: "info@elsewedy-print.com",
  website: "www.elsewedy-print.com",
  terms: "الأسعار سارية خلال فترة الصلاحية الموضحة أدناه. تُحتسب أي تعديلات على المواصفات في السعر النهائي.",
  footer: "شكراً لاختياركم Elsewedy Print House — نلتزم بأعلى معايير الجودة والدقة في التسليم.",
};

let cairoBase64Cache: string | null = null;
async function loadCairoFont(): Promise<string> {
  if (cairoBase64Cache) return cairoBase64Cache;
  const url = new URL("@fontsource/cairo/files/cairo-arabic-500-normal.woff", import.meta.url);
  const res = await fetch(url.toString());
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  cairoBase64Cache = btoa(bin);
  return cairoBase64Cache;
}

export interface QuotationPdfInput {
  quotation: any;
  customer: any;
  items: any[];
  breakdown?: Partial<PricingBreakdown>;
  company: CompanySettings;
  variant: "customer" | "internal";
  salesRepName?: string | null;
}

// Fallback approach: since embedding+shaping Arabic in jsPDF is fragile in Workers,
// we render the PDF using an HTML source printed via window.print, but for
// programmatic PDF we build a canvas per page. To keep this reliable and fast,
// we generate an HTML document and use jsPDF's html() method with proper RTL.

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const { quotation, customer, items, breakdown, company, variant, salesRepName } = input;

  // Build an HTML document; jsPDF's html() renders via html2canvas for full unicode+RTL fidelity.
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.width = "800px";
  container.style.padding = "40px";
  container.style.fontFamily = "'Cairo', 'Tajawal', Arial, sans-serif";
  container.style.color = "#0f1936";
  container.style.background = "#ffffff";
  container.style.fontSize = "13px";
  container.style.lineHeight = "1.6";

  const qrUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quotations/${quotation.id}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 0, width: 90 });

  const finishingsAr = (quotation.specs?.finishingKeys ?? []).join("، ");

  const internalRows = variant === "internal" && breakdown ? `
    <tr><td>تكلفة الورق</td><td>${currency(breakdown.paperCost ?? 0)}</td></tr>
    <tr><td>تكلفة الطباعة</td><td>${currency(breakdown.printingCost ?? 0)}</td></tr>
    <tr><td>تكلفة التشطيبات</td><td>${currency(breakdown.finishingCost ?? 0)}</td></tr>
    <tr><td>تكلفة الضبط</td><td>${currency(breakdown.setupCost ?? 0)}</td></tr>
    <tr><td>إجمالي التكلفة</td><td><b>${currency(breakdown.totalCost ?? 0)}</b></td></tr>
    <tr><td>الربح</td><td>${currency(breakdown.profit ?? 0)}</td></tr>
    <tr><td>هامش الربح ٪</td><td>${percent(quotation.profit_margin_pct)}</td></tr>
    <tr><td>الخصم</td><td>${currency(quotation.discount)}</td></tr>
  ` : "";

  container.innerHTML = `
    <div style="border-bottom:3px solid #b48a3b; padding-bottom:16px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-size:22px; font-weight:800; color:#1c2b58;">${company.name}</div>
        <div style="font-size:12px; color:#5a6788; margin-top:2px;">${company.name_en}</div>
        <div style="font-size:11px; color:#5a6788; margin-top:6px;">${company.address}</div>
        <div style="font-size:11px; color:#5a6788;" dir="ltr">${company.phone} • ${company.email} • ${company.website}</div>
      </div>
      <div style="text-align:left;">
        <div style="background:linear-gradient(135deg,#1c2b58,#3b5199); color:#fff; padding:10px 14px; border-radius:10px; min-width:180px;">
          <div style="font-size:11px; opacity:.85;">رقم عرض السعر</div>
          <div style="font-size:18px; font-weight:800; font-family:monospace;">${quotation.quotation_number}</div>
          <div style="font-size:11px; opacity:.85; margin-top:4px;">${dateAr(quotation.created_at)}</div>
        </div>
        ${variant === "internal" ? '<div style="margin-top:8px; text-align:center; background:#fef3c7; color:#7c5b12; font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px;">نسخة داخلية — لا تُشارك مع العميل</div>' : ""}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:20px;">
      <div style="background:#f5f6fa; border-radius:10px; padding:14px;">
        <div style="font-size:11px; color:#7482a4; margin-bottom:6px;">بيانات العميل</div>
        <div style="font-weight:700; font-size:14px;">${customer?.company_name ?? "—"}</div>
        ${customer?.contact_person ? `<div style="font-size:12px; margin-top:2px;">${customer.contact_person}</div>` : ""}
        ${customer?.phone ? `<div style="font-size:11px; color:#5a6788;" dir="ltr">${customer.phone}</div>` : ""}
        ${customer?.email ? `<div style="font-size:11px; color:#5a6788;" dir="ltr">${customer.email}</div>` : ""}
      </div>
      <div style="background:#f5f6fa; border-radius:10px; padding:14px;">
        <div style="font-size:11px; color:#7482a4; margin-bottom:6px;">تفاصيل العرض</div>
        <div style="font-size:12px;"><b>مدة التسليم:</b> ${quotation.delivery_days ?? "—"} يوم</div>
        <div style="font-size:12px;"><b>صلاحية العرض:</b> ${quotation.validity_days ?? 30} يوم</div>
        <div style="font-size:12px;"><b>شروط الدفع:</b> ${quotation.payment_terms ?? "—"}</div>
        ${salesRepName ? `<div style="font-size:12px;"><b>المندوب:</b> ${salesRepName}</div>` : ""}
      </div>
    </div>

    <div style="margin-top:20px;">
      <div style="font-size:13px; font-weight:700; color:#1c2b58; border-right:4px solid #b48a3b; padding-right:10px; margin-bottom:8px;">تفاصيل المنتج</div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#1c2b58; color:#fff;">
            <th style="padding:10px; text-align:right;">الوصف</th>
            <th style="padding:10px; text-align:center; width:80px;">الكمية</th>
            <th style="padding:10px; text-align:center; width:110px;">سعر الوحدة</th>
            <th style="padding:10px; text-align:center; width:120px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it) => `
            <tr style="border-bottom:1px solid #e5e8f0;">
              <td style="padding:10px;">
                <div style="font-weight:700;">${it.title ?? "—"}</div>
                ${it.description ? `<div style="font-size:11px; color:#5a6788; margin-top:2px;">${it.description}</div>` : ""}
                ${finishingsAr ? `<div style="font-size:11px; color:#5a6788; margin-top:2px;">التشطيبات: ${finishingsAr}</div>` : ""}
              </td>
              <td style="padding:10px; text-align:center;">${number(it.quantity)}</td>
              <td style="padding:10px; text-align:center;">${currency(it.unit_price)}</td>
              <td style="padding:10px; text-align:center; font-weight:700;">${currency(it.total_price)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div style="margin-top:16px; display:flex; justify-content:flex-end;">
      <div style="min-width:280px;">
        <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:12px;"><span>المجموع قبل الخصم</span><b>${currency(quotation.subtotal)}</b></div>
        ${Number(quotation.discount) > 0 ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:12px; color:#b91c1c;"><span>الخصم</span><b>- ${currency(quotation.discount)}</b></div>` : ""}
        <div style="background:linear-gradient(135deg,#1c2b58,#3b5199); color:#fff; padding:12px 14px; border-radius:10px; margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; opacity:.9;">السعر النهائي</span>
          <span style="font-size:20px; font-weight:800;">${currency(quotation.final_price)}</span>
        </div>
      </div>
    </div>

    ${internalRows ? `
    <div style="margin-top:20px; border:1px dashed #d1d5db; border-radius:10px; padding:14px; background:#fefce8;">
      <div style="font-size:12px; font-weight:700; color:#7c5b12; margin-bottom:8px;">تحليل التكلفة الداخلية</div>
      <table style="width:100%; font-size:12px;">${internalRows}</table>
      ${quotation.internal_notes ? `<div style="margin-top:8px; font-size:11px;"><b>ملاحظات داخلية:</b> ${quotation.internal_notes}</div>` : ""}
    </div>` : ""}

    ${company.terms ? `<div style="margin-top:20px;">
      <div style="font-size:12px; font-weight:700; color:#1c2b58; border-right:4px solid #b48a3b; padding-right:10px; margin-bottom:6px;">الشروط والأحكام</div>
      <div style="font-size:11px; color:#5a6788;">${company.terms}</div>
      <div style="font-size:11px; color:#5a6788; margin-top:4px;">هذا العرض ساري لمدة ${quotation.validity_days ?? 30} يوم من تاريخ الإصدار.</div>
    </div>` : ""}

    ${quotation.customer_notes ? `<div style="margin-top:14px; font-size:11px;"><b>ملاحظات:</b> ${quotation.customer_notes}</div>` : ""}

    <div style="margin-top:24px; display:flex; justify-content:space-between; align-items:center; border-top:2px solid #1c2b58; padding-top:14px;">
      <div style="font-size:10px; color:#7482a4;">
        ${company.footer ?? ""}<br/>
        ${company.name} • ${company.address}<br/>
        <span dir="ltr">${company.phone} • ${company.email}</span>
      </div>
      <img src="${qrDataUrl}" width="80" height="80" alt="QR" />
    </div>
  `;

  document.body.appendChild(container);
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  await pdf.html(container, {
    callback: () => {},
    x: 20, y: 20,
    width: 555, windowWidth: 800,
    autoPaging: "text",
  });
  document.body.removeChild(container);

  // Add page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(`Page ${i} of ${pageCount}`, 300, 830, { align: "center" });
  }

  return pdf.output("blob");
}

export function whatsappMessage(customerName: string, productName: string, quotationNumber: string, egyptTz = "Africa/Cairo"): string {
  const now = new Date();
  const hourStr = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: egyptTz }).format(now);
  const hour = parseInt(hourStr, 10);
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  return `${greeting} أستاذ/ة ${customerName}\n\nمرفق لحضرتك عرض السعر رقم ${quotationNumber} الخاص بـ ${productName} من Elsewedy Print House.\n\nبرجاء المراجعة، ويسعدنا الرد على أي استفسار من حضرتك.\n\nتحياتنا،\nمطبعة السويدي — Elsewedy Print House`;
}

export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

void loadCairoFont; // reserved for future direct-font embedding path
