import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Phone, Mail, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canManageCustomers } from "@/lib/roles";
import { dateAr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "العملاء — Elsewedy Smart Quotation" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string; company_name: string; contact_person: string | null; phone: string | null;
  whatsapp: string | null; email: string | null; industry: string | null; address: string | null;
  notes: string | null; follow_up_status: string | null; created_at: string; owner_id: string | null;
};

const empty: Partial<Customer> = { company_name: "", contact_person: "", phone: "", whatsapp: "", email: "", industry: "", address: "", notes: "", follow_up_status: "new" };

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "جديد", variant: "secondary" },
  contacted: { label: "تم التواصل", variant: "outline" },
  quoted: { label: "تم إرسال عرض", variant: "default" },
  won: { label: "عميل نشط", variant: "default" },
  lost: { label: "غير مهتم", variant: "destructive" },
};

function CustomersPage() {
  const auth = useAuth();
  const canManage = canManageCustomers(auth.roles);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>(empty);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, owner_id: form.id ? form.owner_id : auth.userId };
      if (form.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(form.id ? "تم تحديث بيانات العميل" : "تم إضافة العميل");
      setOpen(false); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("تم حذف العميل"); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return !q || [c.company_name, c.contact_person, c.phone, c.email, c.industry].some((f) => f?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="text-sm text-muted-foreground">إدارة قاعدة بيانات العملاء والاتصالات</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button className="gradient-primary"><Plus className="size-4 ms-1" /> إضافة عميل</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1"><Label>اسم الشركة *</Label><Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>اسم المسؤول</Label><Input value={form.contact_person ?? ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                <div className="space-y-1"><Label>الصناعة</Label><Input value={form.industry ?? ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="أدوية، تجميل، أغذية..." /></div>
                <div className="space-y-1"><Label>رقم الهاتف</Label><Input dir="ltr" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>رقم واتساب</Label><Input dir="ltr" value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+201..." /></div>
                <div className="space-y-1"><Label>البريد الإلكتروني</Label><Input dir="ltr" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>حالة المتابعة</Label>
                  <select className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" value={form.follow_up_status ?? "new"} onChange={(e) => setForm({ ...form, follow_up_status: e.target.value })}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1"><Label>العنوان</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="col-span-2 space-y-1"><Label>ملاحظات</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={() => save.mutate()} disabled={!form.company_name || save.isPending}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم، الشركة، الهاتف، الصناعة..." className="pe-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} عميل</div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشركة</TableHead>
                <TableHead>المسؤول</TableHead>
                <TableHead>الاتصال</TableHead>
                <TableHead>الصناعة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ الإضافة</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد عملاء بعد</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><div className="flex items-center gap-2 font-medium"><Building2 className="size-4 text-primary" />{c.company_name}</div></TableCell>
                  <TableCell>{c.contact_person ?? "—"}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {c.phone && <div className="flex items-center gap-1" dir="ltr"><Phone className="size-3" />{c.phone}</div>}
                      {c.email && <div className="flex items-center gap-1" dir="ltr"><Mail className="size-3" />{c.email}</div>}
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm">{c.industry ?? "—"}</span></TableCell>
                  <TableCell><Badge variant={STATUS[c.follow_up_status ?? "new"]?.variant ?? "secondary"}>{STATUS[c.follow_up_status ?? "new"]?.label ?? c.follow_up_status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateAr(c.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(canManage || c.owner_id === auth.userId) && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setForm(c); setOpen(true); }}><Edit className="size-4" /></Button>
                          {canManage && (
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا العميل؟")) del.mutate(c.id); }}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/quotations/new" search={{ customer: c.id }}>عرض سعر</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
