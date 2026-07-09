import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBrand, DEFAULT_BRAND, type BrandSettings } from "@/lib/brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ImageIcon, Save, Palette, Building2, FileText as FileTextIcon, Banknote, PenTool } from "lucide-react";

const OWNER_EMAIL = "mohamedsabryabdelfatah@gmail.com";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "إعدادات الهوية والـ PDF — Medhat Elsewedy Printhouse" }] }),
  component: BrandSettingsPage,
});

function BrandSettingsPage() {
  const auth = useAuth();
  const brand = useBrand();
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandSettings>(DEFAULT_BRAND);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => { setForm(brand); }, [brand]);

  const isAdmin = auth.roles.includes("admin") || auth.email?.toLowerCase() === OWNER_EMAIL;
  if (auth.loading) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;
  if (!isAdmin) throw redirect({ to: "/dashboard" });

  const set = <K extends keyof BrandSettings>(k: K, v: BrandSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const readAsDataURL = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file);
  });

  const uploadImage = async (field: "logo_url" | "signature_url" | "stamp_url", file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("الملف كبير جداً — الحد الأقصى 2MB"); return; }
    setLogoUploading(true);
    try {
      const dataUrl = await readAsDataURL(file);
      set(field, dataUrl);
      toast.success("تم رفع الصورة — لا تنسَ الحفظ");
    } finally { setLogoUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("brand_settings").upsert({ id: true, ...form });
      if (error) throw error;
      toast.success("تم حفظ إعدادات الهوية");
      qc.invalidateQueries({ queryKey: ["brand-settings"] });
    } catch (e) {
      toast.error("تعذر الحفظ", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ImageIcon className="size-6 text-primary" /> إعدادات الهوية والـ PDF</h1>
          <p className="text-sm text-muted-foreground mt-1">تحكم كامل في هوية الشركة وشكل عروض السعر والوثائق الرسمية</p>
        </div>
        <Button onClick={save} disabled={saving} className="gradient-brand text-white border-0">
          <Save className="size-4 ms-1" /> {saving ? "جاري الحفظ…" : "حفظ الإعدادات"}
        </Button>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="identity"><Building2 className="size-3.5 ms-1" /> الهوية</TabsTrigger>
          <TabsTrigger value="brand"><Palette className="size-3.5 ms-1" /> الألوان</TabsTrigger>
          <TabsTrigger value="pdf"><FileTextIcon className="size-3.5 ms-1" /> الـ PDF</TabsTrigger>
          <TabsTrigger value="signature"><PenTool className="size-3.5 ms-1" /> التوقيع</TabsTrigger>
          <TabsTrigger value="bank"><Banknote className="size-3.5 ms-1" /> البنك</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>شعار الشركة</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="w-40 h-24 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden">
                {form.logo_url ? <img src={form.logo_url} alt="logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-muted-foreground">لا يوجد شعار</span>}
              </div>
              <div className="flex-1 space-y-2">
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage("logo_url", e.target.files[0])} disabled={logoUploading} />
                <p className="text-xs text-muted-foreground">PNG أو JPG بحد أقصى 2MB. سيظهر في الشريط الجانبي، صفحة الدخول، ورأس الـ PDF.</p>
                <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="أو الصق رابط الشعار مباشرة" dir="ltr" className="text-xs" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>بيانات الشركة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="الاسم بالعربية"><Input value={form.company_name_ar} onChange={(e) => set("company_name_ar", e.target.value)} /></Field>
              <Field label="الاسم بالإنجليزية"><Input value={form.company_name_en} onChange={(e) => set("company_name_en", e.target.value)} dir="ltr" /></Field>
              <Field label="العنوان" full><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="الهاتف"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" /></Field>
              <Field label="واتساب"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} dir="ltr" /></Field>
              <Field label="البريد الإلكتروني"><Input value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" /></Field>
              <Field label="الموقع الإلكتروني"><Input value={form.website} onChange={(e) => set("website", e.target.value)} dir="ltr" /></Field>
              <Field label="الرقم الضريبي"><Input value={form.tax_number} onChange={(e) => set("tax_number", e.target.value)} dir="ltr" /></Field>
              <Field label="السجل التجاري"><Input value={form.commercial_register} onChange={(e) => set("commercial_register", e.target.value)} dir="ltr" /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand" className="mt-4">
          <Card>
            <CardHeader><CardTitle>ألوان العلامة التجارية</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ColorField label="اللون الأساسي" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
              <ColorField label="اللون الثانوي" value={form.secondary_color} onChange={(v) => set("secondary_color", v)} />
              <ColorField label="لون الإبراز في الـ PDF" value={form.accent_color} onChange={(v) => set("accent_color", v)} />
              <div className="md:col-span-3 rounded-xl p-6 text-white shadow-elegant" style={{ background: `linear-gradient(135deg, ${form.primary_color} 0%, ${form.secondary_color} 100%)` }}>
                <div className="text-xs opacity-80">معاينة</div>
                <div className="text-2xl font-bold mt-1">{form.company_name_ar}</div>
                <div className="text-sm opacity-90">{form.company_name_en}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>محتوى الـ PDF</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="تذييل الـ PDF" full><Textarea value={form.pdf_footer} onChange={(e) => set("pdf_footer", e.target.value)} rows={2} /></Field>
              <Field label="الشروط الافتراضية" full><Textarea value={form.default_terms} onChange={(e) => set("default_terms", e.target.value)} rows={3} /></Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="شروط الدفع الافتراضية"><Input value={form.default_payment_terms} onChange={(e) => set("default_payment_terms", e.target.value)} /></Field>
                <Field label="صلاحية العرض (يوم)"><Input type="number" value={form.default_validity_days} onChange={(e) => set("default_validity_days", parseInt(e.target.value || "15", 10))} /></Field>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div><div className="font-medium text-sm">إظهار QR Code في الـ PDF</div><div className="text-xs text-muted-foreground">رمز يتيح للعميل فتح العرض إلكترونياً</div></div>
                <Switch checked={form.show_qr} onCheckedChange={(v) => set("show_qr", v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <div><div className="font-medium text-sm">إظهار بيانات البنك في الـ PDF</div><div className="text-xs text-muted-foreground">تظهر في تذييل عرض السعر</div></div>
                <Switch checked={form.show_bank_details} onCheckedChange={(v) => set("show_bank_details", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signature" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>التوقيع والختم</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>صورة التوقيع</Label>
                <div className="w-full h-32 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden">
                  {form.signature_url ? <img src={form.signature_url} alt="signature" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-muted-foreground">لا يوجد</span>}
                </div>
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage("signature_url", e.target.files[0])} />
              </div>
              <div className="space-y-2">
                <Label>صورة الختم</Label>
                <div className="w-full h-32 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden">
                  {form.stamp_url ? <img src={form.stamp_url} alt="stamp" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-muted-foreground">لا يوجد</span>}
                </div>
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage("stamp_url", e.target.files[0])} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardHeader><CardTitle>بيانات البنك</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="اسم البنك"><Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} /></Field>
              <Field label="رقم الحساب"><Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} dir="ltr" /></Field>
              <Field label="IBAN"><Input value={form.bank_iban} onChange={(e) => set("bank_iban", e.target.value)} dir="ltr" /></Field>
              <Field label="SWIFT"><Input value={form.bank_swift} onChange={(e) => set("bank_swift", e.target.value)} dir="ltr" /></Field>
              <p className="md:col-span-2 text-xs text-muted-foreground">فعّل خيار "إظهار بيانات البنك في الـ PDF" من تبويب الـ PDF لعرض هذه البيانات في تذييل عروض الأسعار.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="flex-1 font-mono text-sm" />
      </div>
    </div>
  );
}
