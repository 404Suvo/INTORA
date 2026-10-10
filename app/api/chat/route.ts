import { processConciergeChat } from "@/lib/concierge-server";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "No messages provided." }, { status: 400 });
    }

    const result = await processConciergeChat(messages);
    return Response.json(result);
  } catch (err: any) {
    console.warn("[API Chat Route] Falling back:", err?.message || err);
    return Response.json(
      { error: err?.message || "Internal server error" },
      { status: 503 }
    );
  }
}
