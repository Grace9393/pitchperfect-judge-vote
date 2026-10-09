create or replace function public.submit_project(p_name text, p_email text, p_project text, p_track int, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare u text := trim(p_url);
begin
  if length(u) > 500 or u !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/|$)' then raise exception 'Please enter a valid https:// project link'; end if;
  insert into public.submissions(name, email, project_name, track_id, lovable_url)
  values (trim(p_name), trim(p_email), trim(p_project), p_track, u);
end $$;
comment on column public.submissions.lovable_url is 'Project URL (lovable.app, lovable.dev, or custom domain)';