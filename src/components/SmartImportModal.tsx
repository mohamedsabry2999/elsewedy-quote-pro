import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, X } from "lucide-react";
import {
  autoMap, downloadErrorReport, downloadTemplate, loadAliases, normalizeValue,
  parseFile, runImport, SCHEMAS, validateRow,
  type FieldSchema, type ImportModule, type ImportOptions, type ImportSummary, type RowError,
} from "@/lib/importer";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  module: ImportModule;
  onComplete?: (summary: ImportSummary) => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function SmartImportModal({ open, onOpenChange, module, onComplete }: Props) {
  const auth = useAuth();
  const schema: FieldSchema = SCHEMAS[module];

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dbAliases, setDbAliases] = useState<{ system_field: string; alias_name: string }[]>([]);
  const [options, setOptions] = useState<ImportOptions>({ createOnly: true });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (open) loadAliases(module).then(setDbAliases);
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module]);

  function reset() {
    setStep(1); setFile(null); setHeaders([]); setRows([]); setMapping({});
    setOptions({ createOnly: true }); setBusy(false); setProgress(0); setSummary(null);
  }

  async function handleFile(f: File) {
    setBusy(true);
    try {
      const parsed = await parseFile(f);
      if (!parsed.rows.length) { toast.error("الملف فارغ أو لا يحتوي بيانات"); setBusy(false); return; }
      setFile(f); setHeaders(parsed.headers); setRows(parsed.rows);
      setMapping(autoMap(parsed.headers, schema, dbAliases));
      toast.success(`تم قراءة ${parsed.rows.length} صف من الملف`);
      setStep(2);
    } catch (e: any) { toast.error(e.message ?? "تعذر قراءة الملف"); }
    finally { setBusy(false); }
  }

  const mappedPreview = useMemo(() => rows.slice(0, 20).map((r) => {
    const o: Record<string, any> = {};
    schema.fields.forEach((f) => {
      const h = mapping[f.key];
      o[f.key] = h ? normalizeValue(r[h], f.type) : null;
    });
    return o;
  }), [rows, mapping, schema]);

  const validationErrors = useMemo(() => {
    const out: RowError[] = [];
    rows.forEach((r, i) => {
      const mapped: Record<string, any> = {};
      schema.fields.forEach((f) => {
        const h = mapping[f.key];
        mapped[f.key] = h ? normalizeValue(r[h], f.type) : null;
      });
      out.push(...validateRow(mapped, schema, i + 2, r));
    });
    return out;
  }, [rows, mapping, schema]);

  const missingRequired = schema.fields.filter((f) => f.required && !mapping[f.key]);

  async function doImport() {
    if (!file || !auth.userId) return;
    setBusy(true); setProgress(30);
    try {
      const extraDefaults: Record<string, any> = {};
      if (module === "customers") extraDefaults.owner_id = auth.userId;
      if (module === "quotations") extraDefaults.sales_rep_id = options.assignToUserId ?? auth.userId;
      const s = await runImport({
        file, schema, rows, mapping, options,
        currentUserId: auth.userId, currentUserName: auth.fullName,
        extraDefaults,
      });
      setProgress(100); setSummary(s); setStep(5);
      onComplete?.(s);
    } catch (e: any) { toast.error(e.message ?? "فشل الاستيراد"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> استيراد البيانات من Excel
          </DialogTitle>
          <DialogDescription>
            محرك ذكي يفهم الأعمدة العربية والإنجليزية بأي ترتيب — {schema.fields.length} حقل مدعوم للوحدة "{module}".
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-4 text-xs">
          {["رفع", "ربط الأعمدة", "معاينة وتحقق", "خيارات", "النتيجة"].map((t, i) => (
            <div key={t} className={`flex items-center gap-2 ${step > i ? "text-primary" : step === i + 1 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
              <div className={`size-6 rounded-full flex items-center justify-center border ${step > i ? "bg-primary text-primary-foreground border-primary" : step === i + 1 ? "border-primary" : ""}`}>
                {step > i ? <CheckCircle2 className="size-3.5" /> : i + 1}
              </div>
              {t}
              {i < 4 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Upload */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(schema)}><Download className="size-4 ms-1" /> تحميل نموذج Excel</Button>
            </div>
            <label className="border-2 border-dashed rounded-xl p-10 text-center block cursor-pointer hover:border-primary hover:bg-muted/30 transition">
              <Upload className="size-10 mx-auto text-muted-foreground" />
              <div className="mt-3 font-semibold">اسحب ملف Excel/CSV هنا أو اضغط لاختياره</div>
              <div className="text-xs text-muted-foreground mt-1">يدعم .xlsx و .xls و .csv — النموذج اختياري، النظام يفهم أي ترتيب أعمدة</div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
        )}

        {/* Step 2 — Mapping */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div><Badge variant="secondary">{file?.name}</Badge> — {rows.length} صف — {headers.length} عمود</div>
              <div className="text-muted-foreground">تم التعرف تلقائياً على {Object.values(mapping).filter(Boolean).length}/{schema.fields.length}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pe-2">
              {schema.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>{f.label} {f.required && <span className="text-destructive">*</span>}</span>
                    {mapping[f.key] && <Badge variant="outline" className="text-[10px]">تم الربط</Badge>}
                  </Label>
                  <select className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                    value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                    <option value="">— بدون —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {missingRequired.length > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive text-destructive text-xs p-2">
                حقول مطلوبة غير مربوطة: {missingRequired.map((f) => f.label).join("، ")}
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Preview + Validation */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary">معاينة أول 20 صف</Badge>
              {validationErrors.length > 0
                ? <Badge variant="destructive"><AlertTriangle className="size-3 ms-1" /> {validationErrors.length} خطأ في التحقق</Badge>
                : <Badge className="bg-success text-success-foreground"><CheckCircle2 className="size-3 ms-1" /> جاهز للاستيراد</Badge>}
            </div>
            <div className="rounded-lg border overflow-x-auto max-h-[45vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {schema.fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {mappedPreview.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {schema.fields.map((f) => (
                        <TableCell key={f.key} className={`text-xs ${r[f.key] == null || r[f.key] === "" ? "text-muted-foreground/50" : ""}`}>
                          {r[f.key] == null || r[f.key] === "" ? "—" : String(r[f.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                {validationErrors.slice(0, 30).map((e, i) => (
                  <div key={i} className="text-destructive"><AlertTriangle className="size-3 inline-block ms-1" /> {e.message}</div>
                ))}
                {validationErrors.length > 30 && <div className="text-muted-foreground">…و{validationErrors.length - 30} خطأ إضافي</div>}
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Options */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold text-sm">خيارات الاستيراد</div>
              <RadioOpt label="إنشاء سجلات جديدة فقط" checked={!!options.createOnly}
                onCheck={() => setOptions({ createOnly: true, updateExisting: false, skipDuplicates: false })} />
              <RadioOpt label={`تحديث السجلات الموجودة (المطابقة على "${schema.uniqueBy ?? "-"}")`}
                checked={!!options.updateExisting} disabled={!schema.uniqueBy}
                onCheck={() => setOptions({ createOnly: false, updateExisting: true, skipDuplicates: false })} />
              <RadioOpt label="تجاهل التكرارات" checked={!!options.skipDuplicates} disabled={!schema.uniqueBy}
                onCheck={() => setOptions({ createOnly: false, updateExisting: false, skipDuplicates: true })} />
            </div>
            <div className="rounded-lg border p-4 text-sm space-y-2">
              <div className="font-semibold">ملخص:</div>
              <div>الوحدة: <Badge variant="outline">{module}</Badge></div>
              <div>عدد الصفوف الصالحة: <b>{rows.length - new Set(validationErrors.map((e) => e.row)).size}</b> من {rows.length}</div>
              <div>الحقول المربوطة: {Object.values(mapping).filter(Boolean).length}/{schema.fields.length}</div>
            </div>
            {busy && <Progress value={progress} className="h-2" />}
          </div>
        )}

        {/* Step 5 — Result */}
        {step === 5 && summary && (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/10 border border-success p-6 text-center">
              <CheckCircle2 className="size-12 text-success mx-auto" />
              <div className="text-lg font-bold mt-2">اكتمل الاستيراد</div>
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                <div><div className="text-2xl font-bold text-success">{summary.inserted + summary.updated}</div><div className="text-muted-foreground">تم الحفظ</div></div>
                <div><div className="text-2xl font-bold text-destructive">{summary.failed + summary.errors.length}</div><div className="text-muted-foreground">فشل</div></div>
                <div><div className="text-2xl font-bold text-muted-foreground">{summary.skipped}</div><div className="text-muted-foreground">تم التخطي</div></div>
              </div>
            </div>
            {summary.errors.length > 0 && (
              <Button variant="outline" onClick={() => downloadErrorReport(summary.errors, `errors_${summary.batchId}.xlsx`)}>
                <Download className="size-4 ms-1" /> تحميل تقرير الأخطاء ({summary.errors.length})
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && step < 5 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={busy}>
              <ArrowRight className="size-4 ms-1" /> السابق
            </Button>
          )}
          {step === 5 ? (
            <Button onClick={() => onOpenChange(false)}>إغلاق</Button>
          ) : step === 4 ? (
            <Button onClick={doImport} disabled={busy || missingRequired.length > 0} className="gradient-brand text-white border-0">
              {busy ? "جاري الاستيراد..." : "بدء الاستيراد"}
            </Button>
          ) : step === 3 ? (
            <Button onClick={() => setStep(4)}><ArrowLeft className="size-4 me-1" /> التالي</Button>
          ) : step === 2 ? (
            <Button onClick={() => setStep(3)} disabled={missingRequired.length > 0}>
              <ArrowLeft className="size-4 me-1" /> التالي — معاينة
            </Button>
          ) : null}
          {step < 5 && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="size-4 ms-1" /> إلغاء</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioOpt({ label, checked, onCheck, disabled }: { label: string; checked: boolean; onCheck: () => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 text-sm cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <input type="radio" checked={checked} onChange={onCheck} disabled={disabled} className="accent-primary" />
      <span>{label}</span>
    </label>
  );
}
