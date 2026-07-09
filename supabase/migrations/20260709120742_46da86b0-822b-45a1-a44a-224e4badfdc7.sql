
-- 1. Profiles: extend
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;

-- 2. Owner helper
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND lower(email) = 'mohamedsabryabdelfatah@gmail.com'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated, service_role;

-- 3. User permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (user_id, permission_key)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_permissions read own or admin" ON public.user_permissions;
CREATE POLICY "user_permissions read own or admin" ON public.user_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

DROP POLICY IF EXISTS "user_permissions admin write" ON public.user_permissions;
CREATE POLICY "user_permissions admin write" ON public.user_permissions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

-- 4. has_permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_owner(_user_id)
    OR EXISTS(
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission_key = _key AND granted = true
    );
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

-- 5. Trigger: force sales_rep_id = auth.uid() on insert; prevent non-admin ownership change
CREATE OR REPLACE FUNCTION public.enforce_quotation_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.sales_rep_id := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.sales_rep_id IS DISTINCT FROM OLD.sales_rep_id
       AND NOT (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid())) THEN
      NEW.sales_rep_id := OLD.sales_rep_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS quotations_enforce_owner ON public.quotations;
CREATE TRIGGER quotations_enforce_owner
BEFORE INSERT OR UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.enforce_quotation_owner();

-- 6. Rewrite quotations RLS to enforce ownership
DROP POLICY IF EXISTS "quotations read" ON public.quotations;
DROP POLICY IF EXISTS "quotations insert" ON public.quotations;
DROP POLICY IF EXISTS "quotations update" ON public.quotations;
DROP POLICY IF EXISTS "quotations delete" ON public.quotations;

CREATE POLICY "quotations read" ON public.quotations FOR SELECT TO authenticated
USING (
  sales_rep_id = auth.uid()
  OR public.is_owner(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'view_all_quotations')
);

CREATE POLICY "quotations insert" ON public.quotations FOR INSERT TO authenticated
WITH CHECK (
  public.is_owner(auth.uid())
  OR public.has_any_role(auth.uid(), ARRAY['admin','sales_manager','sales_rep']::app_role[])
  OR public.has_permission(auth.uid(), 'create_quotation')
);

CREATE POLICY "quotations update" ON public.quotations FOR UPDATE TO authenticated
USING (
  sales_rep_id = auth.uid()
  OR public.is_owner(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'edit_all_quotations')
)
WITH CHECK (
  sales_rep_id = auth.uid()
  OR public.is_owner(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'edit_all_quotations')
);

CREATE POLICY "quotations delete" ON public.quotations FOR DELETE TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'delete_all_quotations')
  OR (sales_rep_id = auth.uid() AND status = 'draft')
);

-- 7. quotation_items: inherit parent visibility (RLS on subquery already filters)
DROP POLICY IF EXISTS "items read" ON public.quotation_items;
DROP POLICY IF EXISTS "items manage" ON public.quotation_items;

CREATE POLICY "items read" ON public.quotation_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_items.quotation_id));

CREATE POLICY "items manage" ON public.quotation_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (q.sales_rep_id = auth.uid()
         OR public.is_owner(auth.uid())
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_permission(auth.uid(), 'edit_all_quotations'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (q.sales_rep_id = auth.uid()
         OR public.is_owner(auth.uid())
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_permission(auth.uid(), 'edit_all_quotations'))
));

-- 8. activity_log: tighten read to related quotation visibility or own actions
DROP POLICY IF EXISTS "activity read" ON public.activity_log;
CREATE POLICY "activity read" ON public.activity_log FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_owner(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR (quotation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quotations q WHERE q.id = activity_log.quotation_id
  ))
);

-- 9. Protect owner: prevent role change/delete on owner
CREATE OR REPLACE FUNCTION public.protect_owner_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_owner(OLD.user_id) AND OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Cannot remove admin role from the owner';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF public.is_owner(OLD.user_id) AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      RAISE EXCEPTION 'Cannot downgrade the owner admin role';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_owner_role_trg ON public.user_roles;
CREATE TRIGGER protect_owner_role_trg
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_role();

CREATE OR REPLACE FUNCTION public.protect_owner_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_owner(OLD.id) THEN
    IF NEW.is_suspended = true THEN
      RAISE EXCEPTION 'Cannot suspend the owner account';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Cannot change the owner email';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_owner_profile_trg ON public.profiles;
CREATE TRIGGER protect_owner_profile_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_profile();

-- 10. Update handle_new_user to store email + auto-admin owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF lower(NEW.email) = 'mohamedsabryabdelfatah@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSIF (SELECT count(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'sales_rep')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 11. Ensure current owner has admin role if they already exist
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE lower(p.email) = 'mohamedsabryabdelfatah@gmail.com'
ON CONFLICT DO NOTHING;

-- 12. Backfill: any quotation without sales_rep_id → owner (if present)
UPDATE public.quotations
SET sales_rep_id = (
  SELECT id FROM public.profiles WHERE lower(email) = 'mohamedsabryabdelfatah@gmail.com' LIMIT 1
)
WHERE sales_rep_id IS NULL;
