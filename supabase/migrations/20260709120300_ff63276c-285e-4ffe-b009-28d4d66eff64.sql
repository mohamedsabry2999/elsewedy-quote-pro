GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.next_quotation_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_job_order_number() TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.quotation_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.job_order_seq TO authenticated, service_role;