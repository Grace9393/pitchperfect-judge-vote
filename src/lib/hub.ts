import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Track = { id: number; name_en: string; name_zh: string; data_sources: string };
export type Team = {
  id: string; name: string; track_id: number | null; members: string; project_name: string;
  description: string; deck_url: string; table_number: string; built_with_lovable: boolean;
  voter_group: string; sort_order: number; is_demo: boolean;
};
export type Judge = { id: string; name: string; sort_order: number };
export type CriterionKey = "problem" | "impact" | "execution" | "data" | "clarity";
export type Weights = Record<CriterionKey, number>;
export type EventState = {
  phase: string; current_team_id: string | null; scoring_open: boolean; voting_open: boolean;
  scores_revealed: boolean; demo_mode: boolean; timer_started_at: string | null; weights: Weights; version: number;
};
export type ScoreRow = { judge_id: string; team_id: string; locked: boolean } & Record<CriterionKey, number>;
export type Results = {
  can_see: boolean; scores: ScoreRow[]; votes: { team_id: string; count: number }[];
  progress: { judge_id: string; team_id: string }[]; total_votes: number;
};

export const PHASES = [
  { key: "checkin", en: "Check-in", zh: "報到" },
  { key: "hacking", en: "Hacking", zh: "開發中" },
  { key: "deck", en: "Deck submission", zh: "簡報繳交" },
  { key: "pitches", en: "Pitches", zh: "簡報評審" },
  { key: "voting", en: "Voting open", zh: "投票開放" },
  { key: "results", en: "Results", zh: "公布結果" },
] as const;

export const CRITERIA: { key: CriterionKey; en: string; zh: string; descEn: string; descZh: string }[] = [
  { key: "problem", en: "Problem fit", zh: "問題契合度", descEn: "A real problem in the chosen track; the team understands who has it.", descZh: "為所選賽道中的真實問題，團隊了解誰面臨此問題。" },
  { key: "impact", en: "Impact potential", zh: "影響潛力", descEn: "Who benefits if this shipped, and a plausible path beyond today.", descZh: "若上線誰會受益，以及今天之後的可行發展路徑。" },
  { key: "execution", en: "Prototype execution", zh: "原型完成度", descEn: "Does something actually work, judged against about three hours of build time.", descZh: "以約三小時開發時間衡量，是否真的能運作。" },
  { key: "data", en: "Use of open data", zh: "開放資料運用", descEn: "A real Taiwan dataset, not mock data.", descZh: "使用真實的台灣資料集，而非假資料。" },
  { key: "clarity", en: "Clarity of pitch", zh: "簡報清晰度", descEn: "Problem, solution, and value landed in 90 seconds.", descZh: "90 秒內清楚傳達問題、解法與價值。" },
];

export function normalizeWeights(w: Weights): Weights {
  const total = CRITERIA.reduce((s, c) => s + (Number(w[c.key]) || 0), 0) || 1;
  return Object.fromEntries(CRITERIA.map((c) => [c.key, (Number(w[c.key]) || 0) / total])) as Weights;
}

/** Weighted 1–10 score scaled to 0–100 */
export function weightedScore(s: Record<CriterionKey, number>, w: Weights) {
  const n = normalizeWeights(w);
  return CRITERIA.reduce((sum, c) => sum + n[c.key] * s[c.key], 0) * 10;
}

export type Ranked = {
  team: Team; judgeScore: number; judgeCount: number; votes: number; audienceScore: number;
  combined: number; avgImpact: number; rank: number;
};

export function computeLeaderboard(teams: Team[], results: Results | undefined, weights: Weights): Ranked[] {
  const scores = (results?.scores ?? []).filter((s) => s.locked);
  const voteMap = new Map((results?.votes ?? []).map((v) => [v.team_id, Number(v.count)]));
  const maxVotes = Math.max(0, ...teams.map((t) => voteMap.get(t.id) ?? 0));
  const rows = teams.map((team) => {
    const ts = scores.filter((s) => s.team_id === team.id);
    const judgeScore = ts.length ? ts.reduce((a, s) => a + weightedScore(s, weights), 0) / ts.length : 0;
    const avgImpact = ts.length ? ts.reduce((a, s) => a + s.impact, 0) / ts.length : 0;
    const votes = voteMap.get(team.id) ?? 0;
    const audienceScore = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
    return { team, judgeScore, judgeCount: ts.length, votes, audienceScore, combined: 0.7 * judgeScore + 0.3 * audienceScore, avgImpact, rank: 0 };
  });
  rows.sort((a, b) => b.combined - a.combined || b.avgImpact - a.avgImpact || b.votes - a.votes);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function trackName(t: Track | undefined, lang: "en" | "zh") {
  return t ? (lang === "zh" ? t.name_zh : t.name_en) : "—";
}

export function useHubData(adminCode?: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("event-state")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_state" }, () => {
        qc.invalidateQueries({ queryKey: ["hub"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const tracks = useQuery({
    queryKey: ["hub", "tracks"],
    queryFn: async () => ((await supabase.from("tracks").select("*").order("id")).data ?? []) as Track[],
  });
  const teams = useQuery({
    queryKey: ["hub", "teams"],
    queryFn: async () => ((await supabase.from("teams").select("*").order("sort_order")).data ?? []) as Team[],
  });
  const judges = useQuery({
    queryKey: ["hub", "judges"],
    queryFn: async () => ((await supabase.from("judges").select("id,name,sort_order").order("sort_order")).data ?? []) as Judge[],
  });
  const state = useQuery({
    queryKey: ["hub", "state"],
    queryFn: async () => (await supabase.from("event_state").select("*").eq("id", 1).single()).data as unknown as EventState,
  });
  const results = useQuery({
    queryKey: ["hub", "results", adminCode ?? ""],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_results", { p_code: adminCode ?? undefined });
      if (error) throw error;
      return data as unknown as Results;
    },
    refetchInterval: 10000,
  });
  return {
    tracks: tracks.data ?? [], teams: teams.data ?? [], judges: judges.data ?? [],
    state: state.data, results: results.data, loading: state.isLoading || teams.isLoading,
  };
}

/** Access code persisted in the browser. The database validates it on every call. */
export function useStoredCode(key: string) {
  const [code, setCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setCode(localStorage.getItem(key));
    setReady(true);
  }, [key]);
  const save = (c: string | null) => {
    if (c) localStorage.setItem(key, c);
    else localStorage.removeItem(key);
    setCode(c);
  };
  return [code, save, ready] as const;
}

export function errMsg(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Something went wrong";
}
