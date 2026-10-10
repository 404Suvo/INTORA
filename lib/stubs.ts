/**
 * Intent-to-Commerce AI Agent — Integration Stubs
 * 
 * These stub functions are clearly marked insertion points for:
 * 1. Google Gemini 2.5 API (Natural Language Reasoning & Catalog Optimization)
 * 2. Deterministic Keccak-256 Hashing (Viem / Web3 canonical hash)
 * 3. MetaMask Ethereum Provider (Base Sepolia Testnet 84532)
 * 4. ShoppingIntentRegistry Smart Contract (On-Chain Commitments)
 *
 * Current implementation uses simulated local delays and realistic mock data
 * so the frontend is 100% testable without live API keys or funded test wallets.
 */

import { keccak256, stringToHex, encodeFunctionData } from "viem";
import { MOCK_PLANS, PRESET_SITUATIONS, ShoppingPlanData, ProductItem } from "@/data/mockData";
import {
  BASE_SEPOLIA_CHAIN_ID,
  EVIDENCE_SINK_ADDRESS,
  getRegistryContractAddress,
  INTENT_REGISTRY_ADDRESS,
  SHOPPING_INTENT_REGISTRY_ABI,
} from "./contract-config";
import { promptSwitchToBaseSepolia } from "./web3-wallet";

// ============================================================================
// STUB 1: generatePlan()
// ============================================================================
/**
 * Generates an AI-optimized shopping plan from a natural language situation and budget.
 * Grounded in catalog SKUs with exact integer rupee math and knapsack budget cap enforcement.
 *
 * @param prompt Natural language description of the event, trip, or shopping need.
 * @param budget Maximum expenditure ceiling in Indian Rupees (₹).
 * @returns Promise<ShoppingPlanData>
 */
function cleanTitleFromPrompt(prompt: string): string {
  const stripped = prompt
    .replace(/^(i want|i need|need|give me|buy|please give|looking for|plan for|bundle for)\s+/i, "")
    .replace(/(?:rs\.?|₹|inr|budget(?: is| of)?|under|cap)\s*[:=]?\s*[0-9]+(?:,[0-9]+)*/gi, "")
    .trim();
  if (!stripped) return "Curated Shopping Bundle";
  const words = stripped
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `${words.join(" ")} Essentials`;
}

export async function generatePlan(prompt: string, budget: number): Promise<ShoppingPlanData> {
  // Simulate Gemini reasoning latency (300ms - 600ms)
  await new Promise((resolve) => setTimeout(resolve, 400));

  const lower = prompt.toLowerCase().trim();
  const roundedBudget = Math.max(500, Math.round(budget));
  const planId = `intent_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp =
    new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " IST";

  // 1. OUT OF STOCK / OUT OF CATALOG HANDLING
  // A. Discontinued USB Desk Fan
  if (lower.includes("fan") || lower.includes("cooler")) {
    const result: ShoppingPlanData = {
      id: planId,
      title: "Product Stock Status: Portable USB Desk Fan",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: 0,
      remainingAmount: roundedBudget,
      version: 1,
      timestamp,
      items: [],
      outOfStockNotice: {
        itemName: "Portable USB Desk Fan",
        message:
          "We apologize, but the Portable USB Desk Fan is currently out of stock in our verified catalog inventory. Our team is actively restocking this item. Please check back shortly!",
      },
      validation: {
        budgetCompliant: true,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: false,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // B. Items outside catalog scope
  const outOfCatalogItems: Record<string, string> = {
    laptop: "Laptops & Computers",
    shoes: "Footwear & Shoes",
    shoe: "Footwear & Shoes",
    smartphone: "Smartphones & Mobile Devices",
    phone: "Smartphones & Mobile Devices",
    iphone: "Smartphones & Mobile Devices",
    pizza: "Hot Food Delivery",
    burger: "Hot Food Delivery",
    watch: "Smartwatches & Timepieces",
    camera: "DSLR / Action Cameras",
    bike: "Vehicles & Bicycles",
    motorcycle: "Vehicles & Motorcycles",
  };

  for (const [key, label] of Object.entries(outOfCatalogItems)) {
    if (lower.includes(key)) {
      const result: ShoppingPlanData = {
        id: planId,
        title: `Catalog Availability: ${label}`,
        situation: prompt,
        budget: roundedBudget,
        totalAmount: 0,
        remainingAmount: roundedBudget,
        version: 1,
        timestamp,
        items: [],
        outOfStockNotice: {
          itemName: label,
          message: `We apologize, but "${label}" is not currently in stock in our catalog. Intora currently stocks verified stationery, notebooks, electronics, hydration flasks, backpacks, and snacks. Please select from our available catalog categories!`,
        },
        validation: {
          budgetCompliant: true,
          catalogGrounded: true,
          integerPaiseExact: true,
          allInStock: false,
        },
        planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      };
      result.planHash = await hashPlan(result);
      return result;
    }
  }

  // 2. SPECIFIC PRODUCT QUERIES (Show ONLY requested products)
  // A. Notebooks
  if (
    lower.includes("notebook") ||
    lower.includes("notebooks") ||
    lower.includes("notepad") ||
    lower.includes("spiral") ||
    lower.includes("diary") ||
    lower.includes("ruled")
  ) {
    const unitPrice = 199;
    const qty = Math.max(1, Math.min(25, Math.floor(roundedBudget / unitPrice)));
    const total = qty * unitPrice;
    const items: ProductItem[] = [
      {
        id: "prod-notebook-04",
        name: "A5 Dot-Grid Hardbound Spiral Notebook (200 pgs)",
        category: "Stationery",
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: total,
        rationale: "High-grade 200-page dot-grid ruled spiral notebooks for course notes and lecture revision.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)",
        badge: "Essential",
      },
    ];

    const result: ShoppingPlanData = {
      id: planId,
      title: "Notebook & Academic Study Essentials",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: total,
      remainingAmount: roundedBudget - total,
      version: 1,
      timestamp,
      items,
      validation: {
        budgetCompliant: total <= roundedBudget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // B. Pens / Gel Pens
  if (
    lower.includes("pen") ||
    lower.includes("pens") ||
    lower.includes("gel pen") ||
    lower.includes("ballpoint")
  ) {
    const unitPrice = 195;
    const qty = Math.max(1, Math.min(30, Math.floor(roundedBudget / unitPrice)));
    const total = qty * unitPrice;
    const items: ProductItem[] = [
      {
        id: "prod-pen-05",
        name: "Quick-Dry Waterproof Gel Pen Set (Pack of 5)",
        category: "Stationery",
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: total,
        rationale: "Smudge-free 0.5mm smooth black and blue ink pens for long writing and exam sessions.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #BFDBFE 0%, #93C5FD 100%)",
        badge: "Essential",
      },
    ];

    const result: ShoppingPlanData = {
      id: planId,
      title: "Writing Essentials: Waterproof Gel Pens",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: total,
      remainingAmount: roundedBudget - total,
      version: 1,
      timestamp,
      items,
      validation: {
        budgetCompliant: total <= roundedBudget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // C. Water Bottle / Flask / Hydration
  if (
    lower.includes("bottle") ||
    lower.includes("flask") ||
    lower.includes("water bottle") ||
    lower.includes("sipper")
  ) {
    const unitPrice = 599;
    const qty = Math.max(1, Math.min(10, Math.floor(roundedBudget / unitPrice)));
    const total = qty * unitPrice;
    const items: ProductItem[] = [
      {
        id: "prod-bottle-01",
        name: "Double-Wall Insulated Steel Flask (750ml)",
        category: "Hydration",
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: total,
        rationale: "Double-walled vacuum insulated flask keeping water ice-cold for 18 hours.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #F9D5CB 0%, #F4A28C 100%)",
        badge: "Essential",
      },
    ];

    const result: ShoppingPlanData = {
      id: planId,
      title: "Double-Wall Insulated Hydration Flask",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: total,
      remainingAmount: roundedBudget - total,
      version: 1,
      timestamp,
      items,
      validation: {
        budgetCompliant: total <= roundedBudget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // D. Power Bank / Charger / Battery
  if (
    lower.includes("power bank") ||
    lower.includes("powerbank") ||
    lower.includes("charger") ||
    lower.includes("battery pack")
  ) {
    const unitPrice = 999;
    const qty = Math.max(1, Math.min(5, Math.floor(roundedBudget / unitPrice)));
    const total = qty * unitPrice;
    const items: ProductItem[] = [
      {
        id: "prod-powerbank-02",
        name: "10,000 mAh Compact Fast-Charging Power Bank",
        category: "Electronics",
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: total,
        rationale: "Ensures smartphone and camera battery last through long campus days and concerts.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E9D8FF 0%, #C4B5FD 100%)",
        badge: "Top Pick",
      },
    ];

    const result: ShoppingPlanData = {
      id: planId,
      title: "10,000mAh Fast-Charging Power Bank",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: total,
      remainingAmount: roundedBudget - total,
      version: 1,
      timestamp,
      items,
      validation: {
        budgetCompliant: total <= roundedBudget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // E. Snacks / Nutrition
  if (
    lower.includes("snack") ||
    lower.includes("snacks") ||
    lower.includes("energy bar") ||
    lower.includes("granola") ||
    lower.includes("trail mix")
  ) {
    const items: ProductItem[] = [];
    let spent = 0;
    const barQty = Math.max(1, Math.min(4, Math.floor(roundedBudget / 685)));
    items.push({
      id: "prod-energy-bars",
      name: "Nutty Granola Energy Bars (Box of 6)",
      category: "Snacks",
      quantity: barQty,
      unitPrice: 300,
      totalPrice: barQty * 300,
      rationale: "Wholesome oats, almonds, and honey snack bars for sustained energy.",
      inStock: true,
      imagePlaceholder: "linear-gradient(135deg, #FED7AA 0%, #F97316 100%)",
      badge: "Energy",
    });
    spent += barQty * 300;

    if (roundedBudget - spent >= 385) {
      const mixQty = Math.max(1, Math.floor((roundedBudget - spent) / 385));
      items.push({
        id: "prod-trailmix-06",
        name: "High-Calorie Nut & Dried Fruit Trail Mix (500g)",
        category: "Snacks",
        quantity: mixQty,
        unitPrice: 385,
        totalPrice: mixQty * 385,
        rationale: "Wholesome cashews, almonds, cranberries, and pumpkin seeds.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
      });
      spent += mixQty * 385;
    }

    const result: ShoppingPlanData = {
      id: planId,
      title: "Trail Snacks & Sustained Energy Pack",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: spent,
      remainingAmount: roundedBudget - spent,
      version: 1,
      timestamp,
      items,
      validation: {
        budgetCompliant: spent <= roundedBudget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // F. Backpack / Bag
  if (
    lower.includes("backpack") ||
    lower.includes("daypack") ||
    lower.includes("campus bag")
  ) {
    const unitPrice = 899;
    const qty = Math.max(1, Math.min(5, Math.floor(roundedBudget / unitPrice)));
    const total = qty * unitPrice;
    const items: ProductItem[] = [
      {
        id: "prod-backpack",
        name: "Water-Resistant Campus Daypack (24L)",
        category: "Supplies",
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: total,
        rationale: "Durable ergonomic backpack with padded laptop sleeve and multiple utility pockets.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #D1FAE5 0%, #10B981 100%)",
        badge: "Essential",
      },
    ];

    const result: ShoppingPlanData = {
      id: planId,
      title: "Water-Resistant Campus Daypack",
      situation: prompt,
      budget: roundedBudget,
      totalAmount: total,
      remainingAmount: roundedBudget - total,
      version: 1,
      timestamp,
      items,
      validation: {
        budgetCompliant: total <= roundedBudget,
        catalogGrounded: true,
        integerPaiseExact: true,
        allInStock: true,
      },
      planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    };
    result.planHash = await hashPlan(result);
    return result;
  }

  // 3. SITUATION & EVENT SCENARIOS
  let basePlan: ShoppingPlanData;
  let dynamicTitle: string;

  if (
    lower.includes("trek") ||
    lower.includes("hike") ||
    lower.includes("mountain") ||
    lower.includes("outdoor") ||
    lower.includes("rajmachi")
  ) {
    basePlan = MOCK_PLANS["trekking-trip"];
    dynamicTitle = "Western Ghats Trail Essentials";
  } else if (
    lower.includes("hostel") ||
    lower.includes("dorm") ||
    lower.includes("room setup") ||
    lower.includes("blanket") ||
    lower.includes("lamp") ||
    lower.includes("roommate")
  ) {
    basePlan = MOCK_PLANS["hostel-setup"] || MOCK_PLANS["college-fest"];
    dynamicTitle = "First-Year Hostel Room Setup";
  } else if (
    lower.includes("diwali") ||
    lower.includes("festive") ||
    lower.includes("gift") ||
    lower.includes("hamper") ||
    lower.includes("candle") ||
    lower.includes("diya")
  ) {
    basePlan = MOCK_PLANS["diwali-gifting"] || MOCK_PLANS["college-fest"];
    dynamicTitle = "Festive Family & Neighbor Gifting Hamper";
  } else if (
    lower.includes("fresher") ||
    lower.includes("orientation") ||
    lower.includes("freshers")
  ) {
    basePlan = MOCK_PLANS["freshers-week"] || MOCK_PLANS["college-fest"];
    dynamicTitle = "Freshers' Orientation Week Essentials";
  } else if (
    lower.includes("fest") ||
    lower.includes("festival") ||
    lower.includes("kolkata") ||
    lower.includes("cultural") ||
    lower.includes("concert")
  ) {
    basePlan = MOCK_PLANS["college-fest"];
    dynamicTitle = "Kolkata Campus Fest Essentials";
  } else {
    // Dynamic Custom Prompt Title based on user's exact input!
    basePlan = MOCK_PLANS["college-fest"];
    dynamicTitle = cleanTitleFromPrompt(prompt);
  }

  // 4. Knapsack scaling for situation scenarios
  const baseBudget = basePlan.budget || 3000;
  const budgetRatio = roundedBudget / baseBudget;

  let candidateItems: ProductItem[] = basePlan.items.map((item, idx) => {
    let qty = item.quantity;
    if (budgetRatio > 1.6 && (item.badge === "Essential" || idx % 2 === 0)) {
      qty = Math.min(4, qty + 1);
    } else if (budgetRatio < 0.65 && !item.badge) {
      qty = Math.max(1, Math.floor(qty * 0.8));
    }
    return {
      ...item,
      quantity: qty,
      totalPrice: item.unitPrice * qty,
    };
  });

  let currentTotal = candidateItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

  if (currentTotal > roundedBudget) {
    for (let i = candidateItems.length - 1; i >= 0 && currentTotal > roundedBudget; i--) {
      const item = candidateItems[i];
      if (item.quantity > 1) {
        const canReduce = Math.min(
          item.quantity - 1,
          Math.ceil((currentTotal - roundedBudget) / item.unitPrice)
        );
        item.quantity -= canReduce;
        item.totalPrice = item.unitPrice * item.quantity;
        currentTotal = candidateItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
      }
    }

    if (currentTotal > roundedBudget) {
      candidateItems = candidateItems.filter((item) => {
        if (currentTotal <= roundedBudget) return true;
        if (item.badge === "Essential") return true;
        currentTotal -= item.totalPrice;
        return false;
      });
      currentTotal = candidateItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    }
  }

  if (candidateItems.length === 0 && basePlan.items.length > 0) {
    const single = { ...basePlan.items[0], quantity: 1, totalPrice: basePlan.items[0].unitPrice };
    candidateItems = [single];
    currentTotal = single.totalPrice;
  }

  const remaining = Math.max(0, roundedBudget - currentTotal);

  const resultPlan: ShoppingPlanData = {
    ...basePlan,
    id: planId,
    title: dynamicTitle,
    situation: prompt,
    budget: roundedBudget,
    totalAmount: currentTotal,
    remainingAmount: remaining,
    version: 1,
    timestamp,
    items: candidateItems,
    validation: {
      budgetCompliant: currentTotal <= roundedBudget,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    planHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  };

  resultPlan.planHash = await hashPlan(resultPlan);
  return resultPlan;
}

// ============================================================================
// STUB 2: hashPlan()
// ============================================================================
/**
 * Computes a deterministic cryptographic Keccak-256 hash of the canonical shopping plan.
 * Keys and items are strictly sorted; amounts are integer exact.
 *
 * @param plan The approved shopping plan data.
 * @returns Promise<string> 32-byte hexadecimal string prefixed with 0x.
 */
export async function hashPlan(plan: ShoppingPlanData): Promise<string> {
  const sortedItems = [...plan.items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

  const canonicalObj = {
    budget: Math.round(plan.budget),
    id: plan.id.toLowerCase(),
    items: sortedItems,
    total: Math.round(plan.totalAmount),
    version: plan.version || 1,
  };

  const canonicalJson = JSON.stringify(canonicalObj);
  return keccak256(stringToHex(canonicalJson));
}


// ============================================================================
// STUB 3: connectWallet()
// ============================================================================
/**
 * Connects the user's MetaMask Web3 wallet and ensures it is on Base Sepolia Testnet (84532).
 * Falls back gracefully to simulated sandbox wallet if MetaMask extension is not present.
 *
 * @returns Promise<{ address: string; chainId: number }>
 */
export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    try {
      const eth = (window as any).ethereum;
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts selected in MetaMask.");
      }

      // Explicitly pop up MetaMask to switch/add Base Sepolia Testnet (0x14a34 = 84532)
      await promptSwitchToBaseSepolia();

      const currentChainHex = (await eth.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(currentChainHex, 16);

      return {
        address: accounts[0],
        chainId: chainId || BASE_SEPOLIA_CHAIN_ID,
      };
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        throw new Error("MetaMask connection request was canceled by user.");
      }
      throw err;
    }
  }

  // Simulated Web3 Wallet connection for browser environments without MetaMask
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    address: "0x71C8241b80c5D91839aB026a100518Fa6D1839aB",
    chainId: BASE_SEPOLIA_CHAIN_ID,
  };
}

// ============================================================================
// STUB 4: recordPlanOnChain()
// ============================================================================
/**
 * Records the approved shopping plan hash onto the Base Sepolia Testnet blockchain.
 * Triggers live MetaMask approval on Base Sepolia Testnet; falls back to sandbox commitment.
 *
 * @param planHash 32-byte cryptographic plan hash.
 * @param version Integer version of the plan (1, 2, 3...).
 * @param plan Optional full plan data to construct calldata.
 * @param options Optional fallback flag for sandbox environments.
 * @returns Promise<{ txHash: string; blockNumber: number; account?: string }>
 */
export async function recordPlanOnChain(
  planHash: string,
  version: number,
  plan?: ShoppingPlanData | null,
  options?: { sandboxFallback?: boolean }
): Promise<{ txHash: string; blockNumber: number; account?: string }> {
  // If window.ethereum is available, trigger real MetaMask popups on Base Sepolia Testnet
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const eth = (window as any).ethereum;

    // STEP 1: Pop up MetaMask to request account permission
    let accounts: string[] = [];
    try {
      accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    } catch (reqErr: any) {
      if (reqErr.code === 4001 || reqErr.message?.includes("rejected") || reqErr.message?.includes("denied")) {
        throw new Error("MetaMask permission was denied. You rejected the wallet connection request.");
      }
      throw new Error(`MetaMask connection error: ${reqErr.message || reqErr}`);
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts authorized in MetaMask. Please grant permission in MetaMask.");
    }
    const userAccount = accounts[0];

    // STEP 2: ENSURE METAMASK IS ON TESTNET (Base Sepolia Testnet: 84532 / 0x14a34)
    // Explicitly pops up MetaMask to switch or add Base Sepolia Testnet
    try {
      await promptSwitchToBaseSepolia();
    } catch (switchErr: any) {
      if (switchErr.code === 4001 || switchErr.message?.includes("rejected")) {
        throw new Error("Network switch rejected in MetaMask. Base Sepolia Testnet (84532) is required to record commitments.");
      }
      throw new Error(`Failed to switch to Base Sepolia Testnet: ${switchErr.message || switchErr}`);
    }

    // Verify current chain is Base Sepolia Testnet
    const currentChainHex = (await eth.request({ method: "eth_chainId" })) as string;
    if (parseInt(currentChainHex, 16) !== BASE_SEPOLIA_CHAIN_ID) {
      throw new Error("MetaMask must be on Base Sepolia Testnet (Chain ID 84532) to record commitments on-chain.");
    }

    // STEP 3: Encode calldata for ShoppingIntentRegistry contract
    const intentIdBytes32 =
      plan?.id?.startsWith("0x") && plan.id.length === 66
        ? (plan.id as `0x${string}`)
        : keccak256(stringToHex(plan?.id || `intent_${Date.now()}`));

    const planHashBytes32 = (
      planHash.startsWith("0x") && planHash.length === 66
        ? planHash
        : keccak256(stringToHex(planHash))
    ) as `0x${string}`;

    const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30); // 30 days valid

    const functionName = version === 1 ? "recordIntent" : "recordVersion";
    const calldata = encodeFunctionData({
      abi: SHOPPING_INTENT_REGISTRY_ABI,
      functionName,
      args: [intentIdBytes32, planHashBytes32, version, expiry],
    });

    // STEP 4: Pop up MetaMask to take explicit user permission before recording transaction on-chain
    // Handle MetaMask internal account restriction:
    // If target address is an internal account in MetaMask (e.g. self-wallet or same keyring),
    // MetaMask rejects calldata with: "External transactions to internal accounts cannot include data".
    // We resolve the target address safely (routing to EVIDENCE_SINK_ADDRESS if matching userAccount)
    // and automatically retry targeting EVIDENCE_SINK_ADDRESS if MetaMask reports an internal account error.
    let targetAddress = getRegistryContractAddress(userAccount);

    let txHash: string;
    try {
      txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: targetAddress,
            from: userAccount,
            data: calldata,
          },
        ],
      })) as string;
    } catch (txErr: any) {
      if (txErr.code === 4001 || txErr.message?.includes("rejected") || txErr.message?.includes("denied")) {
        throw new Error("Transaction was rejected by user in MetaMask. No record was made on-chain.");
      }

      const errLower = (txErr.message || "").toLowerCase();
      // If MetaMask blocks sending calldata to an internal account in its keyring, route to the canonical zero-value evidence sink
      if (
        errLower.includes("internal account") ||
        errLower.includes("cannot include data") ||
        errLower.includes("to internal accounts")
      ) {
        try {
          txHash = (await eth.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: EVIDENCE_SINK_ADDRESS,
                from: userAccount,
                data: calldata,
              },
            ],
          })) as string;
        } catch (retryErr: any) {
          if (retryErr.code === 4001 || retryErr.message?.includes("rejected") || retryErr.message?.includes("denied")) {
            throw new Error("Transaction was rejected by user in MetaMask. No record was made on-chain.");
          }
          throw new Error(retryErr.message || "Failed to commit evidence hash to Base Sepolia.");
        }
      } else {
        throw new Error(
          txErr.message || "Failed to execute transaction in MetaMask. Please check your Base Sepolia balance."
        );
      }
    }

    if (!txHash) {
      throw new Error("No transaction hash returned from MetaMask.");
    }

    let blockNumber = 18421904 + version * 7;
    try {
      const blockHex = (await eth.request({ method: "eth_blockNumber" })) as string;
      if (blockHex) blockNumber = parseInt(blockHex, 16);
    } catch (_) {}

    // Persist to local session history so it immediately surfaces in /history
    saveCommittedPlanLocally(plan, planHash, txHash, blockNumber, version);

    return {
      txHash,
      blockNumber,
      account: userAccount,
    };
  }

  // Fallback for environments where MetaMask is not installed and sandbox is explicitly requested
  if (options?.sandboxFallback) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const simulatedBlock = 18421904 + version * 7;
    const simulatedTx = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;

    saveCommittedPlanLocally(plan, planHash, simulatedTx, simulatedBlock, version);

    return {
      txHash: simulatedTx,
      blockNumber: simulatedBlock,
      account: "0x71C8241b80c5D91839aB026a100518Fa6D1839aB",
    };
  }

  throw new Error("MetaMask is not detected. Please install the MetaMask browser extension to approve and record plans on Base Sepolia.");
}

/**
 * Explicit sandbox simulation for environments without MetaMask
 */
export async function recordPlanSandbox(
  planHash: string,
  version: number,
  plan?: ShoppingPlanData | null
): Promise<{ txHash: string; blockNumber: number; account: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const simulatedBlock = 18421904 + version * 7;
  const simulatedTx = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")}`;

  saveCommittedPlanLocally(plan, planHash, simulatedTx, simulatedBlock, version);

  return {
    txHash: simulatedTx,
    blockNumber: simulatedBlock,
    account: "0x71C8241b80c5D91839aB026a100518Fa6D1839aB",
  };
}

/**
 * Saves committed transaction record to localStorage so it appears in /history
 */
function saveCommittedPlanLocally(
  plan: ShoppingPlanData | null | undefined,
  planHash: string,
  txHash: string,
  blockNumber: number,
  version: number
) {
  if (typeof window === "undefined") return;
  try {
    const existingRaw = localStorage.getItem("intora_committed_plans");
    const existing = existingRaw ? JSON.parse(existingRaw) : [];

    const newRecord = {
      version,
      timestamp:
        new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " IST",
      situation: plan?.situation || plan?.title || "Shopping Intent Commitment",
      budget: plan?.budget || 3000,
      total: plan?.totalAmount || 2890,
      itemCount: plan?.items?.length || 6,
      planHash,
      txHash,
      blockNumber,
      gasFee: "0.000042 ETH (₹11.20)",
      notes: `User-approved commitment v${version} committed on Base Sepolia.`,
    };

    localStorage.setItem(
      "intora_committed_plans",
      JSON.stringify([newRecord, ...existing.filter((r: any) => r.txHash !== txHash)])
    );
  } catch (err) {
    // Ignore storage quota errors
  }
}

