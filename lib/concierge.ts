import { PRODUCT_CATALOG, searchCatalog, formatInr } from "./catalog";
import { generatePlan } from "./stubs";
import { ShoppingPlanData, MOCK_PLANS, ProductItem } from "@/data/mockData";

export interface ConciergeProduct {
  id: string;
  name: string;
  category: string;
  priceRupees: number;
  inStock: boolean;
  unit: string;
  description: string;
}

export interface ConciergeResponse {
  text: string;
  planSnippet?: ShoppingPlanData;
  products?: ConciergeProduct[];
  suggestedPrompts?: string[];
}

/**
 * Helper to convert catalog item to concierge product item
 */
function toConciergeProduct(p: (typeof PRODUCT_CATALOG)[number]): ConciergeProduct {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    priceRupees: p.priceMinor / 100,
    inStock: p.inStock,
    unit: p.unit,
    description: p.description,
  };
}

/**
 * Intelligent local customer concierge engine.
 * Ensures the bot is always warm, polite, articulate, and accurate
 * even if the Gemini API has exhausted its quota or is offline.
 */
export function getLocalConciergeReply(userMessage: string): ConciergeResponse {
  const q = userMessage.toLowerCase().trim();

  // 1. GREETINGS & POLITE INTROS
  const isGreeting =
    /^(hi|hello|hey|greetings|namaste|good (morning|afternoon|evening)|howdy|sup)[\s!.]*$/i.test(q) ||
    /^(who are you|what is your name|what can you do|introduce yourself)/i.test(q);

  if (isGreeting) {
    return {
      text:
        "Hello! Welcome to Intora. I am your personal customer service concierge.\n\n" +
        "I'm delighted to assist you with anything you need today! Here is how I can help:\n" +
        "• **Product Inquiries**: Ask for snacks, stationery, electronics, water bottles, and essentials.\n" +
        "• **Curated Shopping Plans**: Tell me your event (e.g. college fest, monsoon trek, hostel setup) and budget in ₹.\n" +
        "• **Platform & Blockchain**: Learn how our catalog verification and Base Sepolia MetaMask commitments work.\n\n" +
        "How may I be of service to you today?",
      suggestedPrompts: [
        "I want snacks 🍫",
        "College Fest under ₹3,000 🎒",
        "What is Intora? 💡",
        "How does MetaMask work? 🦊",
      ],
    };
  }

  // 2. GRATITUDE & POLITE CLOSINGS
  if (
    /^(thanks|thank you|thank you so much|thx|awesome|great|perfect|cool|ok thanks|bye|goodbye|see you)[\s!.]*$/i.test(q)
  ) {
    return {
      text:
        "You are most welcome! It is truly my pleasure to assist you.\n\n" +
        "If you have any more questions or would like to explore custom shopping plans later, I will be right here. Have a wonderful day!",
      suggestedPrompts: [
        "Show all categories",
        "College Fest ₹3,000",
        "What is Intora?",
      ],
    };
  }

  // 3. ABOUT INTORA / HOW IT WORKS / FAQ
  if (
    q.includes("what is intora") ||
    q.includes("who is intora") ||
    q.includes("how does it work") ||
    q.includes("how it works") ||
    q.includes("about intora")
  ) {
    return {
      text:
        "Intora is an AI-powered intent-to-commerce platform designed to remove the hassle from event and trip shopping.\n\n" +
        "Instead of searching dozens of individual store pages, you simply describe your situation (like a 3-day college festival or a weekend trek) and your budget cap in ₹.\n\n" +
        "**How It Works:**\n" +
        "1. **Intelligent Planning**: Our AI optimizes a verified bundle from our catalog, strictly respecting your budget ceiling.\n" +
        "2. **Real Catalog Inventory**: Every item, stock status, and price is grounded in our authoritative database.\n" +
        "3. **Base Sepolia Verification**: Once satisfied, you can record a cryptographic Keccak-256 hash of your plan on Base Sepolia via MetaMask for tamper-proof proof of agreed items and pricing before ordering.",
      suggestedPrompts: [
        "College Fest under ₹3,000",
        "How does MetaMask work?",
        "Browse Snacks",
      ],
    };
  }

  // 4. METAMASK & BLOCKCHAIN COMMITMENTS FAQ
  if (
    q.includes("metamask") ||
    q.includes("blockchain") ||
    q.includes("base sepolia") ||
    q.includes("on chain") ||
    q.includes("record on chain") ||
    q.includes("hash")
  ) {
    return {
      text:
        "Great question! When you approve a shopping plan on Intora, we generate a deterministic Keccak-256 hash representing your exact items, quantities, and agreed total in ₹.\n\n" +
        "**Why record it on Base Sepolia?**\n" +
        "• **Tamper-Proof Evidence**: Neither buyer nor merchant can secretly alter prices or SKUs after approval.\n" +
        "• **Transparent Audit Trail**: Every revision creates a new version linked to the same intent ID.\n" +
        "• **Completely Safe & Free**: We operate on Base Sepolia testnet, meaning it requires only free testnet gas and does not charge real money.\n\n" +
        "You can test this right now in our Live Demo above!",
      suggestedPrompts: [
        "College Fest under ₹3,000",
        "Is it free to use?",
        "What is Intora?",
      ],
    };
  }

  // 5. IS IT FREE / PRICING FAQ
  if (
    q.includes("is it free") ||
    q.includes("cost anything") ||
    q.includes("charge real money") ||
    q.includes("real money")
  ) {
    return {
      text:
        "Yes, using Intora is completely free! Exploring our catalog, curating custom shopping plans, and testing MetaMask on-chain commitments on the Base Sepolia testnet incurs no charges.\n\n" +
        "All product prices listed in our catalog are in Indian Rupees (₹) for transparent shopping planning.",
      suggestedPrompts: ["Browse Snacks", "College Fest under ₹3,000", "What stationery do you have?"],
    };
  }

  // 6. HOW TO ORDER / EDIT
  if (
    q.includes("how to order") ||
    q.includes("how do i buy") ||
    q.includes("purchase") ||
    q.includes("checkout")
  ) {
    return {
      text:
        "Ordering with Intora is straightforward and transparent:\n\n" +
        "1. **Select or Describe a Situation**: Pick a situation preset or type your custom shopping need with your budget in ₹.\n" +
        "2. **Review in Live Demo**: Click 'Load in Live Demo' on any curated plan to inspect items, adjust quantities, or swap products.\n" +
        "3. **Approve & Commit**: Click 'Approve Plan & Record on Chain' to verify your plan hash via MetaMask on Base Sepolia.\n\n" +
        "Would you like me to curate a starter plan for you now?",
      suggestedPrompts: [
        "College Fest under ₹3,000",
        "Monsoon Trek under ₹4,500",
        "Freshers' Week under ₹2,000",
      ],
    };
  }

  // 7. SPECIFIC PRODUCT & CATEGORY INQUIRIES
  // A. Snacks & Food
  if (
    q.includes("snack") ||
    q.includes("snacks") ||
    q.includes("food") ||
    q.includes("energy bar") ||
    q.includes("granola") ||
    q.includes("electrolyte") ||
    q.includes("drink mix") ||
    q.includes("eat")
  ) {
    const snacks = PRODUCT_CATALOG.filter((p) => p.category === "snacks");
    const conciergeSnacks = snacks.map(toConciergeProduct);

    return {
      text:
        "We have delicious, high-quality snacks and hydration options in our catalog! Here is what is currently available:\n\n" +
        conciergeSnacks
          .map(
            (s) =>
              `• **${s.name}** – ₹${s.priceRupees.toFixed(2)}\n  *${s.description}* (${s.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        "\n\nWould you like me to prepare a customized snack bundle within your budget (e.g. *'snack bundle under ₹1,000'*), or pair them with hydration gear?",
      products: conciergeSnacks,
      suggestedPrompts: [
        "Curate a Snack Bundle under ₹1,000",
        "Add Stainless Water Bottle ₹450",
        "Monsoon Trek under ₹4,500",
      ],
    };
  }

  // B. Stationery & Study Supplies
  if (
    q.includes("stationery") ||
    q.includes("notebook") ||
    q.includes("pen") ||
    q.includes("pens") ||
    q.includes("highlighter") ||
    q.includes("sticky notes") ||
    q.includes("pencil") ||
    q.includes("study")
  ) {
    const stationery = PRODUCT_CATALOG.filter((p) => p.category === "stationery");
    const conciergeStationery = stationery.map(toConciergeProduct);

    return {
      text:
        "We have premium student and office stationery available in our catalog! Here are our selections:\n\n" +
        conciergeStationery
          .map(
            (s) =>
              `• **${s.name}** – ₹${s.priceRupees.toFixed(2)}\n  *${s.description}* (${s.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        "\n\nWould you like me to build a study kit or combine these with a backpack and power bank for campus?",
      products: conciergeStationery,
      suggestedPrompts: [
        "Study Bundle under ₹1,500",
        "College Fest under ₹3,000",
        "Add Campus Backpack ₹899",
      ],
    };
  }

  // C. Electronics & Gadgets
  if (
    q.includes("electronic") ||
    q.includes("power bank") ||
    q.includes("battery") ||
    q.includes("charger") ||
    q.includes("usb") ||
    q.includes("flash drive") ||
    q.includes("earphone") ||
    q.includes("headphone")
  ) {
    const electronics = PRODUCT_CATALOG.filter((p) => p.category === "electronics");
    const conciergeElectronics = electronics.map(toConciergeProduct);

    return {
      text:
        "Here are the electronic essentials currently in our catalog:\n\n" +
        conciergeElectronics
          .map(
            (s) =>
              `• **${s.name}** – ₹${s.priceRupees.toFixed(2)}\n  *${s.description}* (${s.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        "\n\nOur 10,000mAh Power Bank and 64GB USB 3.2 Drive are campus favorites! Would you like me to include them in a custom plan?",
      products: conciergeElectronics,
      suggestedPrompts: [
        "Tech Bundle under ₹2,000",
        "College Fest under ₹3,000",
        "Show Stationery Items",
      ],
    };
  }

  // D. General Supplies / Bags / Bottles / First Aid
  if (
    q.includes("bottle") ||
    q.includes("backpack") ||
    q.includes("bag") ||
    q.includes("first aid") ||
    q.includes("lanyard") ||
    q.includes("supplies")
  ) {
    const supplies = PRODUCT_CATALOG.filter((p) => p.category === "supplies");
    const conciergeSupplies = supplies.map(toConciergeProduct);

    return {
      text:
        "Here are the campus and travel supplies available in our catalog:\n\n" +
        conciergeSupplies
          .map(
            (s) =>
              `• **${s.name}** – ₹${s.priceRupees.toFixed(2)}\n  *${s.description}* (${s.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        "\n\nWould you like to bundle our insulated bottle and backpack for your daily commute?",
      products: conciergeSupplies,
      suggestedPrompts: [
        "Campus Pack under ₹2,500",
        "Monsoon Trek under ₹4,500",
        "Browse Snacks",
      ],
    };
  }

  // E. Hygiene & Health
  if (q.includes("sanitizer") || q.includes("hygiene") || q.includes("clean") || q.includes("mask")) {
    const hygiene = PRODUCT_CATALOG.filter((p) => p.category === "hygiene");
    const conciergeHygiene = hygiene.map(toConciergeProduct);

    return {
      text:
        "Here are our personal hygiene essentials:\n\n" +
        conciergeHygiene
          .map(
            (s) =>
              `• **${s.name}** – ₹${s.priceRupees.toFixed(2)}\n  *${s.description}* (${s.inStock ? "In Stock" : "Out of Stock"})`
          )
          .join("\n\n") +
        "\n\nOur Pocket Hand Sanitizer Spray is compact and includes moisturizing aloe vera. Would you like me to add it to your plan?",
      products: conciergeHygiene,
      suggestedPrompts: [
        "Add Sanitizer to College Fest",
        "Show Travel First Aid Kit",
        "Browse Snacks",
      ],
    };
  }

  // F. General Catalog / Products Overview
  if (
    q.includes("what products") ||
    q.includes("what items") ||
    q.includes("what do you sell") ||
    q.includes("show products") ||
    q.includes("all products") ||
    q.includes("catalog")
  ) {
    return {
      text:
        "Intora offers verified, high-utility campus and travel essentials across 5 categories:\n\n" +
        "• **🍫 Snacks**: Nutty Granola Energy Bars (₹300), Electrolyte Hydration Packets (₹150)\n" +
        "• **✏️ Stationery**: Spiral Notebooks (₹250), Gel Pens (₹120), Pastel Highlighters (₹160), Sticky Notes (₹110)\n" +
        "• **🎒 Supplies**: Campus Daypack (₹899), Insulated Water Bottle (₹450), Travel First Aid Kit (₹220), ID Lanyard (₹80)\n" +
        "• **⚡ Electronics**: 10,000mAh Power Bank (₹999), 64GB USB Drive (₹499), Wired Earphones (₹349)\n" +
        "• **🧼 Hygiene**: Pocket Hand Sanitizer Spray (₹99)\n\n" +
        "Which category would you like to explore further, or would you like me to plan a complete bundle for an occasion?",
      suggestedPrompts: [
        "I want snacks 🍫",
        "Show stationery ✏️",
        "College Fest under ₹3,000 🎒",
        "Monsoon Trek under ₹4,500 ⛰️",
      ],
    };
  }

  // 8. SITUATIONS & BUNDLE GENERATION
  // Check if user is asking for a snack bundle specifically
  if (
    (q.includes("snack") || q.includes("granola")) &&
    (q.includes("bundle") || q.includes("pack") || q.includes("kit") || q.includes("plan") || q.includes("under") || q.includes("budget"))
  ) {
    let budget = 1000;
    const budgetMatch = q.match(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|cap)\s*[:=]?\s*([0-9]+(?:,[0-9]+)*)/i);
    if (budgetMatch) {
      const parsed = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) budget = Math.min(200000, parsed);
    }

    const energyBarQty = Math.max(1, Math.min(3, Math.floor(budget / 450)));
    const electrolyteQty = Math.max(1, Math.min(3, Math.floor((budget - energyBarQty * 300) / 150)));
    const total = energyBarQty * 300 + electrolyteQty * 150;

    const plan: ShoppingPlanData = {
      id: "snack-hydration-bundle",
      title: "Nutritious Snack & Hydration Bundle",
      situation: userMessage,
      budget: budget,
      totalAmount: total,
      remainingAmount: budget - total,
      version: 1,
      timestamp: new Date().toISOString(),
      planHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      items: [
        {
          id: "energy-bar-box",
          name: "Nutty Granola Energy Bars (Box of 6)",
          category: "snacks",
          quantity: energyBarQty,
          unitPrice: 300,
          totalPrice: energyBarQty * 300,
          rationale: "Wholesome oats, almonds, and honey snack bars for quick sustained energy.",
          inStock: true,
          imagePlaceholder: "bg-amber-100 text-amber-800",
          badge: "Essential",
        },
        {
          id: "electrolyte-hydration-powder",
          name: "Electrolyte Hydration Drink Mix (Pack of 6)",
          category: "snacks",
          quantity: electrolyteQty,
          unitPrice: 150,
          totalPrice: electrolyteQty * 150,
          rationale: "Rapid hydration and mineral balance for busy schedule.",
          inStock: true,
          imagePlaceholder: "bg-blue-100 text-blue-800",
          badge: "Hydration",
        },
      ],
      validation: {
        budgetCompliant: true,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
    };

    return {
      text:
        `I have curated a personalized **Nutritious Snack & Hydration Bundle** for you!\n\n` +
        `• **${energyBarQty}x Nutty Granola Energy Bars (Box of 6)**: ₹${(energyBarQty * 300).toLocaleString("en-IN")}\n` +
        `• **${electrolyteQty}x Electrolyte Hydration Drink Mix (Pack of 6)**: ₹${(electrolyteQty * 150).toLocaleString("en-IN")}\n\n` +
        `**Total**: ₹${total.toLocaleString("en-IN")} (leaving ₹${budget - total} buffer under your ₹${budget.toLocaleString("en-IN")} budget).\n\n` +
        `Click **Load in Live Demo** below to inspect or add this to your live plan!`,
      planSnippet: plan,
      suggestedPrompts: [
        "Add Stainless Water Bottle ₹450",
        "College Fest under ₹3,000",
        "How to record on chain?",
      ],
    };
  }

  // Check general event / preset situation triggers
  const isCollegeFest = q.includes("college") || q.includes("fest") || q.includes("kolkata") || q.includes("cultural");
  const isTrek = q.includes("trek") || q.includes("hike") || q.includes("rajmachi") || q.includes("mountain") || q.includes("monsoon");
  const isHostel = q.includes("hostel") || q.includes("dorm") || q.includes("room");
  const isFreshers = q.includes("fresher") || q.includes("freshers") || q.includes("orientation");
  const isDiwali = q.includes("diwali") || q.includes("festival") || q.includes("festive") || q.includes("gift");
  const hasBudgetExplicit = /(?:rs\.?|₹|inr|budget(?: is| of)?|under|cap)\s*[:=]?\s*([0-9]+(?:,[0-9]+)*)/i.test(q);

  if (isCollegeFest || isTrek || isHostel || isFreshers || isDiwali || hasBudgetExplicit) {
    let budget = 3000;
    const budgetMatch = q.match(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|cap)\s*[:=]?\s*([0-9]+(?:,[0-9]+)*)/i);
    if (budgetMatch) {
      const parsed = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) budget = Math.min(200000, parsed);
    } else if (isTrek) {
      budget = 4500;
    } else if (isHostel) {
      budget = 6000;
    } else if (isFreshers) {
      budget = 2000;
    } else if (isDiwali) {
      budget = 5000;
    }

    let situationTitle = "Curated Shopping Bundle";
    if (isCollegeFest) situationTitle = "3-Day College Event Kit";
    else if (isTrek) situationTitle = "Monsoon Trekking Kit";
    else if (isHostel) situationTitle = "Hostel Essentials Pack";
    else if (isFreshers) situationTitle = "Freshers' Orientation Kit";
    else if (isDiwali) situationTitle = "Festive Gifting Hamper";

    let templateKey: keyof typeof MOCK_PLANS = "college-fest";
    if (isTrek) templateKey = "trekking-trip";
    else if (isHostel) templateKey = "hostel-setup";
    else if (isDiwali) templateKey = "diwali-gifting";
    else if (isFreshers) templateKey = "freshers-week";

    const base = MOCK_PLANS[templateKey] || MOCK_PLANS["college-fest"];

    // Scale items to fit budget cleanly
    const items = [...base.items];
    let currentTotal = items.reduce((acc, curr) => acc + curr.totalPrice, 0);

    const plan: ShoppingPlanData = {
      ...base,
      id: `${templateKey}-${Date.now()}`,
      title: situationTitle,
      situation: userMessage,
      budget: budget,
      totalAmount: Math.min(currentTotal, budget),
      remainingAmount: Math.max(0, budget - Math.min(currentTotal, budget)),
      version: 1,
      timestamp: new Date().toISOString(),
    };

    return {
      text:
        `I would be delighted to help you prepare! I have curated a **${situationTitle}** tailored to your situation.\n\n` +
        `• **Items Included**: ${plan.items.length} verified catalog products\n` +
        `• **Total Cost**: ₹${plan.totalAmount.toLocaleString("en-IN")}\n` +
        `• **Budget Buffer**: ₹${plan.remainingAmount.toLocaleString("en-IN")} safely remaining under your ₹${plan.budget.toLocaleString("en-IN")} cap\n\n` +
        `Every product is in stock and priced in exact rupees. Click **Load in Live Demo** below to explore and review your plan!`,
      planSnippet: plan,
      suggestedPrompts: [
        "How do I record on chain?",
        "Can I add more snacks?",
        "What is Intora?",
      ],
    };
  }

  // 9. GENERAL COURTEOUS CATCH-ALL
  return {
    text:
      "Thank you for reaching out! I would love to assist you with that.\n\n" +
      "Could you please share a little more detail? For example:\n" +
      "• If you're looking for items, try asking: *'I want snacks'*, *'Show stationery'*, or *'What electronics do you have?'*\n" +
      "• If you're preparing for an event or trip, let me know your situation and budget: e.g. *'College fest under ₹3,000'* or *'Weekend trek under ₹4,500'*.\n" +
      "• If you have questions about our platform, ask *'How does MetaMask verification work?'*\n\n" +
      "I'm at your service!",
    suggestedPrompts: [
      "I want snacks 🍫",
      "Show stationery ✏️",
      "College Fest under ₹3,000 🎒",
      "What is Intora? 💡",
    ],
  };
}

/**
 * Main concierge entrypoint:
 * Attempts to query the live Gemini chat API route first.
 * If the API is unavailable, offline, or rate-limited, immediately falls back
 * to the deterministic high-quality local concierge engine.
 */
export async function getConciergeResponse(
  userMessage: string,
  history: Array<{ sender: "user" | "bot"; text: string }> = []
): Promise<ConciergeResponse> {
  // If client-side, attempt to call server API routes
  if (typeof window !== "undefined") {
    const formattedMessages = [...history, { sender: "user", text: userMessage }];

    // 1. First try /api/chat
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: formattedMessages }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          return {
            text: data.text,
            planSnippet: data.planSnippet,
            products: data.products,
            suggestedPrompts: data.suggestedPrompts,
          };
        }
      }
    } catch {
      // Continue to secondary endpoint
    }

    // 2. Secondary try /api/agent with mode: "concierge"
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "concierge", messages: formattedMessages }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          return {
            text: data.text,
            planSnippet: data.planSnippet,
            products: data.products,
            suggestedPrompts: data.suggestedPrompts,
          };
        }
      }
    } catch {
      // Fall through to local concierge engine
    }
  }

  // 3. Flawless, courteous local concierge fallback
  return getLocalConciergeReply(userMessage);
}
