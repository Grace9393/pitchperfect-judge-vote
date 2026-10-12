CREATE OR REPLACE FUNCTION public.submit_score(p_code text,p_team uuid,p_problem int,p_impact int,p_execution int,p_data int,p_clarity int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=event_scope,public AS $$
DECLARE v_judge uuid; v_open boolean; v_locked boolean;
BEGIN
 v_judge:=public._judge_id(p_code);
 IF v_judge IS NULL THEN RAISE EXCEPTION 'Invalid judge code'; END IF;
 SELECT scoring_open INTO v_open FROM event_state WHERE id=1;
 IF NOT coalesce(v_open,false) THEN RAISE EXCEPTION 'Scoring is closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM teams WHERE id=p_team) THEN RAISE EXCEPTION 'Team does not belong to the active event'; END IF;
 PERFORM 1 FROM public.judges WHERE id=v_judge FOR UPDATE;
 SELECT locked INTO v_locked FROM scores WHERE judge_id=v_judge AND team_id=p_team;
 IF v_locked THEN RAISE EXCEPTION 'Score already submitted and locked'; END IF;
 INSERT INTO public.scores(judge_id,team_id,problem,impact,execution,data,clarity,locked,event_id) VALUES(v_judge,p_team,p_problem,p_impact,p_execution,p_data,p_clarity,true,public._active_event_id())
 ON CONFLICT(judge_id,team_id) DO UPDATE SET problem=excluded.problem,impact=excluded.impact,execution=excluded.execution,data=excluded.data,clarity=excluded.clarity,locked=true,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.enforce_event_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.event_id IS NULL OR NEW.event_id IS DISTINCT FROM public._active_event_id() THEN RAISE EXCEPTION 'This event is not active'; END IF;
 IF TG_TABLE_NAME IN ('teams','submissions') THEN
  IF NEW.track_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tracks WHERE id=NEW.track_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Track belongs to a different event'; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('voters','scores','votes') THEN
  IF NEW.team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.teams WHERE id=NEW.team_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Team belongs to a different event'; END IF;
 END IF;
 IF TG_TABLE_NAME='scores' THEN
  IF NOT EXISTS(SELECT 1 FROM public.judges WHERE id=NEW.judge_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Judge belongs to a different event'; END IF;
 END IF;
 IF TG_TABLE_NAME='votes' THEN
  IF NOT EXISTS(SELECT 1 FROM public.voters WHERE id=NEW.voter_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Voter belongs to a different event'; END IF;
 END IF;
 RETURN NEW;
END $$;
GRANT EXECUTE ON FUNCTION public.public_events(),public.admin_save_event(text,uuid,jsonb),public.admin_activate_event(text,uuid) TO service_role;