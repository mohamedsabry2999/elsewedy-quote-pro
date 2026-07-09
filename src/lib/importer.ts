// Smart Excel/CSV import engine
// - Auto-detects header row (first row with >= 2 non-empty text cells whose values look like labels)
// - Fuzzy header matching against a DB-backed alias dictionary + built-in aliases
// - Value normalizers (numbers with EGP/ج.م, phones, dates as text)
// - Validators per module
// - Batch save through Supabase with import_batch_id for rollback

import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export type ImportModule =
  | "customers"
  | "quotations"
  | "quotation_items"
  | "pricing_rules"
  | "finishing"
  | "job_orders";

export type FieldType = "text" | "number" | "phone" | "email" | "date" | "boolean";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  aliases: string[]; // built-in fallback aliases
}

export interface FieldSchema {
  module: ImportModule;
  table: string;
  fields: FieldSpec[];
  uniqueBy?: string;                       // used for dedupe / upsert
  transform?: (row: Record<string, any>) => Record<string, any>;
}

// ============ Built-in schemas ============
const CUSTOMER_SCHEMA: FieldSchema = {
  module: "customers", table: "customers", uniqueBy: "company_name",
  fields: [
    { key: "company_name", label: "اسم الشركة", type: "text", required: true, aliases: ["company","company name","اسم الشركة","العميل","الشركة","customer","customer name"] },
    { key: "contact_person", label: "الشخص المسؤول", type: "text", aliases: ["contact","contact person","الشخص","المسؤول","جهة الاتصال"] },
    { key: "phone", label: "الهاتف", type: "phone", aliases: ["phone","mobile","tel","الهاتف","التليفون","الجوال","الموبايل"] },
    { key: "whatsapp", label: "واتساب", type: "phone", aliases: ["whatsapp","wa","واتساب"] },
    { key: "email", label: "البريد", type: "email", aliases: ["email","mail","البريد","الإيميل","الايميل"] },
    { key: "industry", label: "النشاط", type: "text", aliases: ["industry","sector","النشاط","القطاع","الصناعة","المجال"] },
    { key: "address", label: "العنوان", type: "text", aliases: ["address","location","العنوان"] },
    { key: "notes", label: "ملاحظات", type: "text", aliases: ["notes","remarks","ملاحظات"] },
  ],
};

const PRICING_SCHEMA: FieldSchema = {
  module: "pricing_rules", table: "pricing_rules", uniqueBy: "key",
  fields: [
    { key: "category", label: "الفئة", type: "text", required: true, aliases: ["category","cost type","الفئة","النوع","نوع التكلفة"] },
    { key: "key", label: "المعرف", type: "text", required: true, aliases: ["key","code","المعرف","الكود"] },
    { key: "label_ar", label: "الوصف", type: "text", required: true, aliases: ["label","label ar","name","item name","الوصف","الاسم","اسم البند"] },
    { key: "value", label: "القيمة", type: "number", required: true, aliases: ["value","price","السعر","القيمة"] },
    { key: "unit", label: "الوحدة", type: "text", aliases: ["unit","الوحدة"] },
    { key: "is_active", label: "نشط", type: "boolean", aliases: ["active","is active","نشط"] },
  ],
  transform: (row) => ({ ...row, value: Number(row.value) || 0, is_active: row.is_active !== false }),
};

const FINISHING_SCHEMA: FieldSchema = {
  ...PRICING_SCHEMA, module: "finishing",
  transform: (row) => ({ ...row, category: "finishing", value: Number(row.value) || 0, is_active: row.is_active !== false }),
};

const QUOTATIONS_SCHEMA: FieldSchema = {
  module: "quotations", table: "quotations", uniqueBy: "quotation_number",
  fields: [
    { key: "quotation_number", label: "رقم عرض السعر", type: "text", aliases: ["quotation number","quote number","رقم العرض","رقم عرض السعر"] },
    { key: "customer_name", label: "اسم العميل", type: "text", required: true, aliases: ["customer","customer name","اسم العميل","العميل"] },
    { key: "product_category", label: "الفئة", type: "text", aliases: ["category","الفئة","النوع"] },
    { key: "status", label: "الحالة", type: "text", aliases: ["status","الحالة"] },
    { key: "final_price", label: "الإجمالي", type: "number", aliases: ["total","final total","الإجمالي","القيمة النهائية"] },
    { key: "issue_date", label: "التاريخ", type: "date", aliases: ["date","issue date","التاريخ","تاريخ العرض"] },
    { key: "notes", label: "ملاحظات", type: "text", aliases: ["notes","ملاحظات"] },
    { key: "sales_rep_email", label: "السيلز", type: "email", aliases: ["sales","sales rep","السيلز","مندوب المبيعات"] },
  ],
};

const JOB_ORDERS_SCHEMA: FieldSchema = {
  module: "job_orders", table: "job_orders", uniqueBy: "job_order_number",
  fields: [
    { key: "job_order_number", label: "رقم أمر التشغيل", type: "text", aliases: ["job order","job number","رقم أمر التشغيل"] },
    { key: "quotation_number", label: "رقم عرض السعر", type: "text", aliases: ["quotation number","رقم العرض"] },
    { key: "production_status", label: "حالة الإنتاج", type: "text", aliases: ["status","حالة الإنتاج","الحالة"] },
    { key: "due_date", label: "تاريخ التسليم", type: "date", aliases: ["due date","delivery date","تاريخ التسليم"] },
    { key: "production_notes", label: "ملاحظات", type: "text", aliases: ["notes","ملاحظات"] },
  ],
};

export const SCHEMAS: Record<ImportModule, FieldSchema> = {
  customers: CUSTOMER_SCHEMA,
  quotations: QUOTATIONS_SCHEMA,
  quotation_items: { ...CUSTOMER_SCHEMA, module: "quotation_items", table: "quotation_items" }, // placeholder
  pricing_rules: PRICING_SCHEMA,
  finishing: FINISHING_SCHEMA,
  job_orders: JOB_ORDERS_SCHEMA,
};

// ============ Helpers ============
const norm = (s: any) => String(s ?? "").toLowerCase().trim().replace(/[\s_\-\.]+/g, "");
const stripDia = (s: string) => s.normalize("NFKD").replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g, "");

export interface ParseResult {
  sheetNames: string[];
  headerRowIndex: number;
  headers: string[];
  rows: Record<string, any>[];
}

export async function parseFile(file: File, sheetIndex = 0): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: false, raw: false });

  // Detect header row: first row with >= 2 non-empty string cells that aren't purely numeric
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const row = aoa[i] ?? [];
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "");
    if (nonEmpty.length >= 2) {
      const stringy = nonEmpty.filter((c) => isNaN(Number(String(c).replace(/[,\s]/g, ""))) || String(c).length > 3);
      if (stringy.length >= 2) { headerRowIndex = i; break; }
    }
  }

  const rawHeaders = (aoa[headerRowIndex] ?? []).map((h, i) => String(h ?? "").trim() || `col_${i + 1}`);
  // Deduplicate headers
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h} (${n + 1})`;
  });

  const rows: Record<string, any>[] = [];
  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    if (row.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, any> = {};
    headers.forEach((h, j) => { obj[h] = row[j] ?? ""; });
    rows.push(obj);
  }
  return { sheetNames: wb.SheetNames, headerRowIndex, headers, rows };
}

export async function loadAliases(module: ImportModule): Promise<{ system_field: string; alias_name: string }[]> {
  const { data } = await supabase.from("field_aliases").select("system_field, alias_name").eq("module_name", module);
  return data ?? [];
}

export function autoMap(
  headers: string[],
  schema: FieldSchema,
  dbAliases: { system_field: string; alias_name: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const nHeaders = headers.map((h) => ({ orig: h, n: stripDia(norm(h)) }));

  for (const f of schema.fields) {
    const dbAls = dbAliases.filter((a) => a.system_field === f.key).map((a) => a.alias_name);
    const allAliases = [...f.aliases, f.key, f.label, ...dbAls].map((a) => stripDia(norm(a)));
    const hit = nHeaders.find((h) => allAliases.some((a) => h.n === a));
    if (hit) { map[f.key] = hit.orig; continue; }
    const contains = nHeaders.find((h) => allAliases.some((a) => a.length >= 3 && (h.n.includes(a) || a.includes(h.n))));
    if (contains) map[f.key] = contains.orig;
  }
  return map;
}

// ============ Normalizers ============
export function normalizeValue(raw: any, type: FieldType): any {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  switch (type) {
    case "number": {
      const cleaned = s.replace(/[,\s]/g, "").replace(/ج\.م|جم|EGP|LE|USD|\$/gi, "").replace(/[^\d\.\-]/g, "");
      const n = Number(cleaned);
      return isNaN(n) ? null : n;
    }
    case "phone": {
      const digits = s.replace(/[^\d+]/g, "");
      return digits || null;
    }
    case "email": {
      const v = s.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
    }
    case "date": {
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    case "boolean": {
      const v = s.toLowerCase();
      if (["true", "1", "yes", "y", "نعم", "مفعل", "نشط"].includes(v)) return true;
      if (["false", "0", "no", "n", "لا", "معطل", "غير نشط"].includes(v)) return false;
      return null;
    }
    default:
      return s;
  }
}

export interface RowError {
  row: number;
  field?: string;
  message: string;
  rawData: Record<string, any>;
}

export function validateRow(
  mapped: Record<string, any>,
  schema: FieldSchema,
  rowNumber: number,
  rawRow: Record<string, any>,
): RowError[] {
  const errors: RowError[] = [];
  for (const f of schema.fields) {
    const v = mapped[f.key];
    if (f.required && (v === null || v === undefined || v === "")) {
      errors.push({ row: rowNumber, field: f.key, message: `الصف رقم ${rowNumber}: ${f.label} مطلوب`, rawData: rawRow });
    }
    if (v != null && v !== "") {
      if (f.type === "number" && typeof v !== "number") {
        errors.push({ row: rowNumber, field: f.key, message: `الصف رقم ${rowNumber}: ${f.label} يجب أن يكون رقمًا`, rawData: rawRow });
      }
      if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
        errors.push({ row: rowNumber, field: f.key, message: `الصف رقم ${rowNumber}: ${f.label} صيغة بريد غير صحيحة`, rawData: rawRow });
      }
    }
  }
  return errors;
}

export interface ImportOptions {
  createOnly?: boolean;      // don't update existing (by uniqueBy)
  updateExisting?: boolean;  // upsert on uniqueBy
  skipDuplicates?: boolean;  // silently skip if uniqueBy matches
  assignToUserId?: string | null; // for quotations
}

export interface ImportSummary {
  batchId: string;
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
}

export async function runImport(params: {
  file: File;
  schema: FieldSchema;
  rows: Record<string, any>[];
  mapping: Record<string, string>; // system_field -> header
  options: ImportOptions;
  currentUserId: string;
  currentUserName: string | null;
  extraDefaults?: Record<string, any>;
}): Promise<ImportSummary> {
  const { file, schema, rows, mapping, options, currentUserId, currentUserName, extraDefaults } = params;

  // 1) create batch
  const { data: batch, error: batchErr } = await supabase.from("import_batches").insert({
    file_name: file.name,
    target_module: schema.module,
    uploaded_by: currentUserId,
    uploaded_by_name: currentUserName,
    total_rows: rows.length,
    status: "processing",
    options: options as any,
    mapping: mapping as any,
  }).select("id").single();
  if (batchErr || !batch) throw batchErr ?? new Error("failed to create batch");
  const batchId = batch.id as string;

  // 2) map + validate all rows
  const errors: RowError[] = [];
  const validRows: Record<string, any>[] = [];
  rows.forEach((r, i) => {
    const rowNumber = i + 2; // header at row 1
    const out: Record<string, any> = { ...(extraDefaults ?? {}) };
    for (const f of schema.fields) {
      const header = mapping[f.key];
      if (!header) continue;
      const raw = r[header];
      out[f.key] = normalizeValue(raw, f.type);
    }
    const rowErrors = validateRow(out, schema, rowNumber, r);
    if (rowErrors.length) { errors.push(...rowErrors); return; }
    const finalRow = schema.transform ? schema.transform(out) : out;
    finalRow.import_batch_id = batchId;
    validRows.push(finalRow);
  });

  // 3) insert / upsert in chunks
  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const CHUNK = 200;
  for (let i = 0; i < validRows.length; i += CHUNK) {
    const slice = validRows.slice(i, i + CHUNK);
    try {
      if (options.updateExisting && schema.uniqueBy) {
        const { error } = await supabase.from(schema.table as any).upsert(slice as any, { onConflict: schema.uniqueBy });
        if (error) throw error;
        updated += slice.length;
      } else if (options.skipDuplicates && schema.uniqueBy) {
        const { error } = await supabase.from(schema.table as any).upsert(slice as any, { onConflict: schema.uniqueBy, ignoreDuplicates: true });
        if (error) throw error;
        inserted += slice.length;
      } else {
        const { error } = await supabase.from(schema.table as any).insert(slice as any);
        if (error) throw error;
        inserted += slice.length;
      }
    } catch (e: any) {
      failed += slice.length;
      slice.forEach((row, j) => errors.push({
        row: i + j + 2, message: `فشل حفظ الصف: ${e.message ?? e}`, rawData: row,
      }));
    }
  }

  // 4) save errors
  if (errors.length) {
    const errRecords = errors.map((e) => ({
      import_batch_id: batchId,
      row_number: e.row,
      field_name: e.field ?? null,
      error_message: e.message,
      raw_row_data: e.rawData as any,
    }));
    for (let i = 0; i < errRecords.length; i += 500) {
      await supabase.from("import_errors").insert(errRecords.slice(i, i + 500) as any);
    }
  }

  // 5) close batch
  const status = failed > 0 ? "completed_with_errors" : "completed";
  await supabase.from("import_batches").update({
    total_rows: rows.length,
    success_rows: inserted + updated,
    failed_rows: failed + errors.filter((e) => !e.message.startsWith("فشل حفظ")).length,
    skipped_rows: skipped,
    status,
  }).eq("id", batchId);

  return { batchId, totalRows: rows.length, inserted, updated, skipped, failed, errors };
}

// ============ Utilities ============
export function downloadErrorReport(errors: RowError[], fileName = "import_errors.xlsx") {
  const rows = errors.map((e) => ({
    "الصف": e.row,
    "الحقل": e.field ?? "",
    "الخطأ": e.message,
    ...e.rawData,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "errors");
  XLSX.writeFile(wb, fileName);
}

export function downloadTemplate(schema: FieldSchema, fileName?: string) {
  const sample: Record<string, string> = {};
  schema.fields.forEach((f) => { sample[f.label] = ""; });
  const ws = XLSX.utils.json_to_sheet([sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "template");
  XLSX.writeFile(wb, fileName ?? `${schema.module}_template.xlsx`);
}
