import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Port of lovable_scan.py heuristics (no --deep line stats in v1).
const LOVABLE_ACTOR_RE = /gpt-engineer|lovable/i;
const LOVABLE_TRAILER_RE = /co-authored-by:.*(lovable|gpt-engineer)/i;
const LOVABLE_URL_RE = /lovable\.(?:dev|app)\/projects\/([0-9a-f-]{36})/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IDEA_RE = /\b(initial commit|first commit|initial setup|init|scaffold\w*|bootstrap\w*|use tech stack|brainstorm\w*|idea|concept|poc|proof of concept|prototype)\b/;
const PLAN_RE = /\b(plan|planning|roadmap|spec|specs|prd|requirements?|milestones?)\b/;
const IMPROVE_V = "fix|fixed|fixes|refactor\\w*|improve\\w*|optimi[sz]e\\w*|polish\\w*|tweak\\w*|adjust\\w*|update\\w*|enhance\\w*|clean\\w*|style|styling|restyle\\w*|revert\\w*|rename\\w*|remove\\w*|simplif\\w*|tidy|resolve\\w*|correct\\w*|change\\w*|edit\\w*|modify|modified|redesign\\w*|rework\\w*|upgrade\\w*|bump\\w*|migrate\\w*|move\\w*|code";
const BUILD_V = "add|added|adds|create\\w*|implement\\w*|build|built|introduce\\w*|integrate\\w*|set|setup|develop\\w*|generate\\w*|connect\\w*|enable\\w*|include\\w*|initialize\\w*|install\\w*";
const IMPROVE_FULL = new RegExp(`^(${IMPROVE_V})$`);
const BUILD_FULL = new RegExp(`^(${BUILD_V})$`);
const IMPROVE_WORD = new RegExp(`\\b(${IMPROVE_V})\\b`);
const BUILD_WORD = new RegExp(`\\b(${BUILD_V})\\b`);

const PHASES = ["idea", "plan", "build", "improve"] as const;
type Phase = (typeof PHASES)[number];

const Input = z.object({
  code: z.string().min(1).max(200),
  submissionId: z.string().uuid(),
  target: z.string().min(1).max(500), // GitHub URL, owner/repo, lovable.dev project URL, or bare UUID
});

type GhCommit = {
  sha: string;
  parents?: unknown[];
  author?: { login?: string } | null;
  committer?: { login?: string } | null;
  commit: {
    message?: string;
    author?: { name?: string; email?: string };
    committer?: { name?: string; email?: string };
  };
};

async function gh(path: string, token: string, params?: Record<string, string>): Promise<unknown | null> {
  const url = new URL(path.startsWith("http") ? path : `https://api.github.com${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "hfh-lovable-scan",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) return res.json();
    if ([404, 409, 451].includes(res.status)) return null;
    if ([403, 429].includes(res.status)) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`GitHub API error ${res.status}`);
  }
  return null;
}

async function readFile(repo: string, path: string, token: string): Promise<string> {
  const d = (await gh(`/repos/${repo}/contents/${encodeURIComponent(path)}`, token)) as { encoding?: string; content?: string } | null;
  if (!d || d.encoding !== "base64" || !d.content) return "";
  try {
    return atob(d.content.replace(/\n/g, ""));
  } catch {
    return "";
  }
}

function parseLovable(s: string): string | null {
  const clean = s.trim().replace(/^["']|["']$/g, "");
  const m = LOVABLE_URL_RE.exec(clean);
  if (m) return m[1].toLowerCase();
  return UUID_RE.test(clean) ? clean.toLowerCase() : null;
}

function parseRepo(s: string): string | null {
  const clean = s.trim().replace(/^["']|["']$/g, "");
  if (LOVABLE_URL_RE.test(clean)) return null;
  let m = /github\.com[/:]([^/\s]+)\/([^/\s#?]+)/.exec(clean);
  if (!m) m = /^([\w.-]+)\/([\w.-]+)$/.exec(clean) as RegExpExecArray | null;
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/, "")}`;
}

function shallowest(paths: string[], names: Set<string>): string | null {
  const hits = paths.filter((p) => names.has(p.split("/").pop()!.toLowerCase()) && p.split("/").length <= 3);
  return hits.sort((a, b) => a.split("/").length - b.split("/").length)[0] ?? null;
}

function isLovableCommit(c: GhCommit): boolean {
  const blob = [
    c.author?.login, c.committer?.login,
    c.commit.author?.name, c.commit.author?.email,
    c.commit.committer?.name, c.commit.committer?.email,
  ].filter(Boolean).join(" ");
  return LOVABLE_ACTOR_RE.test(blob) || LOVABLE_TRAILER_RE.test(c.commit.message ?? "");
}

function classify(msg: string, idx: number): Phase {
  const first = (msg.trim().split("\n")[0] ?? "").toLowerCase();
  if (idx === 0) return "idea";
  if (PLAN_RE.test(first)) return "plan";
  if (IDEA_RE.test(first)) return "idea";
  const verb = /^\W*([a-z]+)/.exec(first)?.[1] ?? "";
  if (IMPROVE_FULL.test(verb)) return "improve";
  if (BUILD_FULL.test(verb)) return "build";
  if (IMPROVE_WORD.test(first)) return "improve";
  if (BUILD_WORD.test(first)) return "build";
  return "improve";
}

export const scanSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY']!;
    const sb = createClient(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: ok } = await sb.rpc("admin_login", { p_code: data.code });
    if (!ok) return { error: "Organizer access required" };

    const token = process.env['GITHUB_TOKEN'] ?? "";

    // Resolve target to a GitHub repo
    let repo = parseRepo(data.target);
    let lovableId = parseLovable(data.target);
    if (!repo && lovableId) {
      if (!token) return { error: "Resolving Lovable project links needs the GitHub token (not configured)." };
      const d = (await gh("/search/code", token, { q: `"${lovableId}" in:file`, per_page: "20" })) as { items?: { repository: { full_name: string } }[] } | null;
      repo = d?.items?.[0]?.repository.full_name ?? null;
      if (!repo) {
        await sb.rpc("admin_save_scan", { p_code: data.code, p_id: data.submissionId, p_patch: {
          lovable_project_id: lovableId, scan_verdict: "unresolved",
          scan_note: "No public GitHub repo references this Lovable project — ask the team for their GitHub link.",
        } });
        return { error: null, result: { verdict: "unresolved", note: "No public GitHub repo references this Lovable project — ask the team for their GitHub link.", lovableProjectId: lovableId } };
      }
    }
    if (!repo) return { error: "Could not find a GitHub repo or Lovable project link in that value." };

    const info = (await gh(`/repos/${repo}`, token)) as { default_branch?: string } | null;
    if (!info) {
      await sb.rpc("admin_save_scan", { p_code: data.code, p_id: data.submissionId, p_patch: {
        github_repo: repo, scan_verdict: "error", scan_note: "Repo not found or private (needs access).",
      } });
      return { error: null, result: { verdict: "error", note: "Repo not found or private (needs access).", repo } };
    }

    // File fingerprints
    const tree = (await gh(`/repos/${repo}/git/trees/${info.default_branch}`, token, { recursive: "1" })) as { tree?: { path: string; type: string }[] } | null;
    const paths = (tree?.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
    const signals: string[] = [];
    let score = 0;
    const add = (label: string, pts: number) => { signals.push(label); score += pts; };

    if (paths.some((p) => p.startsWith(".lovable/") || p.includes("/.lovable/"))) add(".lovable/ directory", 3);
    const pkg = shallowest(paths, new Set(["package.json"]));
    if (pkg) {
      const txt = await readFile(repo, pkg, token);
      if (txt.includes("lovable-tagger")) add("package.json: lovable-tagger", 4);
      if (txt.includes("vite_react_shadcn_ts")) add("package.json: name vite_react_shadcn_ts", 2);
    }
    const readme = shallowest(paths, new Set(["readme.md", "readme"]));
    if (readme) {
      const txt = await readFile(repo, readme, token);
      const m = LOVABLE_URL_RE.exec(txt);
      if (m) { add("README: lovable.dev/projects link", 4); lovableId ??= m[1].toLowerCase(); }
      else if (/lovable/i.test(txt)) add("README mentions Lovable", 2);
    }
    const html = shallowest(paths, new Set(["index.html"]));
    if (html && /lovable\.dev|content=["']Lovable|Lovable Generated Project|gpt-?engineer/i.test(await readFile(repo, html, token))) {
      add("index.html: Lovable/GPT-Engineer meta", 3);
    }
    const vite = shallowest(paths, new Set(["vite.config.ts", "vite.config.js", "vite.config.mjs"]));
    if (vite && (await readFile(repo, vite, token)).includes("lovable-tagger")) add("vite.config: lovable-tagger", 3);
    const pset = new Set(paths);
    if (pset.has("supabase/config.toml") && pset.has("src/integrations/supabase/client.ts")) add("Supabase integration scaffold (weak)", 1);
    if (pset.has("components.json") && paths.some((p) => p.startsWith("src/components/ui/"))) add("shadcn/Vite layout (weak)", 1);

    // Commit history (newest 100, merges dropped)
    const raw = ((await gh(`/repos/${repo}/commits`, token, { per_page: "100" })) as GhCommit[] | null) ?? [];
    const commits = raw.filter((c) => (c.parents?.length ?? 1) <= 1).reverse();
    const by: Record<"lovable" | "human", Record<Phase, number>> = {
      lovable: { idea: 0, plan: 0, build: 0, improve: 0 },
      human: { idea: 0, plan: 0, build: 0, improve: 0 },
    };
    commits.forEach((c, i) => by[isLovableCommit(c) ? "lovable" : "human"][classify(c.commit.message ?? "", i)]++);
    const nL = Object.values(by.lovable).reduce((a, b) => a + b, 0);
    const nH = Object.values(by.human).reduce((a, b) => a + b, 0);
    const n = nL + nH;
    if (nL) { score += 4; signals.push(`${nL} Lovable bot commits`); }
    const share = n ? Math.round((1000 * nL) / n) / 10 : null;

    const verdict = nL
      ? (share! >= 70 ? "Lovable-built" : share! >= 30 ? "Lovable-assisted" : "Lovable-touched")
      : score >= 3 ? "Lovable-origin (files only; history copied/squashed)"
      : "No evidence";
    const confidence = score >= 6 ? "high" : score >= 3 ? "medium" : score >= 1 ? "low" : "none";
    const phaseMix = Object.fromEntries(PHASES.map((p) => [p, nL ? Math.round((1000 * by.lovable[p]) / nL) / 10 : null]));

    const patch = {
      github_repo: repo,
      lovable_project_id: lovableId ?? "",
      scan_verdict: verdict,
      scan_confidence: confidence,
      lovable_commit_share: share,
      phase_breakdown: phaseMix,
      scan_signals: signals,
      scan_note: "",
    };
    await sb.rpc("admin_save_scan", { p_code: data.code, p_id: data.submissionId, p_patch: patch });

    return {
      error: null,
      result: {
        repo, repoUrl: `https://github.com/${repo}`, lovableProjectId: lovableId ?? "",
        verdict, confidence, commits: n, lovableCommits: nL, commitShare: share,
        phaseMix, signals,
      },
    };
  });
