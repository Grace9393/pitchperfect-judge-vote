CREATE FUNCTION public.admin_create_event(p_code text,p_patch jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN public.admin_save_event(p_code,NULL,p_patch); END $$;
REVOKE ALL ON FUNCTION public.admin_create_event(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_event(text,jsonb) TO anon,authenticated,service_role;