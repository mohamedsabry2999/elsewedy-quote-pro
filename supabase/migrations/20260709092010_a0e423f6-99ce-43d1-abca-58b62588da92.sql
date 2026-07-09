
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;
-- next_quotation_number is called by signed-in users to allocate a number
REVOKE EXECUTE ON FUNCTION public.next_quotation_number() FROM public, anon;
