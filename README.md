# Intora: AI Shopping Planner on Base Sepolia

**Intora** is an intent-first AI commerce agent that turns natural-language shopping requests into catalog-grounded bundles and records user-approved plans as immutable, versioned cryptographic commitments on **Base Sepolia** (testnet only).

---

## Architecture Overview

```
Natural Language + Budget
         │
         ▼
Gemini Agent with Controlled Tools (Server-Side)
  ├── analyze_situation      (parses situation & integer budget in paise)
  ├── search_products        (authoritative catalog search)
  ├── optimize_bundle        (prioritizes items within budget cap)
  └── prepare_intent         (independent catalog validation & canonical keccak256 hash)
         │
         ▼
App Independent Validation & Recalculation
  ├── Overwrites AI hallucinated prices with catalog truth
  ├── Merges duplicates & sums quantities
  ├── Validates inventory availability & future expiry
  └── Computes deterministic UTF-8 canonical JSON
         │
         ▼
User Reviews & Approves Plan in UI
  ├── Hash recomputed immediately prior to submission
  └── User approves via MetaMask (Agent NEVER signs or submits)
         │
         ▼
ShoppingIntentRegistry.sol (Base Sepolia Testnet)
  ├── recordIntent (Version 1 commitment)
  └── recordVersion (Version 2+ revisions with SAME intentId)
         │
         ▼
On-Chain Verification Panel
  ├── Reads commitment via viem publicClient
  └── Compares onChainHash == recomputedHash (PASS ✅ / FAIL ❌)
```

---

## Plugging Google Gemini 2.5 & MetaMask into Frontend Stubs

The frontend comes with ready-to-test mock data and clearly marked stub functions in `lib/stubs.ts`. Here is how to connect real services:

### 1. `generatePlan(prompt: string, budget: number)` in `lib/stubs.ts`
To connect live Google Gemini 2.5:
```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
// Call gemini-2.5-flash with your system prompt and catalog grounding instructions
```

### 2. `hashPlan(plan: ShoppingPlanData)` in `lib/stubs.ts`
To compute canonical UTF-8 deterministic Keccak-256 hashes:
```typescript
import { keccak256, stringToBytes } from "viem";

const canonicalJson = JSON.stringify(plan, Object.keys(plan).sort());
const planHash = keccak256(stringToBytes(canonicalJson));
```

### 3. `connectWallet()` in `lib/stubs.ts`
To prompt live MetaMask account connection on Base Sepolia (Chain ID `84532`):
```typescript
const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
await window.ethereum.request({
  method: "wallet_switchEthereumChain",
  params: [{ chainId: "0x14a34" }] // 84532
});
```

### 4. `recordPlanOnChain(planHash: string, version: number)` in `lib/stubs.ts`
To write commitment hashes to `ShoppingIntentRegistry.sol`:
```typescript
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(window.ethereum)
});
const txHash = await walletClient.writeContract({
  address: "0x600109033cd5fA5506E1a81177d6C770933C6B9f",
  abi: SHOPPING_INTENT_REGISTRY_ABI,
  functionName: "recordIntent",
  args: [intentId, planHash, version, expiry]
});
```

### Key Routes
- `/`: Editorial landing page with all 10 sections, interactive demo centerpiece, and floating AI chat widget.
- `/planner`: Full-page planning dashboard for custom item adjustments and knapsack recalculations.
- `/history`: On-chain commitment explorer displaying transaction hashes, blocks, and BaseScan links.


---

## Hard Rules Strictly Enforced

1. **Server-Side API Key Only**: `GEMINI_API_KEY` is accessible exclusively on the server (`app/api/agent/route.ts`). Never bundled into client-side code.
2. **User-Approved Transactions**: The AI agent and server never sign or submit transactions. They only prepare calldata; the user approves transactions through MetaMask.
3. **Zero Trust in AI Calculations**: Product IDs, prices, stock availability, and totals come strictly from `lib/catalog.ts`. Any hallucinated prices are flagged and overwritten with catalog values.
4. **Integer Minor Units (Paise for INR)**: No floats anywhere. ₹3,000.00 is stored and calculated as `300000` paise.
5. **No Purchases or Escrow**: Clear disclaimer shown: *"This records a commitment to your approved plan. It does not place an order."*
6. **Testnet Only**: Strict verification of Base Sepolia Chain ID (`84532`) before transactions.
7. **Deployer Private Key Safety**: Deployer keys go only in git-ignored `.env` for throwaway testnet wallets.

---

## Prerequisites

- Node.js 20 or newer (`node -v`)
- MetaMask browser extension
- Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- A throwaway Base Sepolia test wallet

---

## Setup & Environment Configuration

### 1. Clone & Install Dependencies

```bash
git clone <repo_url>
cd my-agent_suvo
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Server-side Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Base Sepolia RPC
BASE_SEPOLIA_RPC=https://sepolia.base.org

# Testnet Deployer Private Key (Throwaway wallet only)
DEPLOYER_PRIVATE_KEY=0x_your_throwaway_private_key_here

# Deployed ShoppingIntentRegistry contract address (updated automatically on deploy)
NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000

# Optional Basescan Verification API Key
BASESCAN_API_KEY=

# Optional Privacy Salting (default: false)
NEXT_PUBLIC_ENABLE_SALT=false
```

---

## How to Fund a Base Sepolia Test Wallet

1. Obtain your testnet wallet address from MetaMask.
2. Switch network in MetaMask to **Base Sepolia** (Chain ID: `84532`).
3. Get free testnet ETH from official faucets:
   - [Chainlink Faucets (Base Sepolia)](https://faucets.chain.link/base-sepolia)
   - [Superchain Faucet](https://console.optimism.io/faucet)
   - [Coinbase Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
4. Confirm your balance appears in MetaMask before deploying or recording commitments.

---

## Smart Contract Deployment

### Deploy Locally (Simulation)
```bash
npm run deploy:local
```

### Deploy to Base Sepolia Testnet
Ensure `DEPLOYER_PRIVATE_KEY` in `.env` has testnet ETH:
```bash
npm run deploy:base-sepolia
```
This writes the deployed address to `contracts/deployed-address.json`, which the frontend and API routes automatically detect.

---

## Running the Automated Test Suite

We provide 4 comprehensive test suites covering all phases and edge cases:

```bash
# Run all 34 test suites (Phases 1, 2, 3, and 6)
npm test

# Run individual test suites
npm run test:phase1     # Validation, catalog grounding, canonicalization, hashing
npm run test:phase2     # 8 controlled Gemini tools, revision handling, calldata
npm run test:contracts  # Hardhat Solidity tests (ShoppingIntentRegistry.sol)
npm run test:phase6     # Application edge cases, hash mismatch detection, integration
```

### Contract Test Coverage Highlights:
- First version recording & owner assignment
- Invalid version numbers rejected (e.g. starting with version 2)
- Sequential versions (`version == latestVersion + 1`)
- Skipped versions rejected (e.g. jumping from 1 to 3)
- Non-owner updates rejected
- Expired timestamps rejected
- Permanent intent cancellation
- Post-cancellation update rejection
- Historical versions preserved and readable
- Zero-value inputs rejected (`bytes32(0)`)

---

## Running the End-to-End Demo Script

Run the automated integration demo script to see the complete flow executed:

```bash
npm run demo
```

### Demo Workflow:
1. **Initial Request**: *"I need supplies for three days of college activities, my budget is Rs 3,000"*
2. **Planning & Grounding**: Extracted budget `300000` paise (₹3,000.00). Selected catalog-verified supplies (Notebooks, Gel Pens, Stainless Bottle, Power Bank, Energy Bars) totaling ₹2,489.00.
3. **Canonical Hashing**: Deterministic key-ordered UTF-8 serialization hashed with `keccak256`.
4. **On-Chain Recording**: Version 1 commitment recorded on Base Sepolia.
5. **Read-Back Verification**: Contract query confirms `onChainHash == canonicalHash` (PASS ✅).
6. **Budget Revision**: *"Budget is now Rs 2,000, keep the essentials"*
7. **Version 2 Creation**: Preserves the **SAME** `intentId`, assigns `version = 2`, and generates a human-readable diff (Power Bank removed to fit under ₹2,000, First Aid Kit added).
8. **Dual-Version Verification**: Version 2 recorded on-chain while Version 1 remains permanently preserved, unchanged, and readable on-chain!

---

## Starting the Web Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

1. **Connect MetaMask**: The wallet banner automatically detects your network. If you are not on Base Sepolia, click "Switch Network".
2. **Enter Situation & Budget**: Use the preset buttons (e.g., College Activities ₹3,000) or type your custom shopping needs.
3. **Review Bundle**: Inspect the catalog-verified items, quantities, and prices.
4. **Approve & Commit**: Check the review consent checkbox and click **Record Commitment in MetaMask**.
5. **Verify**: View real-time cryptographic verification (PASS ✅) and switch between Version 1 and Version 2 history tabs.

---

## Limitations

1. **Not a Purchase or Order**: Recording a commitment on-chain only registers that the user reviewed and approved a specific shopping plan at a given point in time. It does **not** charge cards, execute payments, place orders, reserve inventory, or guarantee seller delivery.
2. **No Authenticity or Inventory Guarantee**: The on-chain hash confirms that the canonical plan has not been altered; it does **not** prove seller reliability, physical product authenticity, or real-time warehouse stock.
3. **Privacy of Guessable Plans**: Plain `keccak256` hashes of plans with few, easily guessable items could potentially be brute-forced or verified by an observer with the catalog. An optional 32-byte off-chain salt (`NEXT_PUBLIC_ENABLE_SALT=true`) can be enabled to mitigate this.
4. **Testnet Prototype & Unaudited**: This codebase is a hackathon/demonstration prototype built for Base Sepolia testnet. The smart contracts are unaudited and must not be used on Ethereum mainnet without a professional security audit.
