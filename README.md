<p align="center">
  <img src="https://raw.githubusercontent.com/404Suvo/INTORA/main/public/intora-logo.png" alt="Intora Logo" width="140" style="border-radius: 24px;" />
</p>

<h1 align="center">INTORA</h1>

<p align="center">
  <strong>Intent-First Autonomous Commerce Agent with Cryptographic On-Chain Commitments</strong>
</p>

<p align="center">
  <a href="https://intora-wgyv.vercel.app/"><img src="https://img.shields.io/badge/Live%20Demo-intora--wgyv.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  <a href="https://sepolia.basescan.org/address/0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f"><img src="https://img.shields.io/badge/Network-Base%20Sepolia%20(84532)-0052FF?style=for-the-badge&logo=coinbase&logoColor=white" alt="Base Sepolia" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16.4.0-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="https://aistudio.google.com/"><img src="https://img.shields.io/badge/AI%20Engine-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" /></a>
</p>

---

## 📌 Project Overview

**Intora** is an intent-first, agentic shopping planner that translates natural-language situations and monetary budgets into verified, catalog-grounded product bundles. When a user approves an AI-curated shopping plan, Intora records it as an **immutable, versioned cryptographic commitment** on **Base Sepolia** (Ethereum Layer 2 testnet).

If the user revises their criteria (e.g., *"Budget is now Rs 2,000, keep essentials"*), Intora generates a sequential **Version 2** linked to the **identical intent ID**, preserving the entire historical record on-chain permanently for cryptographic auditability.

* **Live Web App:** [https://intora-wgyv.vercel.app/](https://intora-wgyv.vercel.app/)
* **Smart Contract on Base Sepolia:** [`0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f`](https://sepolia.basescan.org/address/0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f)
* **GitHub Repository:** [https://github.com/404Suvo/INTORA](https://github.com/404Suvo/INTORA)

---

## 🎯 What Problem is Intora Solving?

Conventional e-commerce experiences and emergent AI shopping agents suffer from four fundamental flaws:

### 1. AI Hallucination & Price Invention in Commerce
Large Language Models frequently invent non-existent products, miscalculate bundle prices, apply fictitious promotional discounts, or recommend out-of-stock items.  
**Intora's Solution:** Enforces **Zero Trust in AI Math**. All product IDs, prices, and inventory are strictly cross-referenced against an authoritative catalog (`data/catalog.json`). All currency math is computed exclusively in **integer minor units** (paise for INR; ₹3,000.00 = `300000` paise). Any hallucinated price is automatically detected, flagged, and overwritten with catalog truth.

### 2. Silent Merchant Alterations & "Cart Drift"
Between the time a shopper reviews an item bundle and the final checkout, prices often fluctuate, items get silently substituted, or hidden fees are added without a verifiable audit trail.  
**Intora's Solution:** Generates a canonical, key-sorted, UTF-8 JSON serialization of the user-approved plan and computes a cryptographic `keccak256` hash. This hash is written directly to the `ShoppingIntentRegistry` smart contract on Base Sepolia, creating tamper-proof evidence of agreed-upon prices, items, quantities, and expiration dates.

### 3. Destruction of Context & Provenance During Revisions
When a customer negotiates or adjusts constraints (e.g., downsizing budget, removing non-essentials), typical shopping platforms overwrite the cart, destroying the provenance of earlier agreements.  
**Intora's Solution:** Built-in **Stateful Dual-Version Immutability**. Revisions preserve the exact same 32-byte `intentId`, increment the version counter (`v1 -> v2`), compute automated item diffs, and store both versions on-chain. Version 1 remains permanently queryable and valid.

### 4. High Risk of Custodial AI Wallets
Autonomous agents given unrestricted private key custody can drain funds, succumb to prompt injection attacks, or make unauthorized purchases.  
**Intora's Solution:** Non-custodial, client-side approval architecture. The server-side Gemini agent only formulates raw calldata. The agent **never holds private keys, never signs, and never executes transactions**. The user retains complete authority and signs every transaction via MetaMask.

---

## 🛠️ Tech Stack & Versions

| Layer | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) | `16.4.0` | React framework with Turbopack bundler & App Router |
| **UI Library** | [React](https://react.dev/) | `19.3.0` | Latest React with Server Components & Hooks |
| **Runtime** | [React DOM](https://react.dev/) | `19.3.0` | DOM rendering engine |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `5.9.3` | Strict type checking with custom exclusions |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `4.3.3` | Utility-first responsive CSS engine |
| **AI SDK** | [@google/genai](https://www.npmjs.com/package/@google/genai) | `2.24.0` | Official Google GenAI SDK for Gemini models |
| **Web3 Client** | [Viem](https://viem.sh/) | `2.56.9` | Lightweight, type-safe Ethereum & Base Sepolia client |
| **Smart Contracts** | [Solidity](https://soliditylang.org/) | `^0.8.20` | EVM smart contract for intent recording |
| **Contract Tooling**| [Hardhat](https://hardhat.org/) | `3.19.0` | Local EVM simulation, deployment, and testing |
| **3D & Animation** | [Three.js](https://threejs.org/) / [Motion](https://motion.dev/) | `0.186.1` / `14.0.0` | Interactive 3D graphics and UI animations |
| **Icons** | [Lucide React](https://lucide.dev/) | `1.48.0` | Accessible SVG icon suite |
| **Node.js** | [Node.js](https://nodejs.org/) | `>=20.x` | Required server-side runtime environment |
| **Hosting** | [Vercel](https://vercel.com/) | Live | Edge network deployment with SSL |

### 📜 Deployed Smart Contract

| Parameter | Details |
| :--- | :--- |
| **Contract Name** | `ShoppingIntentRegistry` |
| **Contract Address** | [`0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f`](https://sepolia.basescan.org/address/0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f) |
| **Network** | Base Sepolia Testnet (Ethereum L2) |
| **Chain ID** | `84532` |
| **Deployer Wallet** | [`0x1ec6f66fe81a2f01ee95f1d58fcea2522b9ec9d3`](https://sepolia.basescan.org/address/0x1ec6f66fe81a2f01ee95f1d58fcea2522b9ec9d3) |
| **Solidity Compiler** | `^0.8.20` (Optimizer enabled, 200 runs) |
| **Explorer Link** | [Basescan Explorer](https://sepolia.basescan.org/address/0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f) |

---

## 🤖 Supported AI Models & Multi-Model Switching

Intora is engineered with dynamic model switching and automated fallback resilience to ensure uninterrupted uptime:

### Supported Models & Versions:
1. **`gemini-2.5-flash`** (Default Production):
   - Fast, low-latency reasoning engine optimized for real-time tool calling and bundle recommendations.
2. **`gemini-3.5-flash`**:
   - Advanced agentic reasoning with high instruction-following fidelity for multi-constraint knapsack optimization.
3. **`gemini-3.5-flash-lite`**:
   - High-throughput, ultra-lightweight model ideal for rapid catalog queries.
4. **`gemini-flash-latest`**:
   - Continuously updated stable flash channel on Google AI Studio.
5. **`gemini-3.6-flash`**:
   - Extended context reasoning for complex shopping situations and multi-step revisions.

### Dynamic Model-Switching & Fallback Mechanism:
- **Environment Selection:** Set primary model anytime via `GEMINI_MODEL=gemini-2.5-flash` in `.env`.
- **Automated Fallback Ring:** If the active model experiences rate limits (`429`), quota exhaustions, or transient network delays, the agent runtime automatically cascades through the candidate models list without failing the user request:
  ```typescript
  const CANDIDATE_MODELS = [
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
  ];
  ```

---

## 🧰 AI Agent Tools (8 Built-In Tools)

Intora's agent loop does not execute arbitrary code; it operates strictly through **8 core server-side controlled tools**:

| # | Tool Name | Parameters | Description & Role |
| :-: | :--- | :--- | :--- |
| **1** | `analyze_situation` | `situation: string` | Parses natural-language prompts, extracts constraints, dates, and converts rupee budgets to **integer paise** (`1 INR = 100 paise`). |
| **2** | `search_products` | `query?: string`, `category?: string`, `maxPriceMinor?: number` | Queries the authoritative product catalog by keyword or category, with live stock verification. |
| **3** | `optimize_bundle` | `budgetMinor: number`, `situation: string`, `requiredCategories?: string[]` | Solves a knapsack-like constraint problem, assembling the highest-utility bundle strictly under the budget cap. |
| **4** | `verify_plan` | `items: Array<{productId, quantity}>`, `budgetMinor: number` | Cross-validates proposed plans against ground-truth catalog prices, stock availability, and future expiry timestamps. |
| **5** | `prepare_intent` | `items: ShoppingPlanItem[]`, `budgetMinor: number`, `intentId?: string` | Computes deterministic UTF-8 canonical JSON, calculates `keccak256` plan hash, creates Version 1 or links Version 2+ to existing `intentId`. |
| **6** | `read_intent` | `intentId: string`, `version?: number` | Queries both local storage and the Base Sepolia smart contract; compares on-chain hash against off-chain canonical hash (`PASS ✅ / FAIL ❌`). |
| **7** | `prepare_transaction`| `intentId: string`, `version: number` | Encodes ABI calldata for `recordIntent` or `recordVersion`. Never signs or sends; provides calldata for client MetaMask review. |
| **8** | `verify_transaction`| `calldata: string`, `expectedIntentId: string`, `expectedPlanHash: string` | Decodes raw EVM calldata to ensure parameter integrity before prompting user wallet signature. |

---

## 🏗️ Architecture & Data Flow

```
[User Request: Situation + Budget]
              │
              ▼
[Gemini Agent with 8 Controlled Tools] (Server-Side)
  ├── 1. analyze_situation      --> Parses situation & budget in paise
  ├── 2. search_products        --> Authoritative catalog lookup
  ├── 3. optimize_bundle        --> Knapsack bundle selection
  ├── 4. verify_plan            --> Overwrites AI hallucinations
  └── 5. prepare_intent         --> Canonical JSON & Keccak256 Hash
              │
              ▼
[Frontend Review Panel]
  ├── User inspects items, quantities, and prices
  └── Pre-submission integrity check
              │
              ▼
[MetaMask Wallet (User Sign-Off)]
  └── User approves `recordIntent(intentId, planHash, version, expiry)`
              │
              ▼
[ShoppingIntentRegistry.sol on Base Sepolia]
  ├── Version 1 Commitment Stored
  └── Version 2+ Revisions Stored under IDENTICAL intentId
              │
              ▼
[Verification Component]
  └── publicClient reads on-chain commitment: `onChainHash == recomputedHash` (PASS ✅)
```

---

## ⚡ Quickstart & Local Installation

### 1. Clone the Repository
```bash
git clone https://github.com/404Suvo/INTORA.git
cd INTORA
npm install
```

### 2. Configure Environment Variables
Create `.env` based on [.env.example](./.env.example):
```bash
cp .env.example .env
```

Fill in your configuration:
```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Base Sepolia Testnet
BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS=0xb3bfe4b59fefb1fdac47f1185a09ebece05e961f

# Optional Testnet Deployer Key (Throwaway testnet wallet only)
DEPLOYER_PRIVATE_KEY=0x_throwaway_testnet_private_key_here
```

### 3. Run the Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000).

---

## 🧪 Comprehensive Test Suite (34/34 Passing)

Intora includes 4 test suites covering every phase, edge case, and contract invariant:

```bash
# Run all 34 tests across all suites
npm test

# Run individual test suites
npm run test:phase1     # Validation, catalog grounding, canonicalization, hashing
npm run test:phase2     # 8 controlled Gemini tools, revision handling, calldata
npm run test:contracts  # Hardhat Solidity tests (ShoppingIntentRegistry.sol)
npm run test:phase6     # Application edge cases, hash mismatch detection, integration
```

### Verified Test Cases:
* **Contract Invariants:** Rejects non-sequential versions (e.g. starting with v2 or skipping v1 to v3); enforces single-owner revisions; prevents modifying cancelled intents; rejects past expiry timestamps; preserves all historical versions.
* **AI Tooling Guardrails:** Detects and overwrites price hallucinations; enforces integer paise math; handles wallet disconnects gracefully; rejects floating-point currencies.

---

## 🚀 Future Scope & Roadmap

### Week 2: Zero-Knowledge & Confidential Verification
* **ZK-SNARK Plan Commitments (Circom / Groth16):** Enable shoppers to cryptographically prove that their total order does not exceed a specified budget cap or that their cart contains only approved merchant categories, **without revealing specific items or exact quantities on-chain**.
* **Encrypted Private State:** Store salted plan representations via decentralized private compute (e.g. Lit Protocol / Oasis Sapphire) so sensitive procurement lists remain confidential.

### Week 3: Autonomous Agent Settlement & x402 Payments
* **x402 Protocol Implementation:** Integrate the HTTP `402 Payment Required` standard to allow automated machine-to-machine checkout when an on-chain commitment reaches fulfillment criteria.
* **ERC-4337 Account Abstraction & Session Keys:** Implement scoped session keys allowing users to pre-authorize the agent for micro-revisions within a bounded ±5% budget tolerance without prompting MetaMask for each version increment.
* **Cross-Chain Intent Aggregation:** Bridge shopping intent commitments across Base, Arbitrum, and Optimism using Chainlink CCIP.

---

## ⚠️ Limitations & Disclaimers

1. **Commitment Only (Not a Payment Gateway):** Recording an intent on-chain registers cryptographic proof that the user reviewed and approved a shopping plan. It does **not** charge credit cards, lock escrow, or guarantee delivery.
2. **Product Authenticity:** The on-chain hash confirms data structure immutability; it does not physically verify warehouse inventory or third-party seller conduct.
3. **Testnet Demonstration:** Deployed on **Base Sepolia Testnet** for demonstration and hackathon purposes. Contracts are unaudited.

---

## 📄 License

Distributed under the [MIT License](./LICENSE). Designed and built with ❤️ by [Suvo](https://github.com/404Suvo).
