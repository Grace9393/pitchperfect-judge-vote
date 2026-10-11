CREATE OR REPLACE FUNCTION public.admin_list_submissions(p_code text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _is_admin(p_code) THEN
    coalesce((SELECT json_agg(row_to_json(s) ORDER BY s.created_at DESC) FROM submissions s), '[]'::json)
  ELSE '[]'::json END;
$$;