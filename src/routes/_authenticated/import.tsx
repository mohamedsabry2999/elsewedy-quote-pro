import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canManagePricing, canManageCustomers } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "استيراد من Excel — Elsewedy Smart Quotation" }] }),
  component: ImportPage,
});

type Row = Record<string, any>;

// Target fields for each import type + Arabic + english alias hints for auto-mapping
const CUSTOMER_FIELDS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "company_name",   label: "اسم الشركة",   required: true, aliases: ["company", "company_name", "الشركة", "اسم الشركة", "customer", "العميل"] },
  { key: "contact_person", label: "الشخص المسؤول", aliases: ["contact", "person", "الشخص", "المسؤول"] },
  { key: "phone",          label: "الهاتف",       aliases: ["phone", "tel", "الهاتف", "الجوال", "الموبايل"] },
  { key: "whatsapp",       label: "واتساب",       aliases: ["whatsapp", "wa", "واتساب"] },
  { key: "email",          label: "البريد",       aliases: ["email", "mail", "البريد", "الإيميل"] },
  { key: "address",        label: "العنوان",      aliases: ["address", "العنوان"] },
  { key: "industry",       label: "النشاط",       aliases: ["industry", "sector", "النشاط", "القطاع"] },
  { key: "notes",          label: "ملاحظات",      aliases: ["notes", "note", "ملاحظات"] },
];

const RULE_FIELDS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "category", label: "الفئة",   required: true, aliases: ["category", "الفئة", "النوع"] },
  { key: "key",      label: "المعرف",  required: true, aliases: ["key", "code", "المعرف", "الكود"] },
  { key: "label_ar", label: "الوصف",   required: true, aliases: ["label", "label_ar", "name", "الوصف", "الاسم"] },
  { key: "value",    label: "القيمة",  required: true, aliases: ["value", "price", "القيمة", "السعر"] },
  { key: "unit",     label: "الوحدة",  aliases: ["unit", "الوحدة"] },
];

function autoMap(headers: string[], fields: { key: string; aliases: string[] }[]): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toString().toLowerCase().trim().replace(/[_\s-]/g, "");
  for (const f of fields) {
    const match = headers.find((h) => f.aliases.some((a) => norm(h) === norm(a) || norm(h).includes(norm(a))));
    if (match) map[f.key] = match;
  }
  return map;
}

function ImportPage() {
  const auth = useAuth();
  const canCustomers = canManageCustomers(auth.roles);
  const canRules = canManagePricing(auth.roles);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="size-6 text-gold" /> استيراد من Excel</h1>
        <p className="text-sm text-muted-foreground">استيراد مرن من ملفات Excel/CSV مع ربط ذكي لأسماء الأعمدة.</p>
      </div>

      <Tabs defaultValue={canCustomers ? "customers" : "rules"} className="space-y-4">
        <TabsList>
          {canCustomers && <TabsTrigger value="customers">العملاء</TabsTrigger>}
          {canRules && <TabsTrigger value="rules">قواعد التسعير / الورق / التشطيبات</TabsTrigger>}
        </TabsList>

        {canCustomers && <TabsContent value="customers">
          <ImportPanel
            fields={CUSTOMER_FIELDS}
            sampleName="customers"
            table="customers"
            uniqueBy="company_name"
            extraInsert={{ owner_id: auth.userId }}
          />
        </TabsContent>}

        {canRules && <TabsContent value="rules">
          <ImportPanel
            fields={RULE_FIELDS}
            sampleName="pricing_rules"
            table="pricing_rules"
            uniqueBy="key"
            transform={(row) => ({ ...row, value: Number(row.value) || 0 })}
          />
        </TabsContent>}
      </Tabs>
    </div>
  );
}

interface ImportPanelProps {
  fields: { key: string; label: string; required?: boolean; aliases: string[] }[];
  sampleName: string;
  table: "customers" | "pricing_rules";
  uniqueBy: string;
  extraInsert?: Record<string, any>;
  transform?: (row: Row) => Row;
}

function ImportPanel({ fields, sampleName, table, uniqueBy, extraInsert, transform }: ImportPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ inserted: number; skipped: number } | null>(null);

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
    if (!json.length) return toast.error("الملف فارغ");
    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRows(json);
    setMapping(autoMap(hdrs, fields));
    setDone(null);
    toast.success(`تم قراءة ${json.length} صف`);
  };

  const preview = useMemo(() => rows.slice(0, 5).map((r) => {
    const out: Row = {};
    fields.forEach((f) => { out[f.key] = mapping[f.key] ? r[mapping[f.key]] : ""; });
    return out;
  }), [rows, mapping, fields]);

  const missing = fields.filter((f) => f.required && !mapping[f.key]);

  const runImport = async () => {
    if (missing.length) return toast.error(`اربط الأعمدة المطلوبة: ${missing.map((f) => f.label).join("، ")}`);
    setBusy(true);
    try {
      const mapped: Row[] = rows.map((r) => {
        const out: Row = { ...extraInsert };
        fields.forEach((f) => {
          const v = mapping[f.key] ? r[mapping[f.key]] : "";
          if (v !== "" && v != null) out[f.key] = v;
        });
        return transform ? transform(out) : out;
      }).filter((r) => r[uniqueBy]);

      let inserted = 0, skipped = 0;
      const chunk = 200;
      for (let i = 0; i < mapped.length; i += chunk) {
        const slice = mapped.slice(i, i + chunk);
        const { error } = table === "pricing_rules"
          ? await supabase.from("pricing_rules").upsert(slice as any, { onConflict: "key" })
          : await supabase.from("customers").insert(slice as any);
        if (error) { skipped += slice.length; console.error(error); }
        else inserted += slice.length;
      }
      setDone({ inserted, skipped });
      toast.success(`تم استيراد ${inserted} صف${skipped ? ` — تخطي ${skipped}` : ""}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const downloadSample = () => {
    const sample: Row = {};
    fields.forEach((f) => { sample[f.label] = ""; });
    const ws = XLSX.utils.json_to_sheet([sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "sheet1");
    XLSX.writeFile(wb, `${sampleName}_template.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">رفع ملف Excel / CSV</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadSample}><Download className="size-4 ms-1" /> تحميل نموذج فارغ</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="border-2 border-dashed rounded-lg p-6 text-center block cursor-pointer hover:border-primary">
          <Upload className="size-8 mx-auto text-muted-foreground" />
          <div className="mt-2 text-sm">اسحب الملف هنا أو اضغط للاختيار</div>
          <Input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>

        {headers.length > 0 && (
          <>
            <div>
              <div className="text-sm font-semibold mb-2">ربط الأعمدة</div>
              <div className="grid md:grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
                    <select className="w-full h-10 rounded-md border bg-transparent px-3" value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                      <option value="">— بدون —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">معاينة أول 5 صفوف</div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow>{fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>{fields.map((f) => <TableCell key={f.key} className="text-xs">{String(r[f.key] ?? "")}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Badge variant="secondary">{rows.length} صف</Badge>
                {missing.length > 0 && <span className="text-destructive ms-2">اربط: {missing.map((f) => f.label).join("، ")}</span>}
              </div>
              <Button onClick={runImport} disabled={busy || missing.length > 0} className="gradient-primary">
                {busy ? "جاري..." : `استيراد ${rows.length} صف`}
              </Button>
            </div>

            {done && (
              <div className="rounded-lg bg-success/10 border border-success p-3 flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" />
                تم إدراج {done.inserted} صف{done.skipped ? ` — تم تخطي ${done.skipped} صف` : ""}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
