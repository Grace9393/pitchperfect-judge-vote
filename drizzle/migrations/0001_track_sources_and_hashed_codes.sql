
create extension if not exists pgcrypto with schema extensions;

-- 1. Editable track source references
alter table public.tracks add column sources jsonb not null default '[]'::jsonb;
update public.tracks set sources = case id
  when 1 then '[{"label":"Ministry of the Interior – household registration statistics","url":"https://www.ris.gov.tw/app/portal/346","verified_on":""},{"label":"NDC population projections","url":"https://pop-proj.ndc.gov.tw/","verified_on":""},{"label":"data.gov.tw","url":"https://data.gov.tw/","verified_on":""}]'::jsonb
  when 2 then '[{"label":"MOHW Long-Term Care 2.0","url":"https://1966.gov.tw/LTC/mp-207.html","verified_on":""},{"label":"NHI open data","url":"https://data.nhi.gov.tw/","verified_on":""},{"label":"Taipei City Open Data","url":"https://data.taipei/","verified_on":""}]'::jsonb
  when 3 then '[{"label":"Cofacts open data (g0v)","url":"https://github.com/cofacts/opendata","verified_on":""},{"label":"Taiwan FactCheck Center","url":"https://tfc-taiwan.org.tw/","verified_on":""},{"label":"Legislative Yuan open data","url":"https://data.ly.gov.tw/","verified_on":""}]'::jsonb
  when 4 then '[{"label":"Central Weather Administration open data","url":"https://opendata.cwa.gov.tw/","verified_on":""},{"label":"Ministry of Environment open data (AQI)","url":"https://data.moenv.gov.tw/","verified_on":""},{"label":"Water Resources Agency open data","url":"https://opendata.wra.gov.tw/","verified_on":""}]'::jsonb
  else '[]'::jsonb end;

create or replace function public.admin_update_track(p_code text, p_id int, p_data_sources text, p_sources jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  if jsonb_typeof(p_sources) <> 'array' then raise exception 'Sources must be a list'; end if;
  update tracks set data_sources = coalesce(p_data_sources, ''), sources = p_sources where id = p_id;
  update event_state set version = version + 1 where id = 1;
end $$;

-- 2. Hashed access codes (plaintext removed)
alter table public.admin_secrets add column code_hash text, add column is_default boolean not null default true;
alter table public.judges add column code_hash text, add column is_default boolean not null default true;
alter table public.admin_secrets alter column code drop not null;
alter table public.judges alter column code drop not null;
update public.admin_secrets set code_hash = extensions.crypt(trim(code), extensions.gen_salt('bf')) where code is not null;
update public.judges set code_hash = extensions.crypt(upper(trim(code)), extensions.gen_salt('bf')) where code is not null;
update public.admin_secrets set code = null where id is not null;
update public.judges set code = null where id is not null;
comment on column public.judges.code is 'DEPRECATED: replaced by code_hash';
comment on column public.admin_secrets.code is 'DEPRECATED: replaced by code_hash';

create or replace function public._is_admin(p_code text) returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists(select 1 from admin_secrets where code_hash is not null and code_hash = extensions.crypt(trim(coalesce(p_code,'')), code_hash)) $$;

create or replace function public._judge_id(p_code text) returns uuid language sql stable security definer set search_path = public, extensions as $$
  select id from judges where code_hash is not null and code_hash = extensions.crypt(upper(trim(coalesce(p_code,''))), code_hash) limit 1 $$;

create or replace function public.judge_login(p_code text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'name', name) from judges where id = _judge_id(p_code) $$;

create or replace function public.judge_my_scores(p_code text) returns setof public.scores language sql stable security definer set search_path = public as $$
  select * from scores where judge_id = _judge_id(p_code) $$;

create or replace function public.submit_score(p_code text, p_team uuid, p_problem int, p_impact int, p_execution int, p_data int, p_clarity int)
returns void language plpgsql security definer set search_path = public as $$
declare v_judge uuid; v_open boolean; v_locked boolean;
begin
  v_judge := _judge_id(p_code);
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

create or replace function public.admin_code_status(p_code text) returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  return json_build_object(
    'admin_default', (select is_default from admin_secrets where id = 1),
    'judges', (select json_agg(json_build_object('id', id, 'name', name, 'is_default', is_default) order by sort_order) from judges));
end $$;

create or replace function public.admin_set_admin_code(p_code text, p_new text) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _require_admin(p_code);
  if length(trim(coalesce(p_new,''))) < 10 then raise exception 'New code must be at least 10 characters'; end if;
  update admin_secrets set code_hash = extensions.crypt(trim(p_new), extensions.gen_salt('bf')), is_default = false where id = 1;
end $$;

create or replace function public.admin_set_judge_code(p_code text, p_judge uuid, p_new text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_norm text := upper(trim(coalesce(p_new,'')));
begin
  perform _require_admin(p_code);
  if length(v_norm) < 8 then raise exception 'Judge code must be at least 8 characters'; end if;
  if exists(select 1 from judges where id <> p_judge and code_hash = extensions.crypt(v_norm, code_hash)) then raise exception 'Another judge already uses that code'; end if;
  update judges set code_hash = extensions.crypt(v_norm, extensions.gen_salt('bf')), is_default = false where id = p_judge;
  if not found then raise exception 'Judge not found'; end if;
end $$;

revoke all on function public._judge_id(text) from public, anon, authenticated;
grant execute on function public.admin_update_track(text, int, text, jsonb), public.admin_code_status(text),
  public.admin_set_admin_code(text, text), public.admin_set_judge_code(text, uuid, text) to anon, authenticated;
