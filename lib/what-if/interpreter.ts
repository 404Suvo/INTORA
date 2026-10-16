import { GoogleGenAI } from "@google/genai";
import { isTransientGeminiError } from "@/lib/planner-engine";
import { sanitizeErrorMessage } from "@/lib/scraperapi";
import { ScenarioInterpretationContext, ValidatedScenario } from "./types";
import { validateScenario } from "./validator";

const WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseWordOrDigit(val: string): number | null {
  const clean = val.trim().toLowerCase();
  if (WORD_TO_NUMBER[clean] !== undefined) {
    return WORD_TO_NUMBER[clean];
  }
  const num = parseInt(clean, 10);
  return isNaN(num) ? null : num;
}

/**
 * Deterministically interprets what-if scenario requests without relying on external network/API.
 * Extracts budget, headcount, duration, item removals, additions, and preferences.
 */
export function interpretDeterministicScenario(
  prompt: string,
  context: ScenarioInterpretationContext
): Partial<ValidatedScenario> {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // Ambiguity Checks: user asks to change a parameter but omits the value
  const isBudgetChangeAmbiguous =
    /what if (?:i )?(?:change|modify|adjust|update|decrease|reduce|increase|drop)(?: my| the)? budget\??$/i.test(
      lower
    ) ||
    /what if (?:my )?budget changes\??$/i.test(lower);
  if (isBudgetChangeAmbiguous) {
    return {
      scenarioDescription: cleanPrompt,
      ambiguityQuestion: "Could you specify the target budget in rupees (e.g., ₹2,000)?",
    };
  }

  const isPeopleChangeAmbiguous =
    /what if (?:i )?(?:add|include|bring)(?: more)? (?:people|persons|friends|members)\??$/i.test(
      lower
    ) ||
    /what if (?:more people join|group size increases)\??$/i.test(lower);
  if (isPeopleChangeAmbiguous) {
    return {
      scenarioDescription: cleanPrompt,
      ambiguityQuestion: "Could you specify how many people to include in the plan?",
    };
  }

  const isDurationAmbiguous =
    /what if (?:i )?(?:change|extend|shorten)(?: the)? duration\??$/i.test(lower) ||
    /what if (?:the )?(?:trip|event) duration changes\??$/i.test(lower);
  if (isDurationAmbiguous) {
    return {
      scenarioDescription: cleanPrompt,
      ambiguityQuestion: "Could you specify how many days you need the supplies for?",
    };
  }

  let budget: number | undefined;
  let budgetDelta: number | undefined;
  let peopleCount: number | undefined;
  let peopleDelta: number | undefined;
  let durationDays: number | undefined;
  let durationDelta: number | undefined;
  const removedItems: string[] = [];
  const addedRequirements: string[] = [];
  let targetPreference: "balanced" | "lowest_cost" | "quality" | "features" | undefined;
  let keepEssentials = false;
  let spendLess = false;

  // 1. Budget extraction
  // Matches "budget drops to ₹2,000", "budget is 2000", "reduce budget to 1500", "increase budget to 5000", "budget of ₹2000"
  const budgetTargetMatch = /(?:budget\s+(?:drops|falls|drops down|decreases|reduced?|increases?|goes up)\s+to|budget\s*(?:is|=|of)|set budget to|cap budget at)\s*(?:rs\.?|₹|inr)?\s*([-+]?[0-9]+(?:,[0-9]+)*)/i.exec(
    lower
  );
  if (budgetTargetMatch) {
    const rawNum = parseFloat(budgetTargetMatch[1].replace(/,/g, ""));
    if (!isNaN(rawNum)) {
      budget = rawNum;
    }
  } else {
    // Matches "reduce budget by ₹500", "increase budget by ₹1000", "drop budget by 1000"
    const budgetDeltaMatch = /(?:reduce|decrease|cut|drop|increase|raise)\s+(?:my\s+)?budget\s+by\s+(?:rs\.?|₹|inr)?\s*([-+]?[0-9]+(?:,[0-9]+)*)/i.exec(
      lower
    );
    if (budgetDeltaMatch) {
      const rawDelta = parseFloat(budgetDeltaMatch[1].replace(/,/g, ""));
      if (!isNaN(rawDelta)) {
        const isDecrease = /reduce|decrease|cut|drop/i.test(lower);
        budgetDelta = isDecrease ? -rawDelta : rawDelta;
      }
    } else {
      // General match for "to ₹X" or "under ₹X" when budget is mentioned
      const generalBudgetMatch = /(?:budget|spend|cost).{0,25}?(?:to|under|cap at|below)\s*(?:rs\.?|₹|inr)?\s*([-+]?[0-9]+(?:,[0-9]+)*)/i.exec(
        lower
      );
      if (generalBudgetMatch) {
        const rawNum = parseFloat(generalBudgetMatch[1].replace(/,/g, ""));
        if (!isNaN(rawNum)) {
          budget = rawNum;
        }
      }
    }
  }

  // 2. People / Headcount extraction
  // Matches "include one more person", "add 1 person", "one more person", "add two people", "for 3 people"
  const addMorePeopleMatch = /(?:include|add|need|bring|plus)\s+([a-z0-9]+)\s+(?:more\s+)?(?:person|people|friend|friends|traveler|travelers|member|members)/i.exec(
    lower
  );
  if (addMorePeopleMatch) {
    const count = parseWordOrDigit(addMorePeopleMatch[1]);
    if (count !== null && count > 0) {
      peopleDelta = count;
    }
  } else {
    const absolutePeopleMatch = /(?:for|group of|total of)\s+([a-z0-9]+)\s+(?:people|persons|friends|travelers|members)/i.exec(
      lower
    );
    if (absolutePeopleMatch) {
      const count = parseWordOrDigit(absolutePeopleMatch[1]);
      if (count !== null && count > 0) {
        peopleCount = count;
      }
    } else if (/one more person|1 more person/i.test(lower)) {
      peopleDelta = 1;
    }
  }

  // 3. Duration extraction
  // Matches "for five days instead of three", "5 days instead of 3", "for 5 days", "extend to 7 days"
  const durationInsteadMatch = /(?:for\s+)?([a-z0-9]+)\s+days?\s+instead\s+of\s+([a-z0-9]+)/i.exec(
    lower
  );
  if (durationInsteadMatch) {
    const newDays = parseWordOrDigit(durationInsteadMatch[1]);
    if (newDays !== null && newDays > 0) {
      durationDays = newDays;
    }
  } else {
    const durationTargetMatch = /(?:need this for|for|extend to|duration of)\s+([a-z0-9]+)\s+days?/i.exec(
      lower
    );
    if (durationTargetMatch) {
      const days = parseWordOrDigit(durationTargetMatch[1]);
      if (days !== null && days > 0) {
        durationDays = days;
      }
    } else {
      const durationDeltaMatch = /(?:extend|add|increase)\s+(?:duration\s+by\s+)?([a-z0-9]+)\s+days?/i.exec(
        lower
      );
      if (durationDeltaMatch) {
        const delta = parseWordOrDigit(durationDeltaMatch[1]);
        if (delta !== null && delta > 0) {
          durationDelta = delta;
        }
      }
    }
  }

  // 4. Removed Items
  // Matches "remove the shoes", "remove shoes", "remove the battery", "drop the power bank", "without the flask"
  const removeMatches = lower.matchAll(
    /(?:remove|drop|delete|exclude|without|take out)\s+(?:the\s+)?([a-z0-9\s-]+?)(?:,|\.|\?|!|\band\b|$)/gi
  );
  for (const m of removeMatches) {
    const candidate = m[1]?.replace(/[?!.,;]/g, "").trim();
    if (
      candidate &&
      !["all", "it", "them", "budget", "cost", "more", "person", "people"].includes(candidate)
    ) {
      removedItems.push(candidate);
    }
  }

  // 5. Added Requirements
  // Matches "add rain poncho", "need umbrella", "include mosquito repellent"
  const addMatches = lower.matchAll(
    /(?:add|include|need|require)\s+(?:a\s+|an\s+|some\s+)?([a-z0-9\s-]+?)(?:,|\.|\?|!|\band\b|$)/gi
  );
  for (const m of addMatches) {
    const candidate = m[1]?.replace(/[?!.,;]/g, "").trim();
    if (
      candidate &&
      !candidate.includes("person") &&
      !candidate.includes("people") &&
      !candidate.includes("budget") &&
      !candidate.includes("day") &&
      !candidate.includes("essential") &&
      !candidate.includes("quality") &&
      !["more", "less", "one", "two", "it"].includes(candidate)
    ) {
      addedRequirements.push(candidate);
    }
  }

  // 6. Quality & Preference Changes
  if (/prioritize quality|quality over price|best quality|higher quality|premium/i.test(lower)) {
    targetPreference = "quality";
  } else if (/spend less|lowest cost|cheapest|cost conscious|cheaper alternatives/i.test(lower)) {
    targetPreference = "lowest_cost";
    spendLess = true;
  } else if (/more features|feature rich/i.test(lower)) {
    targetPreference = "features";
  }

  if (/keep (?:all )?(?:the )?essentials|preserve essentials/i.test(lower)) {
    keepEssentials = true;
  }

  return {
    scenarioDescription: cleanPrompt,
    budget,
    budgetDelta,
    peopleCount,
    peopleDelta,
    durationDays,
    durationDelta,
    removedItems,
    addedRequirements,
    targetPreference,
    keepEssentials,
    spendLess,
  };
}

/**
 * Interprets a what-if scenario request using Gemini when available,
 * falling back gracefully to the deterministic NLP parser.
 */
export async function interpretScenarioRequest(
  scenarioPrompt: string,
  context: ScenarioInterpretationContext,
  options: { skipGemini?: boolean; signal?: AbortSignal } = {}
): Promise<ValidatedScenario> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  let parsedRaw: Partial<ValidatedScenario> | null = null;

  if (apiKey && !options.skipGemini) {
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const itemsList = context.currentItems
          .map((i) => `- ${i.name} (qty: ${i.quantity}, ₹${i.unitPrice}, essential: ${i.essential})`)
          .join("\n");

        const promptText = `You are Intora's What-if Scenario Interpreter.
Current plan context:
- Budget: ₹${context.currentBudget}
- Current group size (people): ${context.currentPeopleCount || 1}
- Current duration (days): ${context.currentDurationDays || 3}
- Situation: "${context.currentSituation}"
- Current items:
${itemsList}

User scenario request: "${scenarioPrompt}"

Interpret this scenario.
Rules:
1. ONLY modify properties specified or clearly implied by the request. Preserve all unchanged requirements.
2. If budget changes, output new "budget" or "budgetDelta".
3. If people count changes (e.g. "include one more person", "add 1 person"), output "peopleCount" or "peopleDelta".
4. If duration changes (e.g. "five days instead of three"), output "durationDays" or "durationDelta".
5. If items are removed (e.g. "remove shoes"), list keywords in "removedItems".
6. If new items are requested, list them in "addedRequirements".
7. If quality or cost priorities are stated, set "targetPreference" ("quality" | "lowest_cost" | "features" | "balanced").
8. If user request is ambiguous and a critical value cannot be safely inferred (e.g. "What if I add people?" with no count), set "ambiguityQuestion". Do not guess.

Output ONLY valid JSON with keys:
{
  "budget": number | null,
  "budgetDelta": number | null,
  "peopleCount": number | null,
  "peopleDelta": number | null,
  "durationDays": number | null,
  "durationDelta": number | null,
  "removedItems": string[],
  "addedRequirements": string[],
  "targetPreference": "quality" | "lowest_cost" | "features" | "balanced" | null,
  "keepEssentials": boolean,
  "spendLess": boolean,
  "ambiguityQuestion": string | null
}`;

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          config: { temperature: 0.1 },
        });

        const text = response.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsedRaw = {
            scenarioDescription: scenarioPrompt,
            budget: typeof parsed.budget === "number" ? parsed.budget : undefined,
            budgetDelta: typeof parsed.budgetDelta === "number" ? parsed.budgetDelta : undefined,
            peopleCount: typeof parsed.peopleCount === "number" ? parsed.peopleCount : undefined,
            peopleDelta: typeof parsed.peopleDelta === "number" ? parsed.peopleDelta : undefined,
            durationDays: typeof parsed.durationDays === "number" ? parsed.durationDays : undefined,
            durationDelta: typeof parsed.durationDelta === "number" ? parsed.durationDelta : undefined,
            removedItems: Array.isArray(parsed.removedItems) ? parsed.removedItems : [],
            addedRequirements: Array.isArray(parsed.addedRequirements) ? parsed.addedRequirements : [],
            targetPreference: parsed.targetPreference || undefined,
            keepEssentials: Boolean(parsed.keepEssentials),
            spendLess: Boolean(parsed.spendLess),
            ambiguityQuestion: parsed.ambiguityQuestion || undefined,
          };
          break;
        }
      } catch (err: any) {
        const isTransient = isTransientGeminiError(err);
        if (!isTransient || attempt >= maxAttempts) {
          console.warn(
            `[What-If Interpreter] Gemini extraction fallback (attempt ${attempt}):`,
            sanitizeErrorMessage(err?.message || String(err))
          );
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  // Fallback to deterministic NLP interpreter
  if (!parsedRaw) {
    parsedRaw = interpretDeterministicScenario(scenarioPrompt, context);
  }

  // Validate interpreted scenario against business rules
  const validation = validateScenario(parsedRaw, {
    currentBudget: context.currentBudget,
    currentPeopleCount: context.currentPeopleCount,
    currentDurationDays: context.currentDurationDays,
  });

  const nextVersion = (context.parentVersion || 1) + 1;
  const scenarioId = `scen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    scenarioId,
    parentPlanId: context.parentPlanId,
    parentVersion: context.parentVersion,
    version: nextVersion,
    scenarioDescription: scenarioPrompt,
    budget: validation.sanitizedBudget ?? parsedRaw.budget,
    budgetDelta: parsedRaw.budgetDelta,
    peopleCount: validation.sanitizedPeopleCount ?? parsedRaw.peopleCount,
    peopleDelta: parsedRaw.peopleDelta,
    durationDays: validation.sanitizedDurationDays ?? parsedRaw.durationDays,
    durationDelta: parsedRaw.durationDelta,
    removedItems: parsedRaw.removedItems || [],
    addedRequirements: parsedRaw.addedRequirements || [],
    priorityChanges: parsedRaw.priorityChanges,
    targetPreference: parsedRaw.targetPreference,
    keepEssentials: parsedRaw.keepEssentials,
    spendLess: parsedRaw.spendLess,
    createdAt: new Date().toISOString(),
    ambiguityQuestion: validation.ambiguityQuestion,
    validationErrors: validation.errors,
    isValid: validation.isValid,
  };
}
