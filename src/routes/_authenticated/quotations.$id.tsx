import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { FileText, Download, MessageCircle, Mail, Printer, ChevronRight, CheckCircle2, XCircle, ArrowRightCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canSeeCosts, canApprove } from "@/lib/roles";
import { currency, dateAr, dateTimeAr, number, percent } from "@/lib/format";
import { generateQuotationPdf, whatsappMessage, whatsappLink, DEFAULT_COMPANY } from "@/lib/pdf";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/quotations/$id")({
  head: () => ({ meta: [{ title: "تفاصيل عرض السعر — Elsewedy" }] }),
  component: QuotationDetail,
});

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string }> = {
  draft: { label: "مسودة", variant: "outline", color: "text-muted-foreground" },
  pending_approval: { label: "بانتظار الاعتماد", variant: "secondary", color: "text-warning-foreground" },
  approved: { label: "معتمد", variant: "default", color: "text-success" },
  sent: { label: "تم الإرسال", variant: "default", color: "text-primary" },
  accepted: { label: "مقبول", variant: "default", color: "text-success" },
  rejected: { label: "مرفوض", variant: "destructive", color: "text-destructive" },
  converted: { label: "أمر تشغيل", variant: "default", color: "text-primary" },
};

const ACTIONS_LABEL: Record<string, string> = {
  created: "إنشاء العرض",
  updated: "تعديل",
  approved: "اعتماد",
  rejected: "رفض",
  sent_whatsapp: "إرسال واتساب",
  sent_email: "إرسال بريد",
  pdf_customer: "تحميل PDF للعميل",
  pdf_internal: "تحميل PDF داخلي",
  status_changed: "تغيير الحالة",
  duplicated: "نسخ العرض",
  converted: "تحويل لأمر تشغيل",
};

function QuotationDetail() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const showCosts = canSeeCosts(auth.roles);
  const canAppr = canApprove(auth.roles);
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data: q, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations")
        .select("*, customers(*), profiles:sales_rep_id(full_name)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["quotation-items", id],
    queryFn: async () => (await supabase.from("quotation_items").select("*").eq("quotation_id", id)).data ?? [],
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log").select("*, profiles:user_id(full_name)").eq("quotation_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const logActivity = async (action: string, details: any = {}) => {
    await supabase.from("activity_log").insert({ quotation_id: id, user_id: auth.userId, action, details });
    qc.invalidateQueries({ queryKey: ["activity", id] });
  };

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const patch: any = { status };
      if (status === "approved") { patch.approved_by = auth.userId; patch.approved_at = new Date().toISOString(); }
      const { error } = await supabase.from("quotations").update(patch).eq("id", id);
      if (error) throw error;
      await logActivity("status_changed", { to: status });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotation", id] }); toast.success("تم تحديث الحالة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = async () => {
    if (!q) return;
    const { data: numRow } = await supabase.rpc("next_quotation_number");
    const { data: newQ, error } = await supabase.from("quotations").insert({
      quotation_number: numRow as unknown as string,
      customer_id: q.customer_id, sales_rep_id: auth.userId, status: "draft",
      product_category: q.product_category, quantity: q.quantity, subtotal: q.subtotal,
      total_cost: q.total_cost, discount: q.discount, profit_margin_pct: q.profit_margin_pct,
      final_price: q.final_price, payment_terms: q.payment_terms, delivery_days: q.delivery_days,
      validity_days: q.validity_days, customer_notes: q.customer_notes, internal_notes: q.internal_notes,
      specs: q.specs,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    for (const it of items) {
      await supabase.from("quotation_items").insert({
        quotation_id: newQ.id, title: it.title, description: it.description, specs: it.specs,
        quantity: it.quantity, unit_price: it.unit_price, unit_cost: it.unit_cost, total_price: it.total_price,
      });
    }
    toast.success("تم نسخ العرض");
    navigate({ to: "/quotations/$id", params: { id: newQ.id } });
  };

  const downloadPdf = async (variant: "customer" | "internal") => {
    if (!q) return;
    setPdfBusy(true);
    try {
      const breakdown = (q.specs as any)?.breakdown ?? undefined;
      const blob = await generateQuotationPdf({
        quotation: q, customer: (q as any).customers, items, breakdown,
        company: DEFAULT_COMPANY, variant,
        salesRepName: (q as any).profiles?.full_name,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${q.quotation_number}-${variant}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      await logActivity(variant === "customer" ? "pdf_customer" : "pdf_internal");
    } catch (e: any) { toast.error(e.message ?? "خطأ في إنشاء PDF"); }
    finally { setPdfBusy(false); }
  };

  const shareWhatsApp = async () => {
    if (!q) return;
    const customer = (q as any).customers;
    const phone = customer?.whatsapp || customer?.phone;
    if (!phone) { toast.error("لا يوجد رقم واتساب مسجل للعميل"); return; }
    const productName = items[0]?.title ?? "عرض السعر";
    const msg = whatsappMessage(customer?.contact_person || customer?.company_name || "العميل", productName, q.quotation_number);
    await downloadPdf("customer");
    window.open(whatsappLink(phone, msg), "_blank");
    await logActivity("sent_whatsapp", { phone });
    toast.success("تم تجهيز الرسالة، برجاء إرفاق ملف الـ PDF الذي تم تحميله.");
  };

  const shareEmail = async () => {
    if (!q) return;
    const customer = (q as any).customers;
    if (!customer?.email) { toast.error("لا يوجد بريد إلكتروني مسجل للعميل"); return; }
    const subject = `عرض سعر من Elsewedy Print House - ${q.quotation_number}`;
    const body = `تحية طيبة،\n\nمرفق لحضرتكم عرض السعر رقم ${q.quotation_number}.\n\nنتشرف بخدمتكم.\nمطبعة السويدي`;
    window.open(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    await downloadPdf("customer");
    await logActivity("sent_email");
  };

  if (isLoading) return <div className="text-center py-16 text-muted-foreground">جارِ التحميل...</div>;
  if (!q) return <div className="text-center py-16 text-muted-foreground">العرض غير موجود</div>;

  const customer = (q as any).customers;
  const breakdown = (q.specs as any)?.breakdown;
  const specs = q.specs as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/quotations" className="hover:text-primary">عروض الأسعار</Link>
        <ChevronRight className="size-3 rotate-180" />
        <span className="font-mono">{q.quotation_number}</span>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{q.quotation_number}</h1>
              <Badge variant={STATUS_META[q.status]?.variant}>{STATUS_META[q.status]?.label}</Badge>
              {q.approval_required && q.status === "pending_approval" && <Badge variant="secondary">يتطلب اعتماد</Badge>}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {customer?.company_name} • {dateAr(q.created_at)}
              {(q as any).profiles?.full_name && <> • المندوب: {(q as any).profiles.full_name}</>}
            </div>
          </div>
          <div className="text-left">
            <div className="text-xs text-muted-foreground">القيمة النهائية</div>
            <div className="text-3xl font-bold text-primary">{currency(q.final_price)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>تفاصيل المنتج</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {items.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-semibold">{it.title}</div>
                      {it.description && <div className="text-xs text-muted-foreground mt-1">{it.description}</div>}
                      {specs && (
                        <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                          {specs.sheetSize && <div>مقاس الفرخ: {specs.sheetSize}</div>}
                          {specs.copiesPerSheet && <div>عدد النسخ/فرخ: {specs.copiesPerSheet}</div>}
                          {specs.printingSides && <div>الأوجه: {specs.printingSides}</div>}
                          {specs.colors && <div>الألوان: {specs.colors}</div>}
                          {specs.finishingKeys?.length > 0 && <div>التشطيبات: {specs.finishingKeys.join("، ")}</div>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{number(it.quantity)}</TableCell>
                    <TableCell className="text-center">{currency(it.unit_price)}</TableCell>
                    <TableCell className="text-center font-semibold">{currency(it.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 space-y-2 border-t pt-4 text-sm">
              <Row label="المجموع قبل الخصم" value={currency(q.subtotal)} />
              {Number(q.discount) > 0 && <Row label="الخصم" value={`- ${currency(q.discount)}`} />}
              <Row label="السعر النهائي" value={currency(q.final_price)} big />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">الإجراءات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full gradient-primary" onClick={() => downloadPdf("customer")} disabled={pdfBusy}>
                <Download className="size-4 ms-1" /> تحميل PDF للعميل
              </Button>
              {showCosts && (
                <Button variant="outline" className="w-full" onClick={() => downloadPdf("internal")} disabled={pdfBusy}>
                  <Download className="size-4 ms-1" /> تحميل PDF داخلي
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={shareWhatsApp}>
                <MessageCircle className="size-4 ms-1" /> إرسال واتساب
              </Button>
              <Button variant="outline" className="w-full" onClick={shareEmail}>
                <Mail className="size-4 ms-1" /> إرسال بريد إلكتروني
              </Button>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="size-4 ms-1" /> طباعة
              </Button>
              <Button variant="ghost" className="w-full" onClick={duplicate}>
                <Copy className="size-4 ms-1" /> نسخ العرض
              </Button>
              {canAppr && q.status === "pending_approval" && (
                <div className="border-t pt-2 space-y-2">
                  <Button className="w-full bg-success text-success-foreground hover:opacity-90" onClick={() => changeStatus.mutate("approved")}>
                    <CheckCircle2 className="size-4 ms-1" /> اعتماد العرض
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => changeStatus.mutate("rejected")}>
                    <XCircle className="size-4 ms-1" /> رفض
                  </Button>
                </div>
              )}
              {(q.status === "approved" || q.status === "sent") && (
                <>
                  <Button variant="outline" className="w-full" onClick={() => changeStatus.mutate("sent")}>وضع كـ "مُرسل"</Button>
                  <Button variant="outline" className="w-full" onClick={() => changeStatus.mutate("accepted")}>تأشير كمقبول</Button>
                  <Button variant="outline" className="w-full" onClick={() => changeStatus.mutate("rejected")}>تأشير كمرفوض</Button>
                </>
              )}
              {q.status === "accepted" && (
                <Button className="w-full gradient-gold text-gold-foreground" onClick={() => changeStatus.mutate("converted")}>
                  <ArrowRightCircle className="size-4 ms-1" /> تحويل لأمر تشغيل
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">بيانات العميل</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="font-semibold">{customer?.company_name}</div>
              {customer?.contact_person && <div>{customer.contact_person}</div>}
              {customer?.phone && <div dir="ltr" className="text-muted-foreground">{customer.phone}</div>}
              {customer?.email && <div dir="ltr" className="text-muted-foreground">{customer.email}</div>}
              {customer?.address && <div className="text-muted-foreground">{customer.address}</div>}
            </CardContent>
          </Card>

          {showCosts && breakdown && (
            <Card>
              <CardHeader><CardTitle className="text-base">تحليل التكلفة</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row label="ورق" value={currency(breakdown.paperCost)} />
                <Row label="طباعة" value={currency(breakdown.printingCost)} />
                <Row label="تشطيبات" value={currency(breakdown.finishingCost)} />
                <Row label="ضبط" value={currency(breakdown.setupCost)} />
                <Row label="إجمالي التكلفة" value={currency(breakdown.totalCost)} bold />
                <Row label="الربح" value={currency(breakdown.profit)} />
                <Row label="هامش الربح" value={percent(q.profit_margin_pct)} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" /> سجل النشاط</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {activity.length === 0 && <li className="text-sm text-muted-foreground">لا يوجد نشاط بعد</li>}
            {activity.map((a: any) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <div className="size-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <div className="font-medium">{ACTIONS_LABEL[a.action] ?? a.action}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.profiles?.full_name ?? "—"} • {dateTimeAr(a.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, big, bold }: { label: string; value: string; big?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold || big ? "font-semibold" : ""}`}>
      <span className={big ? "text-base" : "text-muted-foreground"}>{label}</span>
      <span className={big ? "text-xl text-primary font-bold" : ""}>{value}</span>
    </div>
  );
}
