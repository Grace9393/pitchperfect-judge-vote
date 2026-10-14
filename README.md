# Pitchperfect Judge Vote

Build a web app called "Hack for Humanity Taiwan: Judging Hub" for a 6-hour hackathon on Saturday, October 17, 2026 (12:00–19:00, CollaPlay, Ximen, Taipei). The AI Collective Taipei runs it with Major League Hacking, and Lovable is the official partner. The interface should be in English with a Traditional Chinese toggle. It must work well on phones and tablets, since judges will score from their devices during live pitches.

TRACKS (4)
1. Reversing the Birthrate Decline
2. Tech for a Super-Aged Society
3. Civic Tech & Fighting Misinformation
4. Climate & Disaster Resilience
Each track shows its data sources as reference text on the team page.

ROLES
- Admin (organizers): create and edit teams, assign tracks, control the event phase, open and close scoring and voting, edit scoring weights, view all scores, see the leaderboard, export CSV, and reset data.
- Judges: three seeded judges: Ta-Wei Wang, Jered Odegard, and Antoine Collard. Each logs in with a personal access code. Judges score every team live. They cannot see other judges' scores until the admin reveals them.
- Audience: checked-in attendees each get a personal voter code. Each code can cast 3 votes, with at most 1 vote per team. Voters cannot vote for their own team. Voting opens when the admin starts it at the first pitch and closes when the admin ends it after the last pitch.

TEAM RECORD
Team name, track, members, project name, one-line description, deck link, table number, "built with Lovable" (yes/no, required for Lovable prizes), and the team's voter-code group.

JUDGE SCORING
Each judge scores the current team on five criteria, 1–10 each. Show the description of each criterion on the form.
- Problem fit: 10% (a real problem in the chosen track; the team understands who has it)
- Impact potential: 25% (who benefits if this shipped, and a plausible path beyond today)
- Prototype execution: 25% (does something actually work, judged against about three hours of build time)
- Use of open data: 15% (a real Taiwan dataset, not mock data)
- Clarity of pitch: 10% (problem, solution, and value landed in 90 seconds)
These weights add up to 85%. Normalize them to 100% by dividing each by 85, and show the normalized values. Store the raw weights in admin settings so they can be edited.
Include a 90-second countdown timer on the judge screen. Scores lock on submit, and the admin can reopen them.

FINAL SCORE
- Judge score (70% of total): for each team, average the three judges' normalized weighted scores, scaled to 0–100.
- Audience score (30% of total): the team's votes divided by the highest vote count among all teams, times 100.
- Combined score = 0.7 × judge score + 0.3 × audience score. Show the calculation on the admin dashboard.
- Ties: break by higher average Impact score, then by more audience votes.
- Winners: pick the top three teams across all tracks as 1st, 2nd, and 3rd. Also show a leaderboard per track for information.

PAGES
- Judge screen: current team, timer, scoring form, submit button, and a "waiting for next team" state.
- Audience screen: voter-code entry, team list (own team hidden), vote buttons with a count of votes remaining, and a confirmation screen.
- Admin dashboard: phase control (Check-in, Hacking, Deck submission, Pitches, Voting open, Results), "set current team" control, team management, scoring progress per judge, live leaderboard, weights settings, CSV export, and reset.
- Public results screen: 1st, 2nd, and 3rd place plus per-track results, designed to be projected on a big screen. Updates in realtime.

BACKEND
Use Lovable Cloud for the database, authentication or access codes, and realtime updates. Enforce these rules at the database level: judges can only write their own scores, voters can only cast their allowed votes, and no one can vote twice for the same team. Seed the app with the 3 judges, 4 tracks, and 6 demo teams, plus a demo mode that can be switched off before the event.

Keep the design clean and neutral, with the event's name and dates in the header.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pitchperfect-judge-vote.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/80864cbc-85df-49f3-bc95-db089e3486f9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
