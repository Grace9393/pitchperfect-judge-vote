-- Replace USING(true) public SELECT policies with security-definer RPCs that expose only safe columns.

CREATE OR REPLACE FUNCTION public.public_tracks()
RETURNS SETOF tracks LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name_en, name_zh, data_sources, sources FROM tracks ORDER BY id;
$$;

CREATE OR REPLACE FUNCTION public.public_teams()
RETURNS SETOF teams LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, track_id, members, project_name, description, deck_url, table_number,
         built_with_lovable, voter_group, sort_order, is_demo, created_at
  FROM teams ORDER BY sort_order;
$$;

CREATE OR REPLACE FUNCTION public.public_judges()
RETURNS TABLE(id uuid, name text, sort_order integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, sort_order FROM judges ORDER BY sort_order;
$$;

CREATE OR REPLACE FUNCTION public.public_event_state()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('phase', phase, 'current_team_id', current_team_id,
    'scoring_open', scoring_open, 'voting_open', voting_open, 'scores_revealed', scores_revealed,
    'demo_mode', demo_mode, 'timer_started_at', timer_started_at, 'weights', weights, 'version', version)
  FROM event_state WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_tracks() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_teams() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_judges() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_event_state() TO anon, authenticated;

DROP POLICY "public read teams" ON public.teams;
DROP POLICY "public read tracks" ON public.tracks;
DROP POLICY "public read state" ON public.event_state;
DROP POLICY "public read judges" ON public.judges;

REVOKE SELECT ON public.teams FROM anon, authenticated;
REVOKE SELECT ON public.tracks FROM anon, authenticated;
REVOKE SELECT ON public.event_state FROM anon, authenticated;
REVOKE SELECT ON public.judges FROM anon, authenticated;