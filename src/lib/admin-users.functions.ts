// Server functions for user administration (admin/owner only).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = "mohamedsabryabdelfatah@gmail.com";

async function assertAdmin(supabase: any, userId: string) {
  const [{ data: profile }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  const isOwner = (profile?.email ?? "").toLowerCase() === OWNER_EMAIL;
  if (!isOwner && !adminRow) throw new Error("Forbidden: admin only");
  return { isOwner };
}

export interface CreateUserPayload {
  email: string;
  password?: string;
  send_invite?: boolean;
  full_name: string;
  phone?: string;
  department?: string;
  internal_notes?: string;
  role: string; // app_role
  is_suspended?: boolean;
  permissions: string[]; // list of granted permission keys
}

export const createUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateUserPayload) => {
    if (!data?.email || !data?.full_name || !data?.role) throw new Error("Missing required fields");
    if (!data.send_invite && !data.password) throw new Error("Password or invite is required");
    if (data.password && data.password.length < 8) throw new Error("Password must be at least 8 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let newUserId: string;
    if (data.send_invite) {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { full_name: data.full_name },
      });
      if (error) throw new Error(error.message);
      newUserId = inv.user!.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (error) throw new Error(error.message);
      newUserId = created.user!.id;
    }

    // Update profile (handle_new_user trigger already inserted a row)
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        department: data.department ?? null,
        internal_notes: data.internal_notes ?? null,
        is_suspended: !!data.is_suspended,
      })
      .eq("id", newUserId);

    // Roles — the trigger picked a default. Replace unless the user is the owner.
    if (data.email.toLowerCase() !== OWNER_EMAIL) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role as any });
    }

    // Permissions — upsert one row per selected key
    if (data.permissions.length) {
      const rows = data.permissions.map((k) => ({ user_id: newUserId, permission_key: k, granted: true }));
      await supabaseAdmin.from("user_permissions").upsert(rows, { onConflict: "user_id,permission_key" });
    }

    // Activity
    await supabaseAdmin.from("user_activity_logs").insert({
      user_id: newUserId,
      actor_id: context.userId,
      action: "user_created",
      details: { role: data.role, permissions_count: data.permissions.length, invite: !!data.send_invite },
    });

    return { user_id: newUserId };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; email: string; redirect_to?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: data.redirect_to ? { redirectTo: data.redirect_to } : undefined,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_activity_logs").insert({
      user_id: data.user_id,
      actor_id: context.userId,
      action: "password_reset_sent",
      details: {},
    });
    return { ok: true };
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Prevent owner deletion
    const { data: p } = await supabaseAdmin.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
    if ((p?.email ?? "").toLowerCase() === OWNER_EMAIL) throw new Error("Cannot delete the owner");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_activity_logs").insert({
      user_id: data.user_id,
      actor_id: context.userId,
      action: "user_deleted",
      details: {},
    });
    return { ok: true };
  });

export const savePermissionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    user_id: string;
    role?: string;
    permissions: Record<string, boolean>;
    profile?: { full_name?: string; phone?: string | null; department?: string | null; internal_notes?: string | null; is_suspended?: boolean };
  }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
    const isOwnerTarget = (target?.email ?? "").toLowerCase() === OWNER_EMAIL;

    if (data.profile) {
      const patch: {
        full_name?: string; phone?: string | null; department?: string | null; internal_notes?: string | null; is_suspended?: boolean;
      } = {};
      if (data.profile.full_name !== undefined) patch.full_name = data.profile.full_name;
      if (data.profile.phone !== undefined) patch.phone = data.profile.phone;
      if (data.profile.department !== undefined) patch.department = data.profile.department;
      if (data.profile.internal_notes !== undefined) patch.internal_notes = data.profile.internal_notes;
      if (data.profile.is_suspended !== undefined && !isOwnerTarget) patch.is_suspended = data.profile.is_suspended;
      if (Object.keys(patch).length) {
        const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
        if (error) throw new Error(error.message);
      }
    }

    if (data.role && !isOwnerTarget) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role as any });
    }

    if (!isOwnerTarget) {
      const rows = Object.entries(data.permissions).map(([k, v]) => ({
        user_id: data.user_id,
        permission_key: k,
        granted: !!v,
      }));
      if (rows.length) {
        const { error } = await supabaseAdmin.from("user_permissions").upsert(rows, { onConflict: "user_id,permission_key" });
        if (error) throw new Error(error.message);
      }
    }

    await supabaseAdmin.from("user_activity_logs").insert({
      user_id: data.user_id,
      actor_id: context.userId,
      action: "user_updated",
      details: { role: data.role, permissions_changed: Object.keys(data.permissions).length },
    });

    return { ok: true };
  });
