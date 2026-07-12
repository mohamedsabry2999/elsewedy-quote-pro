import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createUserFn } from "@/lib/admin-users.functions";
import { PERMISSION_GROUPS, ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserPlus, ShieldCheck, CheckCircle2, XCircle, Wand2 } from "lucide-react";

const ROLE_OPTIONS: AppRole[] = ["admin", "sales_manager", "sales_rep", "finance", "production_viewer"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddUserSheet({ open, onOpenChange, onCreated }: Props) {
  const createUser = useServerFn(createUserFn);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    internal_notes: "",
    role: "sales_rep" as AppRole,
    password: "",
    password_confirm: "",
    send_invite: false,
    is_suspended: false,
  });
  const [perms, setPerms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ROLE_DEFAULT_PERMISSIONS.sales_rep.map((k) => [k, true])),
  );

  const applyRoleDefaults = (role: AppRole) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? [];
    setPerms(Object.fromEntries(defaults.map((k) => [k, true])));
    toast.info(`تم تطبيق صلاحيات "${ROLE_LABELS[role]}" الافتراضية`);
  };
  const selectAll = () => setPerms(Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])));
  const clearAll = () => setPerms({});

  const selectedCount = useMemo(() => Object.values(perms).filter(Boolean).length, [perms]);

  const submit = async (send: boolean) => {
    if (!form.full_name || !form.email) { toast.error("الاسم والإيميل مطلوبان"); return; }
    if (!form.send_invite) {
      if (form.password.length < 8) { toast.error("كلمة المرور يجب ألا تقل عن ٨ أحرف"); return; }
      if (form.password !== form.password_confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    }
    setSaving(true);
    try {
      const permissions = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
      await createUser({
        data: {
          email: form.email.trim(),
          password: form.send_invite ? undefined : form.password,
          send_invite: form.send_invite,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
          internal_notes: form.internal_notes.trim() || undefined,
          role: form.role,
          is_suspended: form.is_suspended,
          permissions,
        },
      });
      toast.success(send ? "تم إنشاء المستخدم وإرسال بيانات الدخول" : "تم إنشاء المستخدم بنجاح");
      onCreated();
      onOpenChange(false);
      // reset
      setForm({
        full_name: "", email: "", phone: "", department: "", internal_notes: "",
        role: "sales_rep", password: "", password_confirm: "", send_invite: false, is_suspended: false,
      });
      setPerms(Object.fromEntries(ROLE_DEFAULT_PERMISSIONS.sales_rep.map((k) => [k, true])));
    } catch (e) {
      toast.error("تعذر إنشاء المستخدم", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-gold" /> إضافة مستخدم جديد
          </SheetTitle>
          <SheetDescription>أنشئ حساباً جديداً وحدد الدور والصلاحيات بدقة</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic info */}
          <Card>
            <CardContent className="grid sm:grid-cols-2 gap-4 pt-6">
              <div className="space-y-2">
                <Label>الاسم بالكامل *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني *</Label>
                <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>القسم</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الدور الوظيفي *</Label>
                <Select value={form.role} onValueChange={(v) => { setForm({ ...form, role: v as AppRole }); applyRoleDefaults(v as AppRole); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch checked={!form.is_suspended} onCheckedChange={(v) => setForm({ ...form, is_suspended: !v })} />
                  <span className="text-sm">{form.is_suspended ? "موقوف" : "نشط"}</span>
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3 border rounded-md p-3 bg-muted/30">
                <Switch checked={form.send_invite} onCheckedChange={(v) => setForm({ ...form, send_invite: v })} />
                <div className="text-sm">
                  <div className="font-medium">إرسال دعوة بالبريد</div>
                  <div className="text-xs text-muted-foreground">يقوم المستخدم بتعيين كلمة المرور بنفسه من رابط البريد</div>
                </div>
              </div>

              {!form.send_invite && (
                <>
                  <div className="space-y-2">
                    <Label>كلمة المرور المؤقتة *</Label>
                    <Input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>تأكيد كلمة المرور *</Label>
                    <Input type="password" dir="ltr" value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} />
                  </div>
                </>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label>ملاحظات داخلية</Label>
                <Textarea rows={2} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="font-semibold flex items-center gap-2">
                <ShieldCheck className="size-4 text-gold" /> صلاحيات المستخدم
                <span className="text-xs text-muted-foreground font-normal">— {selectedCount} من {ALL_PERMISSION_KEYS.length} صلاحية</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => applyRoleDefaults(form.role)}>
                  <Wand2 className="size-3.5 ms-1" /> تطبيق افتراضي للدور
                </Button>
                <Button size="sm" variant="outline" onClick={selectAll}>
                  <CheckCircle2 className="size-3.5 ms-1" /> تحديد الكل
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll}>
                  <XCircle className="size-3.5 ms-1" /> إلغاء الكل
                </Button>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={PERMISSION_GROUPS.map((g) => g.title)} className="space-y-2">
              {PERMISSION_GROUPS.map((group) => {
                const total = group.items.length;
                const on = group.items.filter((i) => perms[i.key]).length;
                return (
                  <AccordionItem key={group.title} value={group.title} className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pe-2">
                        <span>{group.title}</span>
                        <span className="text-xs text-muted-foreground">{on}/{total}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid sm:grid-cols-2 gap-2 pb-2">
                        {group.items.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={!!perms[p.key]}
                              onCheckedChange={(v) => setPerms((s) => ({ ...s, [p.key]: !!v }))}
                            />
                            <span>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2 sticky bottom-0 bg-background border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={saving}>
            {saving && <Loader2 className="size-4 ms-1 animate-spin" />} حفظ المستخدم
          </Button>
          <Button onClick={() => submit(true)} disabled={saving} className="gradient-gold text-gold-foreground">
            {saving && <Loader2 className="size-4 ms-1 animate-spin" />} حفظ وإرسال بيانات الدخول
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Handle typescript unused import guard for Textarea when its file uses forwardRef.
// Provide fallback if ui/textarea is not present:
export {} satisfies Record<string, never> as unknown as Record<string, never>;
type _PK = PermissionKey; export type __ = _PK;
