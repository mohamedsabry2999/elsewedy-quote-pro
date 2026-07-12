import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useBrand } from "@/lib/brand";

const TEAM_MESSAGES = [
  "عرض السعر مش مجرد رقم… ده أول انطباع عن جودة السويدي",
  "كل بند محسوب وكل عرض منظم وكل عميل يستلم صورة تليق باسم الشركة",
  "منصة واحدة لفريق واحد وطريقة عمل أوضح",
  "جهّز عرضك بدقة وخلّي العميل يشوف الاحتراف من أول ملف",
  "من أول الخامة لحد الـ PDF كل التفاصيل تحت السيطرة",
  "نفس الجودة اللي بنطبع بيها نعرض بيها أسعارنا",
  "عروض أسعار أسرع لفريق مبيعات أقوى",
  "تنظيم داخلي أقوى يعني تجربة عميل أفضل",
];

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
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const u = data.session.user;
        const name = (u.user_metadata?.full_name as string) || (u.email ? u.email.split("@")[0] : null);
        setGreetingName(name);
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false);
      const t = setTimeout(() => {
        setMsgIndex((i) => (i + 1) % TEAM_MESSAGES.length);
        setMsgVisible(true);
      }, 500);
      return () => clearTimeout(t);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تسجيل الدخول بنجاح");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-brand text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)" }} />
        <div className="relative flex items-center justify-center bg-white/95 rounded-xl p-4 w-fit shadow-2xl">
          <img src={brand.logo_url} alt={brand.company_name_en} className="h-16 w-auto object-contain" />
        </div>
        <div className="relative">
          {greetingName && (
            <div className="mb-3 text-sm opacity-90">
              مرحبًا {greetingName}، جاهز نجهز عرض سعر يليق باسم السويدي؟
            </div>
          )}
          <h1 className="text-4xl font-bold leading-tight text-balance">احترافية السويدي في كل عرض سعر</h1>
          <p className="mt-4 text-lg opacity-95 max-w-md leading-relaxed">
            منصة داخلية تساعد فريق مدحت السويدي للطباعة على إعداد عروض أسعار دقيقة ومنظمة للطباعة الديجيتال والأوفست والتغليف والملصقات بشكل يليق بجودة الشركة وثقة العملاء.
          </p>

          <div className="mt-6 max-w-md">
            <div className="text-[11px] uppercase tracking-wider opacity-75 mb-2">رسالة اليوم</div>
            <div className="rounded-xl bg-white/12 backdrop-blur border border-white/20 px-4 py-3 flex items-start gap-3 min-h-[64px]">
              <Sparkles className="size-4 mt-1 shrink-0 opacity-90" />
              <p
                key={msgIndex}
                className={`text-sm font-medium leading-relaxed transition-opacity duration-500 ${msgVisible ? "opacity-100" : "opacity-0"}`}
              >
                {TEAM_MESSAGES[msgIndex]}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 max-w-md text-sm">
            {["للديجيتال والأوفست", "تغليف وملصقات", "PDF احترافي", "لفريق السويدي"].map((f) => (
              <span key={f} className="rounded-full bg-white/15 backdrop-blur px-3 py-1.5 border border-white/25">{f}</span>
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
              <CardDescription>سجّل دخولك للوصول إلى نظام عروض الأسعار</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={signIn} className="space-y-4">
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
              <div className="mt-6 rounded-lg border bg-muted/40 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  نظام مغلق — إنشاء الحسابات يتم من مسؤول النظام فقط عبر صفحة "إدارة المستخدمين والصلاحيات".
                  للحصول على حساب، تواصل مع مسؤول النظام.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
