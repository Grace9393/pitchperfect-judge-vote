# Plan: Lovable-usage repo scanner for submissions

## Goal
Let organizers scan each submission's project (Lovable project link, bare project ID, or GitHub URL) to verify Lovable usage — important for "built with Lovable" prize eligibility — and see the results in Admin → Submissions.

## Key constraint
The app's server runs on a lightweight cloud runtime that cannot execute Python. So `lovable_scan.py` will be **ported to TypeScript** inside a server function, calling the GitHub REST API directly. The uploaded script stays as the reference for the heuristics (actor/trailer regexes, phase classification, scoring).

## What gets built

### 1. GitHub token (one-time setup)
- The scanner needs a GitHub token (code search is auth-only, and rate limits are tight without one). I'll request it via the secure secret form as `GITHUB_TOKEN`; you create it at github.com → Settings → Developer settings → Personal access tokens (read-only is enough).

### 2. Database migration `submission_scans`
- New columns on `submissions`: `github_repo`, `lovable_project_id`, `lovable_used` (bool), `scan_confidence`, `lovable_commit_share` (0–100), `phase_breakdown` (jsonb: idea/plan/build/improve counts), `scan_note` (e.g. "no public repo references this project"), `scanned_at`.
- New RPCs: `admin_save_scan` (admin-code gated upsert of scan results) — reads stay covered by the existing `admin_list_submissions`.

### 3. Server function `scanSubmission` (`src/lib/repo-scan.functions.ts`)
- Admin-code gated (same pattern as `summarizeSubmission`).
- Input: submission's project URL / Lovable project ID / GitHub URL.
- Resolution order, mirroring the Python script:
  1. GitHub URL → owner/repo directly.
  2. `lovable.dev/projects/<uuid>` or bare UUID → GitHub code search for the project URL in READMEs → repo.
  3. Neither → return a note ("ask the submitter for the GitHub link").
- Fetches newest ~100 commits (no `--deep` line-level mode in v1), detects Lovable via author/committer (`gpt-engineer|lovable`) and co-authored-by trailers, classifies each commit idea/plan/build/improve with the same regexes, computes Lovable commit share and a confidence label.
- Extracts the Lovable project ID from the repo README so GitHub-only submissions can be matched to Lovable projects.
- Saves results via `admin_save_scan` and returns them to the UI.

### 4. Admin UI (`src/routes/admin.tsx` Review panel)
- "Scan repository" button next to the project URL; shows a spinner while scanning (a scan takes a few seconds).
- Results block: Lovable used? (yes/likely/no + confidence), commit share %, phase breakdown chips, matched Lovable project ID, linked GitHub repo, scan time, and any note (e.g. unresolvable ID).
- A small "Lovable ✓" badge in the submissions table for entries scanned as Lovable-built; scan status/note included in the CSV export.

## Out of scope (v1)
- `--deep` per-commit line-share analysis (1 API call per commit; too slow/rate-limited for the event).
- Bulk "scan all" button — scans are per-submission to stay within GitHub rate limits.

## Verification
- Typecheck, load /admin, run a scan against a known public Lovable-connected repo and a plain GitHub repo, confirm results save and render, confirm CSV export includes scan fields.
