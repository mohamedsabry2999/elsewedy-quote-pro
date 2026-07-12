import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { PERMISSION_GROUPS, ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { savePermissionsFn, resetPasswordFn, deleteUserFn } from "@/lib/admin-users.functions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Shield, ShieldCheck, UserCheck, UserX, Crown, UserPlus, Users2, KeyRound, Trash2, Wand2, CheckCircle2, XCircle, Activity } from "lucide-react";
import { toast } from "sonner";
import { currency, dateAr } from "@/lib/format";
import { AddUserSheet } from "@/components/users/AddUserSheet";

const OWNER_EMAIL = "mohamedsabryabdelfatah@gmail.com";
const ROLE_OPTIONS: AppRole[] = ["admin", "sales_manager", "sales_rep", "finance", "production_viewer"];

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "إدارة المستخدمين والصلاحيات — Elsewedy" }] }),
  component: UsersPage,
});

function UsersPage() {
  const auth = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users-admin"],
    enabled: auth.isAdmin && !auth.loading,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: perms }, { data: quots }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, department, internal_notes, is_suspended, last_login_at, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_permissions").select("user_id, permission_key, granted"),
        supabase.from("quotations").select("sales_rep_id, final_price, status"),
      ]);
      return {
        profiles: profiles ?? [],
        roles: roles ?? [],
        perms: perms ?? [],
        quots: quots ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.profiles
      .map((p) => {
        const userRoles = data.roles.filter((r) => r.user_id === p.id).map((r) => r.role as AppRole);
        const userQuots = data.quots.filter((q) => q.sales_rep_id === p.id);
        const total = userQuots.reduce((s, q) => s + Number(q.final_price ?? 0), 0);
        return {
          ...p,
          roles: userRoles,
          quotationsCount: userQuots.length,
          totalValue: total,
          isOwner: (p.email ?? "").toLowerCase() === OWNER_EMAIL,
        };
      })
      .filter((r) => {
        if (search) {
          const q = search.toLowerCase();
          if (!(r.full_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))) return false;
        }
        if (roleFilter !== "all" && !r.roles.includes(roleFilter as AppRole)) return false;
        if (statusFilter === "active" && r.is_suspended) return false;
        if (statusFilter === "suspended" && !r.is_suspended) return false;
        return true;
      });
  }, [data, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, active: 0, suspended: 0, admins: 0 };
    const total = data.profiles.length;
    const suspended = data.profiles.filter((p) => p.is_suspended).length;
    const active = total - suspended;
    const admins = new Set(data.roles.filter((r) => r.role === "admin").map((r) => r.user_id)).size;
    return { total, active, suspended, admins };
  }, [data]);

  if (auth.loading) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;
  if (!auth.isAdmin) throw redirect({ to: "/dashboard" });

  const openUser = openUserId ? rows.find((r) => r.id === openUserId) ?? null : null;
  const openUserPerms = openUserId ? data?.perms.filter((p) => p.user_id === openUserId) ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-6 text-gold" /> إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تحكم كامل في أدوار المستخدمين وصلاحياتهم داخل النظام</p>
        </div>
        <Button className="gradient-gold text-gold-foreground" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4 ms-1" /> إضافة مستخدم جديد
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي المستخدمين" value={stats.total} icon={<Users2 className="size-5 text-primary" />} />
        <StatCard label="نشط" value={stats.active} icon={<UserCheck className="size-5 text-emerald-600" />} />
        <StatCard label="موقوف" value={stats.suspended} icon={<UserX className="size-5 text-destructive" />} />
        <StatCard label="مسؤولو النظام" value={stats.admins} icon={<ShieldCheck className="size-5 text-gold" />} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الإيميل…" className="ps-3 pe-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="الدور" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأدوار</SelectItem>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="suspended">موقوف</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-sm">{rows.length} مستخدم</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الإيميل</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>العروض</TableHead>
                <TableHead>القيمة</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">جاري التحميل…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا يوجد مستخدمون مطابقون</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.isOwner && <Crown className="size-4 text-gold" />}
                        {r.full_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm" dir="ltr">{r.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.roles.map((role) => <Badge key={role} variant="secondary">{ROLE_LABELS[role]}</Badge>)}
                        {r.roles.length === 0 && <Badge variant="outline">بدون دور</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.is_suspended ? <Badge variant="destructive">موقوف</Badge> : <Badge>نشط</Badge>}
                    </TableCell>
                    <TableCell>{r.quotationsCount}</TableCell>
                    <TableCell>{currency(r.totalValue)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.created_at ? dateAr(r.created_at) : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setOpenUserId(r.id)}>إدارة</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddUserSheet open={addOpen} onOpenChange={setAddOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["users-admin"] })} />

      <UserDrawer
        open={!!openUser}
        onClose={() => setOpenUserId(null)}
        user={openUser}
        currentPerms={openUserPerms}
        onSaved={() => qc.invalidateQueries({ queryKey: ["users-admin"] })}
      />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center">{icon}</div>
      </CardContent>
    </Card>
  );
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  internal_notes: string | null;
  is_suspended: boolean;
  last_login_at: string | null;
  roles: AppRole[];
  quotationsCount: number;
  totalValue: number;
  isOwner: boolean;
}

function UserDrawer({
  open, onClose, user, currentPerms, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  currentPerms: { permission_key: string; granted: boolean }[];
  onSaved: () => void;
}) {
  const savePerms = useServerFn(savePermissionsFn);
  const resetPw = useServerFn(resetPasswordFn);
  const delUser = useServerFn(deleteUserFn);

  const [role, setRole] = useState<AppRole | "">("");
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState({ full_name: "", phone: "", department: "", internal_notes: "" });
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!user) return;
    setRole(user.roles[0] ?? "");
    const map: Record<string, boolean> = {};
    currentPerms.forEach((p) => { map[p.permission_key] = p.granted; });
    setPerms(map);
    setProfile({
      full_name: user.full_name ?? "",
      phone: user.phone ?? "",
      department: user.department ?? "",
      internal_notes: user.internal_notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const { data: activity } = useQuery({
    queryKey: ["user-activity", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_activity_logs")
        .select("id, action, details, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (!user) return null;

  const applyDefaults = () => {
    if (!role) return;
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? [];
    setPerms(Object.fromEntries(defaults.map((k) => [k, true])));
    toast.info(`تم تطبيق صلاحيات ${ROLE_LABELS[role]} الافتراضية`);
  };
  const selectAll = () => setPerms(Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])));
  const clearAll = () => setPerms({});

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Include ALL keys so unchecked ones are recorded as granted=false
      const fullPerms: Record<string, boolean> = {};
      ALL_PERMISSION_KEYS.forEach((k) => { fullPerms[k] = !!perms[k]; });
      await savePerms({
        data: {
          user_id: user.id,
          role: role || undefined,
          permissions: fullPerms,
          profile,
        },
      });
      toast.success("تم حفظ التغييرات");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("تعذر الحفظ", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async () => {
    if (!user) return;
    if (user.isOwner) { toast.error("لا يمكن إيقاف حساب المالك"); return; }
    try {
      const { error } = await supabase.from("profiles").update({ is_suspended: !user.is_suspended }).eq("id", user.id);
      if (error) throw error;
      toast.success(user.is_suspended ? "تم تفعيل الحساب" : "تم إيقاف الحساب");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("تعذر تغيير الحالة", { description: e instanceof Error ? e.message : "" });
    }
  };

  const handleReset = async () => {
    if (!user.email) return;
    try {
      await resetPw({ data: { user_id: user.id, email: user.email, redirect_to: `${window.location.origin}/auth` } });
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور");
    } catch (e) {
      toast.error("تعذر الإرسال", { description: e instanceof Error ? e.message : "" });
    }
  };

  const handleDelete = async () => {
    if (user.isOwner) { toast.error("لا يمكن حذف المالك"); return; }
    try {
      await delUser({ data: { user_id: user.id } });
      toast.success("تم حذف المستخدم");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("تعذر الحذف", { description: e instanceof Error ? e.message : "" });
    }
  };

  const selectedCount = Object.values(perms).filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {user.isOwner && <Crown className="size-5 text-gold" />}
            {user.full_name ?? user.email}
          </SheetTitle>
          <SheetDescription dir="ltr" className="text-start">{user.email}</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">البيانات</TabsTrigger>
              <TabsTrigger value="perms">الصلاحيات ({selectedCount})</TabsTrigger>
              <TabsTrigger value="activity">النشاط</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              <Card>
                <CardContent className="grid sm:grid-cols-2 gap-4 pt-6">
                  <div className="space-y-2">
                    <Label>الاسم بالكامل</Label>
                    <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} disabled={user.isOwner} />
                  </div>
                  <div className="space-y-2">
                    <Label>الهاتف</Label>
                    <Input dir="ltr" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>القسم</Label>
                    <Input value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>الدور الأساسي</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={user.isOwner}>
                      <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>ملاحظات داخلية</Label>
                    <Textarea rows={2} value={profile.internal_notes} onChange={(e) => setProfile({ ...profile, internal_notes: e.target.value })} />
                  </div>
                  {user.isOwner && (
                    <div className="sm:col-span-2 text-xs text-muted-foreground">حساب المالك: صلاحيات كاملة ثابتة لا يمكن تعديلها.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><div className="font-semibold">إحصاءات المستخدم</div></CardHeader>
                <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div><div className="text-muted-foreground text-xs">عدد العروض</div><div className="text-lg font-semibold">{user.quotationsCount}</div></div>
                  <div><div className="text-muted-foreground text-xs">إجمالي القيمة</div><div className="text-lg font-semibold">{currency(user.totalValue)}</div></div>
                  <div><div className="text-muted-foreground text-xs">آخر دخول</div><div className="text-sm mt-1">{user.last_login_at ? dateAr(user.last_login_at) : "—"}</div></div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 flex flex-wrap gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant={user.is_suspended ? "default" : "destructive"} size="sm" disabled={user.isOwner}>
                        {user.is_suspended ? <><UserCheck className="size-4 ms-1" /> تفعيل الحساب</> : <><UserX className="size-4 ms-1" /> إيقاف الحساب</>}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{user.is_suspended ? "تفعيل الحساب؟" : "إيقاف الحساب؟"}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {user.is_suspended ? "سيتمكن المستخدم من الدخول للنظام مرة أخرى." : "لن يتمكن المستخدم من الدخول للنظام حتى تفعيله."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={toggleSuspend}>تأكيد</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <KeyRound className="size-4 ms-1" /> إعادة تعيين كلمة المرور
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={user.isOwner}>
                        <Trash2 className="size-4 ms-1" /> حذف المستخدم
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف المستخدم نهائياً؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم حذف الحساب من نظام المصادقة. عروض الأسعار المرتبطة به لن تُحذف. لا يمكن التراجع.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>تأكيد الحذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="perms" className="space-y-3 mt-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={applyDefaults} disabled={!role || user.isOwner}>
                  <Wand2 className="size-3.5 ms-1" /> تطبيق افتراضي للدور
                </Button>
                <Button size="sm" variant="outline" onClick={selectAll} disabled={user.isOwner}>
                  <CheckCircle2 className="size-3.5 ms-1" /> تحديد الكل
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll} disabled={user.isOwner}>
                  <XCircle className="size-3.5 ms-1" /> إلغاء الكل
                </Button>
              </div>
              <Accordion type="multiple" defaultValue={PERMISSION_GROUPS.map((g) => g.title)} className="space-y-2">
                {PERMISSION_GROUPS.map((group) => {
                  const on = group.items.filter((i) => perms[i.key]).length;
                  return (
                    <AccordionItem key={group.title} value={group.title} className="border rounded-lg px-3">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pe-2">
                          <span>{group.title}</span>
                          <span className="text-xs text-muted-foreground">{on}/{group.items.length}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid sm:grid-cols-2 gap-2 pb-2">
                          {group.items.map((p) => (
                            <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={!!perms[p.key]}
                                onCheckedChange={(v) => setPerms((s) => ({ ...s, [p.key]: !!v }))}
                                disabled={user.isOwner}
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
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader className="pb-3"><div className="font-semibold flex items-center gap-2"><Activity className="size-4" /> آخر ٢٠ حدث</div></CardHeader>
                <CardContent>
                  {(!activity || activity.length === 0) ? (
                    <div className="text-sm text-muted-foreground py-4">لا يوجد نشاط مسجّل بعد.</div>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {activity.map((a) => (
                        <li key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div>
                            <div className="font-medium">{actionLabel(a.action)}</div>
                            {a.details && typeof a.details === "object" && Object.keys(a.details).length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">{JSON.stringify(a.details)}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{dateAr(a.created_at)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 bg-background border-t pt-4 mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={save} disabled={saving || user.isOwner} className="gradient-gold text-gold-foreground">
              {saving ? "جاري الحفظ…" : "حفظ التغييرات"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function actionLabel(a: string): string {
  const map: Record<string, string> = {
    user_created: "إنشاء المستخدم",
    user_updated: "تعديل المستخدم / الصلاحيات",
    user_deleted: "حذف المستخدم",
    password_reset_sent: "إرسال إعادة تعيين كلمة المرور",
  };
  return map[a] ?? a;
}

// keep PermissionKey type import used
export type _PK = PermissionKey;

