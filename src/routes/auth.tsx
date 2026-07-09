import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBrand } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — Medhat Elsewedy Printhouse" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const brand = useBrand();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تسجيل الدخول بنجاح");
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء الحساب. يمكنك تسجيل الدخول الآن.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-brand text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)" }} />
        <div className="relative flex items-center justify-center bg-white/95 rounded-xl p-4 w-fit shadow-2xl">
          <img src={brand.logo_url} alt={brand.company_name_en} className="h-16 w-auto object-contain" />
        </div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight text-balance">نظام عروض الأسعار الذكي</h1>
          <p className="mt-4 text-lg opacity-95 max-w-md">
            منصة احترافية لإعداد عروض أسعار الطباعة الديجيتال والأوفست والتغليف والملصقات — بدقة وسرعة وتحكم كامل.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-md text-sm">
            {["HP Indigo 12K", "أوفست 50×70", "تغليف وفويل ستامبينج", "PDF احترافي RTL"].map((f) => (
              <div key={f} className="rounded-lg bg-white/15 backdrop-blur px-3 py-2 border border-white/20">{f}</div>
            ))}
          </div>
        </div>
        <div className="relative text-xs opacity-80">© {new Date().getFullYear()} {brand.company_name_en}. جميع الحقوق محفوظة.</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex justify-center">
            <img src={brand.logo_url} alt={brand.company_name_en} className="h-16 w-auto object-contain" />
          </div>
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-2xl">مرحباً بك</CardTitle>
              <CardDescription>سجل دخولك للوصول إلى نظام عروض الأسعار</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={signIn} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">كلمة المرور</Label>
                      <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
                    </div>
                    <Button type="submit" className="w-full gradient-brand text-white border-0" disabled={loading}>
                      {loading && <Loader2 className="ms-2 size-4 animate-spin" />} دخول
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={signUp} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">الاسم الكامل</Label>
                      <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="محمد أحمد" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email2">البريد الإلكتروني</Label>
                      <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password2">كلمة المرور</Label>
                      <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
                    </div>
                    <Button type="submit" className="w-full gradient-brand text-white border-0" disabled={loading}>
                      {loading && <Loader2 className="ms-2 size-4 animate-spin" />} إنشاء الحساب
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      يقوم مسؤول النظام بتفعيل الصلاحيات المناسبة لحسابك بعد التسجيل.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
