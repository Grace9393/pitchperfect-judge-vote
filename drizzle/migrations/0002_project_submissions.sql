
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  project_name text not null,
  track_id int not null references public.tracks(id),
  lovable_url text not null,
  created_at timestamptz not null default now()
);
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
-- no anon/authenticated policies: access only through validated functions below

create or replace function public.submit_project(p_name text, p_email text, p_project text, p_track int, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := trim(coalesce(p_name,'')); e text := lower(trim(coalesce(p_email,''))); pr text := trim(coalesce(p_project,'')); u text := trim(coalesce(p_url,''));
begin
  if length(n) < 1 or length(n) > 100 then raise exception 'Please enter your name (max 100 characters)'; end if;
  if length(e) > 255 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email'; end if;
  if length(pr) < 1 or length(pr) > 120 then raise exception 'Please enter a project name (max 120 characters)'; end if;
  if not exists(select 1 from tracks where id = p_track) then raise exception 'Please choose a track'; end if;
  if length(u) > 500 or u !~* '^https://[a-z0-9.-]*lovable\.(app|dev)(/|$)' then raise exception 'Please enter a Lovable link (https://….lovable.app)'; end if;
  insert into submissions (name, email, project_name, track_id, lovable_url) values (n, e, pr, p_track, u);
end $$;

create or replace function public.admin_list_submissions(p_code text) returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  return coalesce((select json_agg(row_to_json(s) order by s.created_at desc) from submissions s), '[]'::json);
end $$;

create or replace function public.admin_delete_submission(p_code text, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform _require_admin(p_code); delete from submissions where id = p_id; end $$;

grant execute on function public.submit_project(text, text, text, int, text), public.admin_list_submissions(text), public.admin_delete_submission(text, uuid) to anon, authenticated;
