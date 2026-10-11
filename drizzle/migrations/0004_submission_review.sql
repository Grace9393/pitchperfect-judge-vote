alter table public.submissions
  add column description text not null default '',
  add column review_status text not null default 'new' check (review_status in ('new','reviewing','follow_up','approved','rejected')),
  add column notes text not null default '',
  add column ai_summary text not null default '',
  add column ai_summary_at timestamptz;

create or replace function public.admin_update_submission(p_code text, p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin(p_code);
  if p_patch ? 'review_status' and (p_patch->>'review_status') not in ('new','reviewing','follow_up','approved','rejected') then
    raise exception 'Invalid status'; end if;
  if length(coalesce(p_patch->>'notes','')) > 5000 then raise exception 'Notes too long'; end if;
  if length(coalesce(p_patch->>'description','')) > 2000 then raise exception 'Description too long'; end if;
  update submissions set
    review_status = coalesce(p_patch->>'review_status', review_status),
    notes = coalesce(p_patch->>'notes', notes),
    description = coalesce(p_patch->>'description', description),
    ai_summary = coalesce(p_patch->>'ai_summary', ai_summary),
    ai_summary_at = case when p_patch ? 'ai_summary' then now() else ai_summary_at end
  where id = p_id;
end $$;
grant execute on function public.admin_update_submission(text, uuid, jsonb) to anon, authenticated;