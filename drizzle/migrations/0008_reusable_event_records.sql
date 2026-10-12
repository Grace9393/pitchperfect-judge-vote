CREATE TABLE public.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, name_zh text NOT NULL DEFAULT '',
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Taipei',
 venue text NOT NULL, city text NOT NULL DEFAULT '', organizer text NOT NULL DEFAULT '', partner text NOT NULL DEFAULT '',
 is_active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT event_window CHECK (ends_at > starts_at)
);
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX one_active_event ON public.events (is_active) WHERE is_active;
INSERT INTO public.events (name,name_zh,starts_at,ends_at,timezone,venue,city,organizer,partner,is_active)
 SELECT 'Hack for Humanity Taiwan','Hack for Humanity 台灣','2026-10-17 04:00:00+00','2026-10-17 11:00:00+00','Asia/Taipei','CollaPlay','Ximen, Taipei','The AI Collective Taipei with Major League Hacking','Lovable',true FROM public.event_state WHERE id=1;
CREATE FUNCTION public._active_event_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT id FROM public.events WHERE is_active $$;
REVOKE ALL ON FUNCTION public._active_event_id() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.tracks ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
ALTER TABLE public.teams ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
ALTER TABLE public.judges ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
ALTER TABLE public.voters ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
ALTER TABLE public.scores ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
ALTER TABLE public.votes ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
ALTER TABLE public.submissions ADD COLUMN event_id uuid REFERENCES public.events(id) DEFAULT public._active_event_id();
UPDATE public.tracks SET event_id=public._active_event_id() WHERE event_id IS NULL;
UPDATE public.teams SET event_id=public._active_event_id() WHERE event_id IS NULL;
UPDATE public.judges SET event_id=public._active_event_id() WHERE event_id IS NULL;
UPDATE public.voters SET event_id=public._active_event_id() WHERE event_id IS NULL;
UPDATE public.scores SET event_id=public._active_event_id() WHERE event_id IS NULL;
UPDATE public.votes SET event_id=public._active_event_id() WHERE event_id IS NULL;
UPDATE public.submissions SET event_id=public._active_event_id() WHERE event_id IS NULL;
CREATE TABLE public.event_runtimes (
 event_id uuid PRIMARY KEY REFERENCES public.events(id), id int NOT NULL DEFAULT 1,
 phase text NOT NULL DEFAULT 'checkin',current_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
 scoring_open boolean NOT NULL DEFAULT false,voting_open boolean NOT NULL DEFAULT false,scores_revealed boolean NOT NULL DEFAULT false,
 demo_mode boolean NOT NULL DEFAULT false,timer_started_at timestamptz,
 weights jsonb NOT NULL DEFAULT '{"problem":10,"impact":25,"execution":25,"data":15,"clarity":10}',
 version bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_runtimes TO service_role;
ALTER TABLE public.event_runtimes ENABLE ROW LEVEL SECURITY;
INSERT INTO public.event_runtimes SELECT public._active_event_id(),id,phase,current_team_id,scoring_open,voting_open,scores_revealed,demo_mode,timer_started_at,weights,version,updated_at FROM public.event_state WHERE id=1;
COMMENT ON TABLE public.event_state IS 'DEPRECATED: runtime state replaced by public.event_runtimes per event';
CREATE SCHEMA event_scope;
REVOKE ALL ON SCHEMA event_scope FROM PUBLIC,anon,authenticated;
CREATE VIEW event_scope.tracks AS SELECT * FROM public.tracks WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.teams AS SELECT * FROM public.teams WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.judges AS SELECT * FROM public.judges WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.voters AS SELECT * FROM public.voters WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.scores AS SELECT * FROM public.scores WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.votes AS SELECT * FROM public.votes WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.submissions AS SELECT * FROM public.submissions WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
CREATE VIEW event_scope.event_state AS SELECT id,phase,current_team_id,scoring_open,voting_open,scores_revealed,demo_mode,timer_started_at,weights,version,updated_at FROM public.event_runtimes WHERE event_id=public._active_event_id() WITH LOCAL CHECK OPTION;
-- Preserve existing code-gated workflows while making every unqualified data operation event-scoped.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname = ANY(ARRAY['bump_version','enforce_vote_rules','_judge_id','judge_login','judge_my_scores','submit_score','voter_login','cast_vote','get_results','admin_update_state','admin_upsert_team','admin_delete_team','admin_reopen_score','admin_generate_voters','admin_list_voters','admin_reset','admin_disable_demo','admin_update_track','admin_code_status','admin_set_judge_code','submit_project','admin_list_submissions','admin_delete_submission','admin_update_submission','admin_save_scan','public_judges','public_event_state']) LOOP
 EXECUTE format('ALTER FUNCTION %s SET search_path = event_scope, public, extensions',r.signature);
 END LOOP;
END $$;
-- These composite return types gained event_id, so project the complete safe scoped rows.
CREATE OR REPLACE FUNCTION public.public_tracks() RETURNS SETOF public.tracks LANGUAGE sql STABLE SECURITY DEFINER SET search_path=event_scope,public AS $$ SELECT * FROM tracks ORDER BY id $$;
CREATE OR REPLACE FUNCTION public.public_teams() RETURNS SETOF public.teams LANGUAGE sql STABLE SECURITY DEFINER SET search_path=event_scope,public AS $$ SELECT * FROM teams ORDER BY sort_order $$;
-- Cross-event references are rejected even when an ID is submitted manually.
CREATE FUNCTION public.enforce_event_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.event_id IS NULL OR NEW.event_id IS DISTINCT FROM public._active_event_id() THEN RAISE EXCEPTION 'This event is not active'; END IF;
 IF TG_TABLE_NAME IN ('teams','submissions') AND NEW.track_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tracks WHERE id=NEW.track_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Track belongs to a different event'; END IF;
 IF TG_TABLE_NAME IN ('voters','scores','votes') AND NEW.team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.teams WHERE id=NEW.team_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Team belongs to a different event'; END IF;
 IF TG_TABLE_NAME='scores' AND NOT EXISTS(SELECT 1 FROM public.judges WHERE id=NEW.judge_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Judge belongs to a different event'; END IF;
 IF TG_TABLE_NAME='votes' AND NOT EXISTS(SELECT 1 FROM public.voters WHERE id=NEW.voter_id AND event_id=NEW.event_id) THEN RAISE EXCEPTION 'Voter belongs to a different event'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER event_links_teams BEFORE INSERT OR UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.enforce_event_links();
CREATE TRIGGER event_links_submissions BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.enforce_event_links();
CREATE TRIGGER event_links_voters BEFORE INSERT OR UPDATE ON public.voters FOR EACH ROW EXECUTE FUNCTION public.enforce_event_links();
CREATE TRIGGER event_links_scores BEFORE INSERT OR UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.enforce_event_links();
CREATE TRIGGER event_links_votes BEFORE INSERT OR UPDATE ON public.votes FOR EACH ROW EXECUTE FUNCTION public.enforce_event_links();
REVOKE ALL ON FUNCTION public.enforce_event_links() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.public_events() RETURNS SETOF public.events LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT * FROM public.events ORDER BY starts_at DESC $$;
CREATE FUNCTION public.admin_save_event(p_code text,p_id uuid,p_patch jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_start timestamptz; v_end timestamptz; v_zone text; v_old uuid; v_name text;
BEGIN
 PERFORM public._require_admin(p_code);
 PERFORM pg_advisory_xact_lock(904172026);
 v_name:=trim(coalesce(p_patch->>'name','')); v_zone:=coalesce(p_patch->>'timezone','Asia/Taipei');
 IF length(v_name)<1 OR length(v_name)>120 THEN RAISE EXCEPTION 'Enter an event name (max 120 characters)'; END IF;
 IF length(trim(coalesce(p_patch->>'venue','')))<1 OR length(p_patch->>'venue')>200 THEN RAISE EXCEPTION 'Enter a venue (max 200 characters)'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=v_zone) THEN RAISE EXCEPTION 'Choose a valid timezone'; END IF;
 v_start:=(p_patch->>'starts_at')::timestamptz; v_end:=(p_patch->>'ends_at')::timestamptz;
 IF v_start IS NULL OR v_end IS NULL OR v_end<=v_start THEN RAISE EXCEPTION 'End time must be after start time'; END IF;
 IF p_id IS NOT NULL THEN
 UPDATE public.events SET name=v_name,name_zh=trim(coalesce(p_patch->>'name_zh','')),starts_at=v_start,ends_at=v_end,timezone=v_zone,venue=trim(p_patch->>'venue'),city=trim(coalesce(p_patch->>'city','')),organizer=trim(coalesce(p_patch->>'organizer','')),partner=trim(coalesce(p_patch->>'partner','')) WHERE id=p_id RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
 ELSE
 v_old:=public._active_event_id();
 INSERT INTO public.events(name,name_zh,starts_at,ends_at,timezone,venue,city,organizer,partner) VALUES(v_name,trim(coalesce(p_patch->>'name_zh','')),v_start,v_end,v_zone,trim(p_patch->>'venue'),trim(coalesce(p_patch->>'city','')),trim(coalesce(p_patch->>'organizer','')),trim(coalesce(p_patch->>'partner',''))) RETURNING id INTO v_id;
 INSERT INTO public.event_runtimes(event_id,weights) SELECT v_id,weights FROM public.event_runtimes WHERE event_id=v_old;
 INSERT INTO public.tracks(id,name_en,name_zh,data_sources,sources,event_id) SELECT (SELECT coalesce(max(id),0) FROM public.tracks)+row_number() OVER(ORDER BY id),name_en,name_zh,data_sources,sources,v_id FROM public.tracks WHERE event_id=v_old;
 INSERT INTO public.judges(name,sort_order,code_hash,is_default,event_id) SELECT name,sort_order,code_hash,is_default,v_id FROM public.judges WHERE event_id=v_old;
 END IF;
 RETURN v_id;
END $$;
CREATE FUNCTION public.admin_activate_event(p_code text,p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public._require_admin(p_code); PERFORM pg_advisory_xact_lock(904172026);
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_id) THEN RAISE EXCEPTION 'Event not found'; END IF;
 UPDATE public.event_runtimes SET scoring_open=false,voting_open=false,timer_started_at=NULL,version=version+1 WHERE event_id=public._active_event_id() OR event_id=p_id;
 UPDATE public.events SET is_active=false WHERE is_active;
 UPDATE public.events SET is_active=true WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.public_events(),public.admin_save_event(text,uuid,jsonb),public.admin_activate_event(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_events(),public.admin_save_event(text,uuid,jsonb),public.admin_activate_event(text,uuid) TO anon,authenticated;
CREATE INDEX ON public.tracks(event_id);
CREATE INDEX ON public.teams(event_id);
CREATE INDEX ON public.judges(event_id);
CREATE INDEX ON public.voters(event_id);
CREATE INDEX ON public.scores(event_id);
CREATE INDEX ON public.votes(event_id);
CREATE INDEX ON public.submissions(event_id);