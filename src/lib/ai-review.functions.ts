import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  code: z.string().min(1).max(200),
  projectName: z.string().min(1).max(120),
  description: z.string().max(2000),
  track: z.string().max(200),
  url: z.string().max(500),
});

const INSTRUCTIONS = `You help organizers of "Hack for Humanity Taiwan", a 6-hour civic hackathon, review project submissions.
Tracks: Reversing the Birthrate Decline; Tech for a Super-Aged Society; Civic Tech & Fighting Misinformation; Climate & Disaster Resilience.
Judging criteria: problem fit, impact potential, prototype execution, use of open data, clarity of pitch.
You only see the text provided (you cannot open the URL). Reply in concise English markdown with exactly these sections:
**Summary** (2-3 sentences)
**Track fit** (1-2 sentences)
**Review considerations** (3-5 bullets: things to verify, risks, missing info, open-data use, whether the URL looks like a real deployed project)
Do not invent facts beyond the input.`;

export const summarizeSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ok } = await sb.rpc("admin_login", { p_code: data.code });
    if (!ok) return { error: "Organizer access required", text: "" };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "AI is not configured", text: "" };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    let failure: string | null = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: INSTRUCTIONS,
      messages: [{
        role: "user",
        content: `Project name: ${data.projectName}\nTrack: ${data.track || "(not given)"}\nProject URL: ${data.url || "(not given)"}\nDescription:\n${data.description || "(no description provided)"}`,
      }],
      maxRetries: 0,
      onError: ({ error }) => {
        const e = error as { statusCode?: number; message?: string };
        failure = e.statusCode === 429 ? "AI is busy right now — try again in a minute."
          : e.statusCode === 402 ? "AI credits are used up. Add credits in Settings → Plans & credits."
          : e.message ?? "AI request failed";
      },
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    let text = "";
    try { text = await result.text; } catch (e) { failure ??= (e as Error).message; }
    if (failure || !text.trim()) return { error: failure ?? "The AI returned no summary.", text: "" };
    return { error: null, text };
  });
