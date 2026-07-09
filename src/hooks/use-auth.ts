import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  roles: AppRole[];
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true, userId: null, email: null, fullName: null, roles: [],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      if (!user) { if (!cancelled) setState({ loading: false, userId: null, email: null, fullName: null, roles: [] }); return; }
      const [{ data: rolesData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setState({
        loading: false,
        userId: user.id,
        email: user.email ?? null,
        fullName: profile?.full_name ?? user.email ?? null,
        roles: (rolesData?.map((r) => r.role) ?? []) as AppRole[],
      });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
