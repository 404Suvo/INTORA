import { processConciergeChat, ClientContextPayload } from "@/lib/concierge-server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, context, stream } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "No messages provided. An array of messages is required." },
        { status: 400 }
      );
    }

    // Standard non-streaming JSON response
    if (!stream) {
      const result = await processConciergeChat(messages, context);
      return Response.json(result);
    }

    // Streaming Server-Sent Events (SSE) mode for ChatGPT-like live token emission
    const encoder = new TextEncoder();
    const resultPromise = processConciergeChat(messages, context);

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const result = await resultPromise;
          const fullText = result.text || "";

          // Emit words in smooth natural chunks for immediate interactive responsiveness
          const words = fullText.split(/(\s+)/);
          for (let i = 0; i < words.length; i += 2) {
            const chunk = (words[i] || "") + (words[i + 1] || "");
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`)
            );
            // Brief natural pause (12ms) to mimic smooth token generation
            await new Promise((r) => setTimeout(r, 12));
          }

          // Emit final completed payload
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                text: result.text,
                planSnippet: result.planSnippet,
                products: result.products,
                suggestedPrompts: result.suggestedPrompts,
                toolTraces: result.toolTraces,
              })}\n\n`
            )
          );
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: err?.message || "Error processing chat stream",
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.warn("[API Chat Route] Error:", err?.message || err);
    return Response.json(
      { error: err?.message || "Internal server error" },
      { status: 503 }
    );
  }
}
