ALTER TABLE public.submissions
  ADD COLUMN github_repo text NOT NULL DEFAULT '',
  ADD COLUMN lovable_project_id text NOT NULL DEFAULT '',
  ADD COLUMN scan_verdict text NOT NULL DEFAULT '',
  ADD COLUMN scan_confidence text NOT NULL DEFAULT '',
  ADD COLUMN lovable_commit_share numeric,
  ADD COLUMN phase_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN scan_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN scan_note text NOT NULL DEFAULT '',
  ADD COLUMN scanned_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_save_scan(p_code text, p_id uuid, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _require_admin(p_code);
  UPDATE submissions SET
    github_repo = coalesce(p_patch->>'github_repo', github_repo),
    lovable_project_id = coalesce(p_patch->>'lovable_project_id', lovable_project_id),
    scan_verdict = coalesce(p_patch->>'scan_verdict', scan_verdict),
    scan_confidence = coalesce(p_patch->>'scan_confidence', scan_confidence),
    lovable_commit_share = CASE WHEN p_patch ? 'lovable_commit_share' THEN (p_patch->>'lovable_commit_share')::numeric ELSE lovable_commit_share END,
    phase_breakdown = coalesce(p_patch->'phase_breakdown', phase_breakdown),
    scan_signals = coalesce(p_patch->'scan_signals', scan_signals),
    scan_note = coalesce(p_patch->>'scan_note', scan_note),
    scanned_at = now()
  WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_submissions(p_code text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(row_to_json(s) ORDER BY s.created_at DESC), '[]'::json)
  FROM (SELECT * FROM submissions WHERE _require_admin(p_code) IS NULL) s;
$$;