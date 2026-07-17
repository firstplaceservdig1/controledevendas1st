
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sales_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- authenticated needs has_role for RLS predicates? RLS runs as function owner context; safe to revoke from authenticated too.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
