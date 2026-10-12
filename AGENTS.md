<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls live in `src/lib/*.functions.ts` server functions that verify the admin code via `admin_login` before calling the AI Gateway — keeps the API key and prompts server-side.

- Event metadata lives in `events`, and runtime state in `event_runtimes`; active-event scoped views keep existing code-gated database functions isolated without changing their public signatures.
- The admin code is site-wide; new events copy tracks, judge code hashes and weights but never participant or scoring data, so event history remains separate.
- Event timestamps are stored in UTC and edited/displayed using the event IANA timezone through date-fns-tz, avoiding browser-local time drift.
- Public judge/team guidance lives on `/guide`; organizer instructions stay inside the admin code gate.
