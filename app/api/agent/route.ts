import { MODEL, runAgent } from "@/agent/agent";
import { tools } from "@/agent/tools";
import { processConciergeChat } from "@/lib/concierge-server";

// GET /api/agent -> setup status + the list of tools (shown on the page)
export async function GET() {
  return Response.json({
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || MODEL,
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
  });
}

// POST /api/agent { messages, mode? } -> the agent's answer + the tools it used
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Add GEMINI_API_KEY to your .env file, then restart `npm run dev`." }, { status: 500 });
  }

  const body = await req.json();
  const { messages, mode } = body;

  if (mode === "concierge") {
    try {
      const result = await processConciergeChat(messages);
      return Response.json(result);
    } catch (err: any) {
      return Response.json({ error: err?.message || String(err) }, { status: 503 });
    }
  }

  try {
    const result = await runAgent(messages, { baseUrl: new URL(req.url).origin });
    return Response.json(result);
  } catch (err: any) {
    let message = err instanceof Error ? err.message : String(err);
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // not JSON string
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
