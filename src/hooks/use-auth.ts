import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";
import type { PermissionKey } from "@/lib/permissions";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

const OWNER_EMAIL = "mohamedsabryabdelfatah@gmail.com";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  roles: AppRole[];
  permissions: Set<string>;
  isOwner: boolean;
  isAdmin: boolean;
  can: (key: PermissionKey) => boolean;
}

const EMPTY: AuthState = {
  loading: true, userId: null, email: null, fullName: null, roles: [],
  permissions: new Set(), isOwner: false, isAdmin: false, can: () => false,
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      if (!user) {
        if (!cancelled) setState({ ...EMPTY, loading: false });
        return;
      }
      const [{ data: rolesData }, { data: profile }, { data: perms }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_permissions").select("permission_key, granted").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const email = user.email ?? profile?.email ?? null;
      const isOwner = (email ?? "").toLowerCase() === OWNER_EMAIL;
      const roles = (rolesData?.map((r) => r.role) ?? []) as AppRole[];
      const isAdmin = isOwner || roles.includes("admin");
      const granted = new Set<string>();
      (perms ?? []).forEach((p) => { if (p.granted) granted.add(p.permission_key); });
      // Owner & admin implicitly hold every permission
      if (isOwner || isAdmin) ALL_PERMISSION_KEYS.forEach((k) => granted.add(k));
      setState({
        loading: false,
        userId: user.id,
        email,
        fullName: profile?.full_name ?? email,
        roles,
        permissions: granted,
        isOwner,
        isAdmin,
        can: (k: PermissionKey) => isOwner || isAdmin || granted.has(k),
      });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
