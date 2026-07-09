import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { DEFAULT_COMPANY, loadCompanySettings, type CompanySettings } from "@/lib/pdf";
import { Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canManagePricing } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "إعدادات الشركة — Elsewedy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const auth = useAuth();
  const canEdit = canManagePricing(auth.roles);
  const [form, setForm] = useState<CompanySettings>(() => loadCompanySettings());
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    localStorage.setItem("elsewedy-company", JSON.stringify(form));
    toast.success("تم حفظ إعدادات الشركة (تُستخدم في PDF)");
  };

  const onLogoChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("حجم الشعار أكبر من 2 ميجا"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logo_data_url: String(reader.result) });
    reader.readAsDataURL(file);
  };

  if (!canEdit) return <div className="text-center py-16 text-muted-foreground">هذه الصفحة متاحة لمسؤول النظام فقط.</div>;

  const primary = form.brand_primary || DEFAULT_COMPANY.brand_primary!;
  const primaryEnd = form.brand_primary_end || DEFAULT_COMPANY.brand_primary_end!;
  const accent = form.brand_accent || DEFAULT_COMPANY.brand_accent!;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الشركة و PDF</h1>
        <p className="text-sm text-muted-foreground">تظهر هذه البيانات في ترويسة وتذييل عروض الأسعار المُصدَّرة</p>
      </div>

      <Card>
        <CardHeader><CardTitle>الشعار والهوية البصرية</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-48 h-32 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
              {form.logo_data_url ? (
                <img src={form.logo_data_url} alt="logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">لا يوجد شعار</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4 ms-1" /> رفع شعار جديد
              </Button>
              {form.logo_data_url && (
                <Button type="button" variant="ghost" onClick={() => setForm({ ...form, logo_data_url: undefined })}>
                  <X className="size-4 ms-1" /> إزالة الشعار
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG / JPG / SVG — حتى 2 ميجا. يظهر في ترويسة الـ PDF.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ColorField label="اللون الرئيسي" value={primary} onChange={(v) => setForm({ ...form, brand_primary: v })} />
            <ColorField label="اللون الرئيسي (تدرج)" value={primaryEnd} onChange={(v) => setForm({ ...form, brand_primary_end: v })} />
            <ColorField label="لون التمييز" value={accent} onChange={(v) => setForm({ ...form, brand_accent: v })} />
          </div>

          <div className="rounded-lg overflow-hidden border">
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: `3px solid ${accent}` }}>
              <div className="flex items-center gap-3">
                {form.logo_data_url && <img src={form.logo_data_url} alt="" className="h-10 object-contain" />}
                <div>
                  <div className="font-bold" style={{ color: primary }}>{form.name}</div>
                  <div className="text-xs text-muted-foreground">{form.name_en}</div>
                </div>
              </div>
              <div className="px-3 py-2 rounded text-white text-xs" style={{ background: `linear-gradient(135deg, ${primary}, ${primaryEnd})` }}>
                معاينة الترويسة
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>بيانات الترويسة</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>اسم الشركة (عربي)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>Company name (English)</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1"><Label>الهاتف</Label><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>البريد الإلكتروني</Label><Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>الموقع الإلكتروني</Label><Input dir="ltr" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>الرقم الضريبي (اختياري)</Label><Input dir="ltr" value={form.tax_number ?? ""} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الشروط والتذييل</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>الشروط والأحكام الافتراضية</Label><Textarea rows={4} value={form.terms ?? ""} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></div>
          <div className="space-y-1"><Label>نص التذييل</Label><Textarea rows={3} value={form.footer ?? ""} onChange={(e) => setForm({ ...form, footer: e.target.value })} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} className="gradient-primary"><Save className="size-4 ms-1" /> حفظ الإعدادات</Button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded border cursor-pointer bg-transparent" />
        <Input dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
      </div>
    </div>
  );
}
