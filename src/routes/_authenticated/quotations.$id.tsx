import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Download, MessageCircle, Mail, Printer, ChevronRight, CheckCircle2, XCircle, ArrowRightCircle, Copy, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canSeeCosts, canApprove } from "@/lib/roles";
import { currency, dateAr, dateTimeAr, number, percent } from "@/lib/format";
import { generateQuotationPdf, whatsappMessage, whatsappLink } from "@/lib/pdf";
import { fetchBrand } from "@/lib/brand";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/quotations/$id")({
  head: () => ({ meta: [{ title: "تفاصيل عرض السعر — Elsewedy" }] }),
  component: QuotationDetail,
});

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "مسودة", variant: "outline" },
  pending_approval: { label: "بانتظار الاعتماد", variant: "secondary" },
  approved: { label: "معتمد", variant: "default" },
  sent: { label: "تم الإرسال", variant: "default" },
  accepted: { label: "مقبول", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  converted: { label: "أمر تشغيل", variant: "default" },
};

const ACTIONS_LABEL: Record<string, string> = {
  created: "إنشاء العرض", updated: "تعديل", approved: "اعتماد", rejected: "رفض",
  sent_whatsapp: "إرسال واتساب", sent_email: "إرسال بريد", pdf_customer: "تحميل PDF للعميل",
  pdf_internal: "تحميل PDF داخلي", status_changed: "تغيير الحالة", duplicated: "نسخ العرض",
  converted: "تحويل لأمر تشغيل", deleted: "حذف",
};

function QuotationDetail() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const showCosts = canSeeCosts(auth.roles);
  const canAppr = canApprove(auth.roles);
  const isAdmin = auth.roles.includes("admin");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const { data: q, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations")
        .select("*, customers(*)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (data?.sales_rep_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", data.sales_rep_id).maybeSingle();
        (data as any).profiles = { full_name: p?.full_name ?? null };
      }
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["quotation-items", id],
    queryFn: async () => (await supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order", { ascending: true })).data ?? [],
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log").select("*").eq("quotation_id", id).order("created_at", { ascending: false });
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        const m = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        rows.forEach((r: any) => { r.profiles = { full_name: m.get(r.user_id) ?? null }; });
      }
      return rows;
    },
  });

  const { data: jobOrder } = useQuery({
    queryKey: ["job-order-for-quotation", id],
    queryFn: async () => (await supabase.from("job_orders").select("*").eq("quotation_id", id).maybeSingle()).data,
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

  const convertToJobOrder = useMutation({
    mutationFn: async () => {
      if (!q) throw new Error("العرض غير متوفر");
      // Create job_order (number is default from DB)
      const { data: jo, error } = await supabase.from("job_orders").insert({
        quotation_id: id,
        production_status: "pending",
        due_date: dueDate || null,
        created_by: auth.userId,
        production_notes: `عرض ${q.quotation_number} — ${(q as any).customers?.company_name ?? ""}`,
      }).select("*").single();
      if (error) throw error;
      // Update quotation status
      await supabase.from("quotations").update({ status: "converted" }).eq("id", id);
      await logActivity("converted", { job_order_number: jo.job_order_number });
      return jo;
    },
    onSuccess: (jo) => {
      qc.invalidateQueries({ queryKey: ["quotation", id] });
      qc.invalidateQueries({ queryKey: ["job-order-for-quotation", id] });
      toast.success(`تم إنشاء أمر التشغيل ${jo.job_order_number}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteQuotation = useMutation({
    mutationFn: async () => {
      // Delete items first (RLS-safe order)
      await supabase.from("quotation_items").delete().eq("quotation_id", id);
      await supabase.from("activity_log").delete().eq("quotation_id", id);
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); navigate({ to: "/quotations" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = async () => {
    if (!q) return;
    const { data: numRow } = await supabase.rpc("next_quotation_number");
    const insertPayload: any = {
      quotation_number: numRow as unknown as string,
      customer_id: q.customer_id, sales_rep_id: auth.userId, status: "draft",
      product_category: q.product_category, quantity: q.quantity, subtotal: q.subtotal,
      total_cost: q.total_cost, discount: q.discount, profit_margin_pct: q.profit_margin_pct,
      final_price: q.final_price, payment_terms: q.payment_terms, delivery_days: q.delivery_days,
      validity_days: q.validity_days, customer_notes: q.customer_notes, internal_notes: q.internal_notes,
      specs: q.specs,
    };
    if ((q as any).tax_enabled !== undefined) {
      insertPayload.tax_enabled = (q as any).tax_enabled;
      insertPayload.tax_pct = (q as any).tax_pct;
      insertPayload.tax_amount = (q as any).tax_amount;
      insertPayload.unit_price = (q as any).unit_price;
    }
    const { data: newQ, error } = await supabase.from("quotations").insert(insertPayload).select("id").single();
    if (error) { toast.error(error.message); return; }
    for (const it of items) {
      await supabase.from("quotation_items").insert({
        quotation_id: newQ.id, title: it.title, description: it.description, specs: it.specs,
        quantity: it.quantity, unit_price: it.unit_price, unit_cost: it.unit_cost, total_price: it.total_price,
      });
    }
    await logActivity("duplicated", { new_id: newQ.id });
    toast.success("تم نسخ العرض");
    navigate({ to: "/quotations/$id", params: { id: newQ.id } });
  };

  const downloadPdf = async (variant: "customer" | "internal") => {
    if (!q) return;
    if (!(q as any).customers) { toast.error("بيانات العميل ناقصة — لا يمكن إنشاء PDF"); return; }
    if (items.length === 0) { toast.error("لا توجد بنود في العرض"); return; }
    setPdfBusy(true);
    try {
      const brand = await fetchBrand();
      const blob = await generateQuotationPdf({
        quotation: q, customer: (q as any).customers, items,
        brand, variant,
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
    // Basic phone validation: digits + optional +
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (cleaned.length < 8) { toast.error("رقم الواتساب غير صحيح"); return; }
    const brand = await fetchBrand();
    const msg = whatsappMessage(customer?.contact_person || customer?.company_name || "العميل", q.quotation_number, brand.company_name_en);
    await downloadPdf("customer");
    window.open(whatsappLink(phone, msg), "_blank");
    await logActivity("sent_whatsapp", { phone });
    if (q.status === "approved" || q.status === "draft") {
      await supabase.from("quotations").update({ status: "sent" }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["quotation", id] });
    }
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
  const qAny = q as any;
  const canDelete = isAdmin || (q.status === "draft" && q.sales_rep_id === auth.userId);
  const canConvert = q.status === "accepted" && !jobOrder;

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
              {jobOrder && <Badge className="bg-gold text-gold-foreground" variant="default">أمر تشغيل: {jobOrder.job_order_number}</Badge>}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {customer?.company_name} • {dateAr(q.created_at)}
              {(q as any).profiles?.full_name && <> • المندوب: {(q as any).profiles.full_name}</>}
            </div>
          </div>
          <div className="text-left">
            <div className="text-xs text-muted-foreground">القيمة النهائية {qAny.tax_enabled ? "(شامل الضريبة)" : ""}</div>
            <div className="text-3xl font-bold text-primary">{currency(q.final_price)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>تفاصيل المنتج</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">لا توجد بنود في العرض</div>}
              {items.map((it: any, i: number) => (
                <div key={it.id} className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-between gap-3 border-b">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="gradient-brand text-white border-0">بند {it.item_number ?? i + 1}</Badge>
                      <div className="font-semibold">{it.title}</div>
                      {it.category && <Badge variant="outline" className="text-xs">{it.category}</Badge>}
                    </div>
                    <div className="text-primary font-bold">{currency(it.total_price)}</div>
                  </div>
                  <div className="p-4 space-y-2">
                    {it.description && <div className="text-sm text-muted-foreground">{it.description}</div>}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                      <SpecRow label="الكمية" value={`${number(it.quantity)} ${it.unit ?? ""}`.trim()} />
                      <SpecRow label="سعر الوحدة" value={currency(it.unit_price)} />
                      {it.size && <SpecRow label="المقاس" value={it.size} />}
                      {it.material && <SpecRow label="المادة" value={it.material} />}
                      {it.gsm && <SpecRow label="GSM" value={it.gsm} />}
                      {it.printing_method && <SpecRow label="الطباعة" value={it.printing_method} />}
                      {it.printing_sides && <SpecRow label="الأوجه" value={it.printing_sides} />}
                      {it.colors && <SpecRow label="الألوان" value={it.colors} />}
                      {Array.isArray(it.finishing_options) && it.finishing_options.length > 0 &&
                        <SpecRow label="التشطيبات" value={it.finishing_options.join("، ")} full />}
                    </div>
                    {(it.customer_notes || it.internal_notes) && (
                      <div className="pt-2 border-t space-y-1 text-xs">
                        {it.customer_notes && <div><span className="text-muted-foreground">ملاحظات للعميل:</span> {it.customer_notes}</div>}
                        {showCosts && it.internal_notes && <div><span className="text-muted-foreground">داخلي:</span> {it.internal_notes}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t pt-4 text-sm">
              <Row label="المجموع قبل الخصم" value={currency(q.subtotal)} />
              {Number(q.discount) > 0 && <Row label="الخصم" value={`- ${currency(q.discount)}`} />}
              {qAny.tax_enabled && Number(qAny.tax_amount) > 0 && (
                <Row label={`ضريبة (${percent(qAny.tax_pct)})`} value={currency(qAny.tax_amount)} />
              )}
              <Row label="السعر النهائي" value={currency(q.final_price)} big />
              {q.payment_terms && <div className="text-xs text-muted-foreground pt-2">شروط الدفع: {q.payment_terms}</div>}
              {q.delivery_days && <div className="text-xs text-muted-foreground">مدة التوريد: {q.delivery_days} يوم</div>}
              {q.validity_days && <div className="text-xs text-muted-foreground">صلاحية العرض: {q.validity_days} يوم</div>}
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
                  <ConfirmButton
                    title="اعتماد العرض"
                    description="سيتم اعتماد العرض ويمكن إرساله للعميل. متابعة؟"
                    onConfirm={() => changeStatus.mutate("approved")}
                    trigger={
                      <Button className="w-full bg-success text-success-foreground hover:opacity-90">
                        <CheckCircle2 className="size-4 ms-1" /> اعتماد العرض
                      </Button>
                    }
                  />
                  <ConfirmButton
                    title="رفض العرض"
                    description="سيتم رفض العرض. متابعة؟"
                    variant="destructive"
                    onConfirm={() => changeStatus.mutate("rejected")}
                    trigger={
                      <Button variant="destructive" className="w-full">
                        <XCircle className="size-4 ms-1" /> رفض
                      </Button>
                    }
                  />
                </div>
              )}

              {(q.status === "approved" || q.status === "sent") && (
                <div className="border-t pt-2 space-y-2">
                  {q.status === "approved" && (
                    <ConfirmButton
                      title="تأشير كمُرسل"
                      description="تأكيد أن العرض قد تم إرساله للعميل؟"
                      onConfirm={() => changeStatus.mutate("sent")}
                      trigger={<Button variant="outline" className="w-full"><Send className="size-4 ms-1" /> وضع كـ "مُرسل"</Button>}
                    />
                  )}
                  <ConfirmButton
                    title="تأشير كمقبول"
                    description="تأكيد قبول العميل للعرض؟"
                    onConfirm={() => changeStatus.mutate("accepted")}
                    trigger={<Button variant="outline" className="w-full">تأشير كمقبول</Button>}
                  />
                  <ConfirmButton
                    title="تأشير كمرفوض"
                    description="تأكيد رفض العميل للعرض؟"
                    variant="destructive"
                    onConfirm={() => changeStatus.mutate("rejected")}
                    trigger={<Button variant="outline" className="w-full">تأشير كمرفوض</Button>}
                  />
                </div>
              )}

              {canConvert && (
                <div className="border-t pt-2 space-y-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full gradient-gold text-gold-foreground">
                        <ArrowRightCircle className="size-4 ms-1" /> تحويل لأمر تشغيل
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>تحويل لأمر تشغيل</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم إنشاء أمر تشغيل جديد مربوط بهذا العرض وتحديث حالته إلى "أمر تشغيل".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2 py-2">
                        <label className="text-sm font-medium">تاريخ التسليم المستهدف (اختياري)</label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full h-10 rounded-md border bg-transparent px-3 text-sm"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => convertToJobOrder.mutate()}>إنشاء أمر التشغيل</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {jobOrder && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/job-orders">عرض أوامر التشغيل</Link>
                </Button>
              )}

              {canDelete && (
                <div className="border-t pt-2">
                  <ConfirmButton
                    title="حذف العرض"
                    description="سيتم حذف العرض وكل بنوده وسجل نشاطه نهائيًا. لا يمكن التراجع."
                    variant="destructive"
                    onConfirm={() => deleteQuotation.mutate()}
                    trigger={<Button variant="ghost" className="w-full text-destructive hover:text-destructive"><Trash2 className="size-4 ms-1" /> حذف نهائي</Button>}
                  />
                </div>
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

function SpecRow({ label, value, full }: { label: string; value: string | number; full?: boolean }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span>
    </div>
  );
}

function ConfirmButton({
  title, description, onConfirm, trigger, variant,
}: {
  title: string; description: string; onConfirm: () => void; trigger: React.ReactNode;
  variant?: "default" | "destructive";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            تأكيد
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
