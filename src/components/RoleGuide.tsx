import { useT } from "@/lib/i18n";
import { CRITERIA, normalizeWeights, useHubData } from "@/lib/hub";

export const guideSteps = {
  admin: {
    en: [
      ["Before the event", "Settings → Events: confirm the name, dates, timezone and venue. Replace access codes and share them privately. Turn off demo mode before real scoring."],
      ["Prepare the teams", "Teams: add each team, project, track, members and deck. Voter codes: generate personal codes and link participants to their own team."],
      ["Review submissions", "Submissions: search or filter entries, open Review, set status and private notes. Generate an AI summary or scan a public repository for Lovable evidence."],
      ["Run the pitches", "Control: choose Pitches, open audience voting at the first pitch, select the current team and start the 90-second timer. Check Scoring progress after each team."],
      ["Finish and announce", "Close scoring and voting after the last pitch. Check Leaderboard and its private preview; confirm Publish to Results page. Export CSV for your records."],
      ["Run another event", "Settings → Events: create a new event, then confirm Make active. Previous teams, submissions, scores and votes are retained separately. Tracks, judge codes and scoring weights are copied; review them before use."],
    ],
    zh: [
      ["活動前", "設定 → 活動：確認名稱、日期、時區與場地。更換存取碼並私下分享；正式評分前關閉示範模式。"],
      ["準備隊伍", "在 Teams 建立隊伍、作品、賽道、成員與簡報。在 Voter codes 產生個人投票碼，並將參賽者連結至自己的隊伍。"],
      ["審核作品", "在 Submissions 搜尋、篩選並開啟 Review，設定狀態與私人備註。可產生 AI 摘要或掃描公開儲存庫以確認 Lovable 使用證據。"],
      ["進行簡報", "在 Control 選擇 Pitches，第一組開始時開放觀眾投票，選擇當前隊伍並啟動 90 秒計時。每組結束後查看 Scoring progress。"],
      ["結束與公布", "最後一組結束後關閉評分及投票。確認 Leaderboard 與私人預覽，再確認 Publish to Results page。匯出 CSV 留存。"],
      ["舉辦下一場", "設定 → 活動：建立新活動，再確認設為使用中。舊隊伍、作品、分數與投票會分開保留；賽道、評審碼與權重會複製，使用前請再次確認。"],
    ],
  },
  judge: {
    en: [
      ["Sign in", "Open Judge and enter your personal code from the organizers. Keep it private."],
      ["Watch the current pitch", "Check the team and track shown on screen. Each pitch has a 90-second timer; wait if no team is on stage."],
      ["Score all five criteria", "Choose 1–10 for each criterion using its description. The displayed weights are normalized to 100%."],
      ["Submit once", "Check your weighted total, then select Submit & lock score. Only an organizer can reopen it. Other judges’ scores remain hidden until results are revealed."],
    ],
    zh: [
      ["登入", "開啟評審頁面，輸入主辦單位提供的個人評審碼，請勿公開。"],
      ["觀看當前簡報", "確認畫面上的隊伍與賽道。每組有 90 秒計時；尚無隊伍上台時請等待。"],
      ["五項評分", "依每項說明選擇 1–10 分；畫面上的權重會正規化至 100%。"],
      ["確認後送出", "確認加權總分，再選擇送出並鎖定分數。只有主辦單位能重新開放；其他評審的分數在公布前保持隱藏。"],
    ],
  },
  team: {
    en: [
      ["Submit your project", "Open Submit. Enter your name, email, project name and track, then paste your Lovable editor link, public GitHub link or live website. Submit once per project."],
      ["Make your work reviewable", "For repository scanning, connect your Lovable project to a public GitHub repository. If a live site cannot be resolved, send the organizers your public repository or editor link; never share a token."],
      ["Prepare your pitch", "Give the organizers your team members, deck and table number. Explain the problem, solution, working prototype, impact and real open-data sources in 90 seconds."],
      ["Vote fairly", "Use your personal voter code on Vote when voting opens. You have three votes, one per team, and cannot vote for your own team. Votes cannot be changed."],
      ["See the outcome", "Open Results once organizers publish the standings. Overall ranking combines 70% judges and 30% audience; ties use average Impact, then votes."],
    ],
    zh: [
      ["提交作品", "開啟提交作品，輸入姓名、電子郵件、作品名稱與賽道，再貼上 Lovable 編輯器、公開 GitHub 或上線網站連結。每個作品提交一次。"],
      ["讓作品可供審核", "如需儲存庫掃描，請將 Lovable 專案連結至公開 GitHub 儲存庫。若上線網址無法解析，請提供公開儲存庫或編輯器連結，切勿分享權杖。"],
      ["準備簡報", "向主辦單位提供成員、簡報與桌號。90 秒內說明問題、解法、可運作原型、影響與真實開放資料來源。"],
      ["公平投票", "開放投票後，在投票頁輸入個人投票碼。每人三票，每隊最多一票，不得投給自己的隊伍；投票後不能更改。"],
      ["查看結果", "主辦單位公布後開啟結果頁。總排名由評審 70% 與觀眾 30% 組成；同分時依平均影響潛力分數，再依票數排序。"],
    ],
  },
} as const;

export function RoleGuide({ role }: { role: keyof typeof guideSteps }) {
  const { lang } = useT();
  return <ol className="space-y-5">
    {guideSteps[role][lang].map(([title, detail], index) => <li key={title} className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
      <div className="min-w-0"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p></div>
    </li>)}
  </ol>;
}

export function ScoringReference() {
  const { lang } = useT();
  const { state } = useHubData();
  if (!state) return null;
  const weights = normalizeWeights(state.weights);
  return <div className="mt-8 border-t pt-6">
    <h2 className="mb-3 text-lg font-semibold">{lang === "zh" ? "目前評分標準" : "Current scoring criteria"}</h2>
    <ul className="space-y-3">{CRITERIA.map((c) => <li key={c.key}>
      <div className="flex justify-between gap-3 text-sm font-medium"><span>{lang === "zh" ? c.zh : c.en}</span><span>{(weights[c.key] * 100).toFixed(1)}%</span></div>
      <p className="text-sm text-muted-foreground">{lang === "zh" ? c.descZh : c.descEn}</p>
    </li>)}</ul>
  </div>;
}