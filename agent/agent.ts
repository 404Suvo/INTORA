/**
 * THE INTENT-TO-COMMERCE AGENT
 *
 * Controlled agent loop:
 *   1. Send chat history + tools to Gemini.
 *   2. Run tool calls requested by Gemini with bounded iterations (MAX_STEPS = 6).
 *   3. Enforce catalog grounding, integer paise calculations, and versioned intent preparation.
 *   4. Return final response with tool execution traces.
 */
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { tools } from "./tools";

export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_STEPS = 6;

const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
];

const SYSTEM_PROMPT = `
You are Intent-to-Commerce, an expert AI shopping planner.
Your mission is to transform a user's natural-language situation and budget into a verified, versioned shopping bundle, ready for MetaMask commitment recording on Base Sepolia.

Rules:
1. Always parse budgets into integer paise (INR). 1 INR = 100 paise. (e.g. Rs 3,000 = 300,000 paise; Rs 2,000 = 200,000 paise).
2. Never invent or hallucinate products or prices. Always search the catalog using 'search_products' or 'optimize_bundle'.
3. Always prepare or revise the intent using 'prepare_intent'.
4. For revisions (e.g., "budget is now Rs 2,000, keep the essentials"), retain the EXACT SAME intentId and call 'prepare_intent' with that intentId so it produces version + 1 and calculates a diff.
5. In your final answer, clearly list:
   - The selected items with quantities and prices in INR.
   - Total cost vs budget.
   - The intent ID, Version, and Plan Hash.
   - A diff if this is a revision.
   - State the notice: "This records a commitment to your approved plan. It does not place an order."
`.trim();

export type ChatMessage = { role: "user" | "agent"; text: string };
export type Step = { tool: string; args: unknown; result: unknown; error?: boolean };

export async function runAgent(history: ChatMessage[], ctx: { baseUrl: string }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents: Content[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
  const steps: Step[] = [];

  const configuredModel = process.env.GEMINI_MODEL || MODEL;
  const modelsToTry = Array.from(new Set([configuredModel, ...CANDIDATE_MODELS]));

  for (let i = 0; i < MAX_STEPS; i++) {
    let response;
    let lastError: unknown;

    for (const currentModel of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parametersJsonSchema: t.parameters,
                })),
              },
            ],
          },
        });
        break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || "");
        const isQuotaOrNotFound =
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("404") ||
          msg.includes("NOT_FOUND") ||
          msg.includes("503");

        if (isQuotaOrNotFound && currentModel !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`[Agent] Gemini model '${currentModel}' unavailable/exhausted. Falling back to alternative model...`);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to receive response from Gemini API.");
    }

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return { answer: response.text ?? "", steps };
    }

    // Keep Gemini's turn in the contents history
    contents.push(response.candidates![0].content!);
    const results: Part[] = [];

    for (const call of calls) {
      const tool = tools.find((t) => t.name === call.name);
      let result: unknown;
      let error = false;
      try {
        if (!tool) throw new Error(`Unknown tool requested: ${call.name}`);
        result = await tool.run(call.args ?? {}, ctx);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
        error = true;
      }
      steps.push({ tool: call.name!, args: call.args, result, error });
      results.push({ functionResponse: { id: call.id, name: call.name, response: { result } } });
    }

    contents.push({ role: "user", parts: results });
  }

  return { answer: "I completed the planning steps within the limit. Review the plan below.", steps };
}
