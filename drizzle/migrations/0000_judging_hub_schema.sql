
create table public.tracks (id int primary key, name_en text not null, name_zh text not null, data_sources text not null default '');
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null, track_id int references public.tracks(id),
  members text not null default '', project_name text not null default '',
  description text not null default '', deck_url text not null default '',
  table_number text not null default '', built_with_lovable boolean not null default false,
  voter_group text not null default '', sort_order int not null default 0,
  is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.judges (id uuid primary key default gen_random_uuid(), name text not null, code text not null unique, sort_order int not null default 0);
create table public.event_state (
  id int primary key default 1 check (id = 1),
  phase text not null default 'checkin',
  current_team_id uuid references public.teams(id) on delete set null,
  scoring_open boolean not null default false,
  voting_open boolean not null default false,
  scores_revealed boolean not null default false,
  demo_mode boolean not null default true,
  timer_started_at timestamptz,
  weights jsonb not null default '{"problem":10,"impact":25,"execution":25,"data":15,"clarity":10}',
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table public.admin_secrets (id int primary key default 1, code text not null);
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.judges(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  problem int not null check (problem between 1 and 10),
  impact int not null check (impact between 1 and 10),
  execution int not null check (execution between 1 and 10),
  data int not null check (data between 1 and 10),
  clarity int not null check (clarity between 1 and 10),
  locked boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (judge_id, team_id)
);
create table public.voters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  team_id uuid references public.teams(id) on delete cascade,
  is_demo boolean not null default false
);
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.voters(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (voter_id, team_id)
);

grant select on public.tracks, public.teams, public.event_state to anon, authenticated;
grant select (id, name, sort_order) on public.judges to anon, authenticated;
grant all on public.tracks, public.teams, public.judges, public.event_state, public.admin_secrets, public.scores, public.voters, public.votes to service_role;

alter table public.tracks enable row level security;
alter table public.teams enable row level security;
alter table public.judges enable row level security;
alter table public.event_state enable row level security;
alter table public.admin_secrets enable row level security;
alter table public.scores enable row level security;
alter table public.voters enable row level security;
alter table public.votes enable row level security;
create policy "public read tracks" on public.tracks for select to anon, authenticated using (true);
create policy "public read teams" on public.teams for select to anon, authenticated using (true);
create policy "public read judges" on public.judges for select to anon, authenticated using (true);
create policy "public read state" on public.event_state for select to anon, authenticated using (true);

create or replace function public.enforce_vote_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_count int; v_open boolean;
begin
  select voting_open into v_open from event_state where id = 1;
  if not v_open then raise exception 'Voting is closed'; end if;
  perform 1 from voters where id = new.voter_id for update;
  select team_id into v_team from voters where id = new.voter_id;
  if v_team is not null and v_team = new.team_id then raise exception 'You cannot vote for your own team'; end if;
  select count(*) into v_count from votes where voter_id = new.voter_id;
  if v_count >= 3 then raise exception 'No votes remaining'; end if;
  return new;
end $$;
create trigger trg_vote_rules before insert on public.votes for each row execute function public.enforce_vote_rules();

create or replace function public.bump_version() returns trigger language plpgsql security definer set search_path = public as $$
begin update event_state set version = version + 1, updated_at = now() where id = 1; return null; end $$;
create trigger trg_bump_scores after insert or update or delete on public.scores for each statement execute function public.bump_version();
create trigger trg_bump_votes after insert or update or delete on public.votes for each statement execute function public.bump_version();
create trigger trg_bump_teams after insert or update or delete on public.teams for each statement execute function public.bump_version();

create or replace function public._is_admin(p_code text) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from admin_secrets where code = p_code) $$;
create or replace function public._require_admin(p_code text) returns void language plpgsql stable security definer set search_path = public as $$
begin if not _is_admin(p_code) then raise exception 'Invalid admin code'; end if; end $$;

create or replace function public.admin_login(p_code text) returns boolean language sql stable security definer set search_path = public as $$ select _is_admin(p_code) $$;

create or replace function public.judge_login(p_code text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'name', name) from judges where code = upper(trim(p_code)) $$;

create or replace function public.judge_my_scores(p_code text) returns setof public.scores language sql stable security definer set search_path = public as $$
  select s.* from scores s join judges j on j.id = s.judge_id where j.code = upper(trim(p_code)) $$;

create or replace function public.submit_score(p_code text, p_team uuid, p_problem int, p_impact int, p_execution int, p_data int, p_clarity int)
returns void language plpgsql security definer set search_path = public as $$
declare v_judge uuid; v_open boolean; v_locked boolean;
begin
  select id into v_judge from judges where code = upper(trim(p_code));
  if v_judge is null then raise exception 'Invalid judge code'; end if;
  select scoring_open into v_open from event_state where id = 1;
  if not v_open then raise exception 'Scoring is closed'; end if;
  select locked into v_locked from scores where judge_id = v_judge and team_id = p_team;
  if v_locked then raise exception 'Score already submitted and locked'; end if;
  insert into scores (judge_id, team_id, problem, impact, execution, data, clarity, locked)
  values (v_judge, p_team, p_problem, p_impact, p_execution, p_data, p_clarity, true)
  on conflict (judge_id, team_id) do update set problem = excluded.problem, impact = excluded.impact, execution = excluded.execution,
    data = excluded.data, clarity = excluded.clarity, locked = true, updated_at = now();
end $$;

create or replace function public.voter_login(p_code text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', v.id, 'team_id', v.team_id,
    'voted', coalesce((select json_agg(team_id) from votes where voter_id = v.id), '[]'::json))
  from voters v where v.code = upper(trim(p_code)) $$;

create or replace function public.cast_vote(p_code text, p_team uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from voters where code = upper(trim(p_code));
  if v_id is null then raise exception 'Invalid voter code'; end if;
  insert into votes (voter_id, team_id) values (v_id, p_team);
exception when unique_violation then raise exception 'You already voted for this team';
end $$;

create or replace function public.get_results(p_code text default null) returns json language plpgsql stable security definer set search_path = public as $$
declare v_state event_state; v_admin boolean; v_can boolean;
begin
  select * into v_state from event_state where id = 1;
  v_admin := _is_admin(coalesce(p_code, ''));
  v_can := v_admin or v_state.scores_revealed or v_state.phase = 'results';
  return json_build_object(
    'can_see', v_can,
    'scores', case when v_can then coalesce((select json_agg(json_build_object('judge_id', judge_id, 'team_id', team_id, 'problem', problem, 'impact', impact, 'execution', execution, 'data', data, 'clarity', clarity, 'locked', locked)) from scores), '[]'::json) else '[]'::json end,
    'votes', case when v_can then coalesce((select json_agg(json_build_object('team_id', team_id, 'count', c)) from (select team_id, count(*) c from votes group by team_id) x), '[]'::json) else '[]'::json end,
    'progress', coalesce((select json_agg(json_build_object('judge_id', judge_id, 'team_id', team_id)) from scores where locked), '[]'::json),
    'total_votes', (select count(*) from votes)
  );
end $$;

create or replace function public.admin_update_state(p_code text, p_patch jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  update event_state set
    phase = coalesce(p_patch->>'phase', phase),
    current_team_id = case when p_patch ? 'current_team_id' then nullif(p_patch->>'current_team_id','')::uuid else current_team_id end,
    scoring_open = coalesce((p_patch->>'scoring_open')::boolean, scoring_open),
    voting_open = coalesce((p_patch->>'voting_open')::boolean, voting_open),
    scores_revealed = coalesce((p_patch->>'scores_revealed')::boolean, scores_revealed),
    timer_started_at = case when p_patch ? 'timer_started_at' then nullif(p_patch->>'timer_started_at','')::timestamptz else timer_started_at end,
    weights = coalesce(p_patch->'weights', weights),
    version = version + 1, updated_at = now()
  where id = 1;
end $$;

create or replace function public.admin_upsert_team(p_code text, p_team jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform _require_admin(p_code);
  v_id := nullif(p_team->>'id','')::uuid;
  if v_id is null then
    insert into teams (name, track_id, members, project_name, description, deck_url, table_number, built_with_lovable, voter_group, sort_order)
    values (p_team->>'name', (p_team->>'track_id')::int, coalesce(p_team->>'members',''), coalesce(p_team->>'project_name',''),
      coalesce(p_team->>'description',''), coalesce(p_team->>'deck_url',''), coalesce(p_team->>'table_number',''),
      coalesce((p_team->>'built_with_lovable')::boolean,false), coalesce(p_team->>'voter_group',''), (select coalesce(max(sort_order),0)+1 from teams))
    returning id into v_id;
  else
    update teams set name = p_team->>'name', track_id = (p_team->>'track_id')::int, members = coalesce(p_team->>'members',''),
      project_name = coalesce(p_team->>'project_name',''), description = coalesce(p_team->>'description',''), deck_url = coalesce(p_team->>'deck_url',''),
      table_number = coalesce(p_team->>'table_number',''), built_with_lovable = coalesce((p_team->>'built_with_lovable')::boolean,false),
      voter_group = coalesce(p_team->>'voter_group','')
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_team(p_code text, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform _require_admin(p_code); delete from teams where id = p_id; end $$;

create or replace function public.admin_reopen_score(p_code text, p_judge uuid, p_team uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform _require_admin(p_code); update scores set locked = false where judge_id = p_judge and team_id = p_team; end $$;

create or replace function public.admin_generate_voters(p_code text, p_team uuid, p_count int) returns setof text language plpgsql security definer set search_path = public as $$
declare i int; c text;
begin
  perform _require_admin(p_code);
  if p_count < 1 or p_count > 200 then raise exception 'Count must be 1-200'; end if;
  for i in 1..p_count loop
    loop
      c := 'V' || upper(substr(md5(gen_random_uuid()::text), 1, 5));
      begin insert into voters (code, team_id) values (c, p_team); exit; exception when unique_violation then end;
    end loop;
    return next c;
  end loop;
end $$;

create or replace function public.admin_list_voters(p_code text) returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  return coalesce((select json_agg(json_build_object('code', v.code, 'team_id', v.team_id, 'used', (select count(*) from votes where voter_id = v.id)) order by v.code) from voters v), '[]'::json);
end $$;

create or replace function public.admin_reset(p_code text, p_what text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  if p_what in ('scores','all') then delete from scores where id is not null; end if;
  if p_what in ('votes','all') then delete from votes where id is not null; end if;
  if p_what = 'all' then
    update event_state set phase = 'checkin', current_team_id = null, scoring_open = false, voting_open = false, scores_revealed = false, timer_started_at = null where id = 1;
  end if;
end $$;

create or replace function public.admin_disable_demo(p_code text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  delete from votes where id is not null; delete from scores where id is not null;
  delete from voters where is_demo; delete from teams where is_demo;
  update event_state set demo_mode = false, current_team_id = null, phase = 'checkin', scoring_open = false, voting_open = false, scores_revealed = false where id = 1;
end $$;

revoke all on function public._is_admin(text), public._require_admin(text), public.enforce_vote_rules(), public.bump_version() from public, anon, authenticated;
grant execute on function public.admin_login(text), public.judge_login(text), public.judge_my_scores(text), public.submit_score(text, uuid, int, int, int, int, int),
  public.voter_login(text), public.cast_vote(text, uuid), public.get_results(text), public.admin_update_state(text, jsonb), public.admin_upsert_team(text, jsonb),
  public.admin_delete_team(text, uuid), public.admin_reopen_score(text, uuid, uuid), public.admin_generate_voters(text, uuid, int), public.admin_list_voters(text),
  public.admin_reset(text, text), public.admin_disable_demo(text) to anon, authenticated;

alter publication supabase_realtime add table public.event_state;

insert into public.admin_secrets (id, code) values (1, 'HFH-ADMIN-2026');
insert into public.event_state (id) values (1);
insert into public.judges (name, code, sort_order) values ('Ta-Wei Wang','WANG-7241',1), ('Jered Odegard','ODEGARD-3859',2), ('Antoine Collard','COLLARD-5167',3);
insert into public.tracks values
 (1,'Reversing the Birthrate Decline','扭轉少子化','Ministry of the Interior household registration statistics (births, marriages by township); National Development Council population projections; Ministry of Health and Welfare childcare subsidy and public preschool data; data.gov.tw open datasets.'),
 (2,'Tech for a Super-Aged Society','超高齡社會科技','Ministry of Health and Welfare Long-Term Care 2.0 service locations; National Health Insurance open data; elderly population by district (Ministry of the Interior); Taipei City Open Data elderly care facilities.'),
 (3,'Civic Tech & Fighting Misinformation','公民科技與打擊假訊息','Cofacts open fact-check database (g0v); Taiwan FactCheck Center reports; Legislative Yuan open data; Central Election Commission results; g0v community datasets.'),
 (4,'Climate & Disaster Resilience','氣候與災害韌性','Central Weather Administration open data (rainfall, earthquakes, typhoons); Ministry of Environment air quality (AQI); Water Resources Agency flood potential maps; National Fire Agency shelter locations.');
insert into public.teams (name, track_id, members, project_name, description, deck_url, table_number, built_with_lovable, voter_group, sort_order, is_demo) values
 ('Cradle Labs',1,'Mei Lin, Kevin Chen, Yu-Ting Huang','NestMap','Maps childcare subsidies and public preschool openings by township for new parents.','https://example.com/deck1','A1',true,'G1',1,true),
 ('Silver Thread',2,'Hsin-Yi Wu, David Lee','CareCircle','Matches seniors living alone with nearby long-term care services and volunteers.','https://example.com/deck2','A2',true,'G2',2,true),
 ('Truth Kettle',3,'Chia-Hao Lin, Sarah Kim, Po-Wei Tsai','RumorRadar','A LINE bot that checks forwarded messages against Cofacts in seconds.','https://example.com/deck3','B1',false,'G3',3,true),
 ('Typhoon Ready',4,'Ling Chang, Marcus Ho','ShelterNow','Live shelter finder combining CWA alerts with flood potential maps.','https://example.com/deck4','B2',true,'G4',4,true),
 ('Grey Matter',2,'Ting Yeh, Alex Wong, Jun Liu','MediMemo','Voice medication reminders for elders, fed by NHI prescription formats.','https://example.com/deck5','C1',true,'G5',5,true),
 ('Air Signal',4,'Shu-Fen Kao, Ben Lai','BreatheTW','Hyperlocal AQI warnings for schools and outdoor workers.','https://example.com/deck6','C2',false,'G6',6,true);
insert into public.voters (code, team_id, is_demo)
select 'DEMO' || t.sort_order || '-' || g, t.id, true from public.teams t cross join generate_series(1,2) g;
insert into public.voters (code, team_id, is_demo) values ('GUEST-1', null, true), ('GUEST-2', null, true), ('GUEST-3', null, true);
