
-- Extra profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Activity log
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_activity_logs TO authenticated;
GRANT ALL ON public.user_activity_logs TO service_role;

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_admin_read" ON public.user_activity_logs;
CREATE POLICY "activity_admin_read" ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "activity_admin_insert" ON public.user_activity_logs;
CREATE POLICY "activity_admin_insert" ON public.user_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON public.user_activity_logs(user_id, created_at DESC);

-- Ensure admins can read all profiles
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
CREATE POLICY "profiles_admin_read_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

-- Ensure admins can update profiles (department, notes, suspended)
DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
CREATE POLICY "profiles_admin_update_all" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

-- Ensure admins can manage user_permissions
DROP POLICY IF EXISTS "user_perms_admin_all" ON public.user_permissions;
CREATE POLICY "user_perms_admin_all" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

-- Ensure admins can manage user_roles (already exist but ensure)
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));
