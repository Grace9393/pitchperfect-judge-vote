import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const dict = {
  appName: { en: "Hack for Humanity Taiwan", zh: "Hack for Humanity 台灣" },
  hub: { en: "Judging Hub", zh: "評審中心" },
  dateLine: { en: "Sat, Oct 17, 2026 · 12:00–19:00 · CollaPlay, Ximen, Taipei", zh: "2026年10月17日（六）12:00–19:00 · CollaPlay 台北西門" },
  judge: { en: "Judge", zh: "評審" },
  vote: { en: "Vote", zh: "觀眾投票" },
  admin: { en: "Admin", zh: "管理" },
  results: { en: "Results", zh: "結果" },
  guide: { en: "Guide", zh: "指南" },
  home: { en: "Home", zh: "首頁" },
  enterCode: { en: "Enter your access code", zh: "請輸入存取碼" },
  enterVoterCode: { en: "Enter your voter code", zh: "請輸入投票碼" },
  continue: { en: "Continue", zh: "繼續" },
  signOut: { en: "Sign out", zh: "登出" },
  invalidCode: { en: "That code wasn't recognised.", zh: "無法辨識此代碼。" },
  waiting: { en: "Waiting for the next team…", zh: "等待下一組上台…" },
  waitingSub: { en: "The organisers will put the next team on stage shortly.", zh: "主辦單位即將安排下一組。" },
  nowPitching: { en: "Now pitching", zh: "正在簡報" },
  submit: { en: "Submit & lock score", zh: "送出並鎖定分數" },
  submitted: { en: "Score submitted and locked.", zh: "分數已送出並鎖定。" },
  locked: { en: "Locked", zh: "已鎖定" },
  scoringClosed: { en: "Scoring is currently closed.", zh: "目前尚未開放評分。" },
  weightedTotal: { en: "Weighted score", zh: "加權分數" },
  timer: { en: "Pitch timer", zh: "簡報計時" },
  start: { en: "Start", zh: "開始" },
  reset: { en: "Reset", zh: "重設" },
  members: { en: "Members", zh: "成員" },
  table: { en: "Table", zh: "桌號" },
  deck: { en: "Deck", zh: "簡報" },
  submitNav: { en: "Submit", zh: "提交作品" },
  submitTitle: { en: "Submit your project", zh: "提交您的作品" },
  submitSub: { en: "One submission per project. Organisers will review it.", zh: "每個作品提交一次，主辦單位將會審核。" },
  yourName: { en: "Your name", zh: "姓名" },
  email: { en: "Email", zh: "電子郵件" },
  projectName: { en: "Project name", zh: "作品名稱" },
  track: { en: "Track", zh: "賽道" },
  lovableUrl: { en: "Project link (Lovable editor, GitHub, or live site)", zh: "作品連結（Lovable 編輯器、GitHub 或上線網站）" },
  lovableUrlHelp: { en: "Best: your lovable.dev/projects/… link or public GitHub repo. A published .lovable.app or custom-domain site also works.", zh: "建議貼上 lovable.dev/projects/… 連結或公開的 GitHub 儲存庫；已發布的 .lovable.app 或自訂網域網站也可以。" },
  submitBtn: { en: "Submit project", zh: "送出作品" },
  submitThanks: { en: "Thanks — your project was submitted!", zh: "感謝您，作品已成功送出！" },
  submitAnother: { en: "Submit another", zh: "再提交一件" },
  pickTrack: { en: "Please choose a track", zh: "請選擇賽道" },
  submitDesc: { en: "Send in your project and Lovable link.", zh: "提交您的作品與 Lovable 連結。" },
  verified: { en: "verified", zh: "查核於" },
  dataSources: { en: "Track data sources", zh: "賽道資料來源" },
  builtWithLovable: { en: "Built with Lovable", zh: "使用 Lovable 打造" },
  votesLeft: { en: "votes left", zh: "票剩餘" },
  voteFor: { en: "Vote", zh: "投票" },
  voted: { en: "Voted", zh: "已投" },
  votingClosed: { en: "Voting isn't open right now.", zh: "目前未開放投票。" },
  thanks: { en: "Thanks for voting!", zh: "感謝您的投票！" },
  thanksSub: { en: "All three votes have been cast.", zh: "您的三票已全部投出。" },
  voteRecorded: { en: "Vote recorded", zh: "已記錄投票" },
  yourScores: { en: "Your scores", zh: "您的評分" },
  winners: { en: "Winners", zh: "得獎隊伍" },
  perTrack: { en: "By track", zh: "各賽道排名" },
  resultsSoon: { en: "Results will appear here when revealed.", zh: "結果公布後將顯示於此。" },
  judgeScore: { en: "Judges", zh: "評審" },
  audienceScore: { en: "Audience", zh: "觀眾" },
  combined: { en: "Total", zh: "總分" },
  place1: { en: "1st place", zh: "第一名" },
  place2: { en: "2nd place", zh: "第二名" },
  place3: { en: "3rd place", zh: "第三名" },
  pickRole: { en: "Choose your screen", zh: "請選擇您的畫面" },
  judgeDesc: { en: "Score teams live during pitches.", zh: "於簡報時即時評分。" },
  voteDesc: { en: "Cast your 3 audience votes.", zh: "投下您的三張觀眾票。" },
  adminDesc: { en: "Run the event and see all scores.", zh: "管理活動並查看所有分數。" },
  resultsDesc: { en: "Big-screen leaderboard.", zh: "大螢幕排行榜。" },
  partner: { en: "Run by The AI Collective Taipei with Major League Hacking · Official partner: Lovable", zh: "主辦：The AI Collective Taipei × Major League Hacking · 官方合作夥伴：Lovable" },
} as const;

export type DictKey = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => dict[k].en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const s = localStorage.getItem("hfh-lang");
    if (s === "zh" || s === "en") setLangState(s);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("hfh-lang", l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k][lang] }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
