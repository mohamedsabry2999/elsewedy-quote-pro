import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { PERMISSION_GROUPS, ROLE_DEFAULT_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Shield, ShieldCheck, UserCheck, UserX, Crown } from "lucide-react";
import { toast } from "sonner";
import { currency, dateAr } from "@/lib/format";

const OWNER_EMAIL = "mohamedsabryabdelfatah@gmail.com";
const ROLE_OPTIONS: AppRole[] = ["admin", "sales_manager", "sales_rep", "finance", "production_viewer"];

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "إدارة المستخدمين والصلاحيات — Elsewedy" }] }),
  component: UsersPage,
});

function UsersPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const isOwner = auth.email?.toLowerCase() === OWNER_EMAIL;
  const isAdmin = auth.roles.includes("admin") || isOwner;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users-admin"],
    enabled: isAdmin && !auth.loading,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: perms }, { data: quots }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, is_suspended, last_login_at, created_at"),
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

  if (auth.loading) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;
  if (!isAdmin) {
    throw redirect({ to: "/dashboard" });
  }

  const openUser = openUserId ? rows.find((r) => r.id === openUserId) ?? null : null;
  const openUserPerms = openUserId ? data?.perms.filter((p) => p.user_id === openUserId) ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-6 text-gold" /> إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تحكم كامل في أدوار المستخدمين وصلاحياتهم داخل النظام</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الإيميل…"
                className="ps-3 pe-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="الدور" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأدوار</SelectItem>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
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
                <TableHead>عدد العروض</TableHead>
                <TableHead>إجمالي القيمة</TableHead>
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
                    <TableCell className="text-muted-foreground text-sm">{r.email ?? "—"}</TableCell>
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
                      <Button size="sm" variant="outline" onClick={() => setOpenUserId(r.id)}>
                        إدارة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserDrawer
        open={!!openUser}
        onClose={() => setOpenUserId(null)}
        user={openUser}
        currentPerms={openUserPerms}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["users-admin"] });
        }}
      />
    </div>
  );
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_suspended: boolean;
  last_login_at: string | null;
  roles: AppRole[];
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
  const [role, setRole] = useState<AppRole | "">("");
  const [permState, setPermState] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Sync state when user opens
  useMemo(() => {
    if (!user) return;
    setRole(user.roles[0] ?? "");
    const map: Record<string, boolean> = {};
    currentPerms.forEach((p) => { map[p.permission_key] = p.granted; });
    setPermState(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  const togglePerm = (key: PermissionKey, v: boolean) => setPermState((s) => ({ ...s, [key]: v }));

  const applyRoleDefaults = () => {
    if (!role) return;
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? [];
    const map: Record<string, boolean> = {};
    defaults.forEach((k) => { map[k] = true; });
    setPermState(map);
    toast.info(`تم تطبيق الصلاحيات الافتراضية لدور ${ROLE_LABELS[role]}`);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Role
      if (role && !user.roles.includes(role)) {
        if (!user.isOwner) {
          await supabase.from("user_roles").delete().eq("user_id", user.id);
        }
        const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, role });
        if (roleErr && !user.isOwner) throw roleErr;
      }
      // Permissions: upsert every key with granted flag
      const rows = PERMISSION_GROUPS.flatMap((g) => g.items).map((p) => ({
        user_id: user.id,
        permission_key: p.key,
        granted: !!permState[p.key],
      }));
      const { error: permErr } = await supabase.from("user_permissions").upsert(rows, { onConflict: "user_id,permission_key" });
      if (permErr) throw permErr;

      toast.success("تم حفظ الصلاحيات بنجاح");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("تعذر الحفظ", { description: e instanceof Error ? e.message : "خطأ غير معروف" });
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {user.isOwner && <Crown className="size-5 text-gold" />}
            {user.full_name ?? user.email}
          </SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Role */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2"><ShieldCheck className="size-4" /> الدور الأساسي</div>
                <Button size="sm" variant="outline" onClick={applyRoleDefaults} disabled={!role || user.isOwner}>
                  تطبيق صلاحيات الدور الافتراضية
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={user.isOwner}>
                <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              {user.isOwner && <p className="text-xs text-muted-foreground mt-2">حساب المالك: صلاحيات كاملة ثابتة لا يمكن تعديلها.</p>}
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader className="pb-3"><div className="font-semibold">حالة الحساب</div></CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm">
                <div>{user.is_suspended ? "الحساب موقوف حالياً" : "الحساب نشط"}</div>
                <div className="text-muted-foreground text-xs mt-1">
                  آخر دخول: {user.last_login_at ? dateAr(user.last_login_at) : "—"}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant={user.is_suspended ? "default" : "destructive"} size="sm" disabled={user.isOwner}>
                    {user.is_suspended ? <><UserCheck className="size-4 ms-1" /> تفعيل</> : <><UserX className="size-4 ms-1" /> إيقاف</>}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{user.is_suspended ? "تفعيل الحساب؟" : "إيقاف الحساب؟"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {user.is_suspended
                        ? "سيتمكن المستخدم من الدخول للنظام مرة أخرى."
                        : "لن يتمكن المستخدم من الدخول للنظام حتى تفعيله."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={toggleSuspend}>تأكيد</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Permissions */}
          <div className="space-y-4">
            {PERMISSION_GROUPS.map((group) => (
              <Card key={group.title}>
                <CardHeader className="pb-3">
                  <div className="font-semibold">{group.title}</div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.items.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!permState[p.key]}
                        onCheckedChange={(v) => togglePerm(p.key, !!v)}
                        disabled={user.isOwner}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-0 bg-background border-t pt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={save} disabled={saving || user.isOwner} className="gradient-gold text-gold-foreground">
              {saving ? "جاري الحفظ…" : "حفظ الصلاحيات"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// unused-var guard
void Switch;
