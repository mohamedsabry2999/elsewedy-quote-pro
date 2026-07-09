import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DEFAULT_COMPANY } from "@/lib/pdf";
import { Save } from "lucide-react";
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
  const [form, setForm] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_COMPANY;
    const saved = localStorage.getItem("elsewedy-company");
    return saved ? { ...DEFAULT_COMPANY, ...JSON.parse(saved) } : DEFAULT_COMPANY;
  });

  const save = () => {
    localStorage.setItem("elsewedy-company", JSON.stringify(form));
    toast.success("تم حفظ إعدادات الشركة (تُستخدم في PDF)");
  };

  if (!canEdit) return <div className="text-center py-16 text-muted-foreground">هذه الصفحة متاحة لمسؤول النظام فقط.</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الشركة و PDF</h1>
        <p className="text-sm text-muted-foreground">تظهر هذه البيانات في ترويسة وتذييل عروض الأسعار المُصدَّرة</p>
      </div>
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
