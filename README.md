# Intora: AI Shopping Planner on Base Sepolia

[![Live App](https://img.shields.io/badge/Live%20Demo-intora--gcmb.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://intora-gcmb.vercel.app/)
[![Network](https://img.shields.io/badge/Network-Base%20Sepolia%20(84532)-0052FF?style=for-the-badge&logo=coinbase&logoColor=white)](https://sepolia.basescan.org/address/0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2016%20Turbopack-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![AI Model](https://img.shields.io/badge/AI%20Engine-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

> **Live Deployment:** [https://intora-gcmb.vercel.app/](https://intora-gcmb.vercel.app/)  
> **Base Sepolia Contract:** [`0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3`](https://sepolia.basescan.org/address/0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3)

---

## What is Intora?

**Intora** is an intent-first, agentic commerce system that turns natural-language shopping requests into verified, catalog-grounded product bundles. When a user approves a proposed plan, Intora records it as an **immutable, versioned cryptographic commitment** on **Base Sepolia** (Ethereum Layer 2 testnet).

If the user subsequently revises their budget or constraints, Intora generates **Version 2** linked to the **same intent ID**, preserving historical versions on-chain permanently for auditability and trust.

---

## Key Links & Live Artifacts

| Resource | Link |
| :--- | :--- |
| **Production Website** | [https://intora-gcmb.vercel.app/](https://intora-gcmb.vercel.app/) |
| **BaseScan Explorer** | [`0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3`](https://sepolia.basescan.org/address/0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3) |
| **GitHub Repository** | [https://github.com/404Suvo/INTORA](https://github.com/404Suvo/INTORA) |
| **Chain ID** | `84532` (Base Sepolia Testnet) |
| **RPC Endpoint** | `https://sepolia.base.org` |

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

## Hard Rules Strictly Enforced

1. **Server-Side API Key Only**: `GEMINI_API_KEY` is accessible exclusively on the server (`app/api/agent/route.ts`). It is never bundled into client-side JavaScript.
2. **User-Approved Transactions**: The AI agent and backend server never hold private keys or submit transactions. They only formulate calldata; the user explicitly approves every transaction through MetaMask.
3. **Zero Trust in AI Calculations**: Product IDs, prices, stock availability, and totals come strictly from `data/catalog.json`. Any hallucinated prices are immediately overwritten with catalog ground truth.
4. **Integer Minor Units (Paise for INR)**: No floating-point currencies. ₹3,000.00 is strictly stored and calculated as `300000` paise.
5. **No Purchases or Escrow**: Clear disclaimer shown: *"This records a commitment to your approved plan. It does not place an order."*
6. **Testnet Only**: Strict verification of Base Sepolia Chain ID (`84532`) before transactions.
7. **Deployer Key Safety**: Deployer keys are restricted to git-ignored `.env` files for throwaway testnet wallets only.

---

## Application Routes

- **`/` (Home)**: Full landing experience with interactive demo, catalog display, feature breakdown, and AI Concierge chat.
- **`/planner`**: Interactive planning workspace for natural-language situations, budget adjustments, and instant knapsack bundle recommendations.
- **`/history`**: On-chain commitment history explorer displaying transaction hashes, blocks, version trees, and BaseScan verification links.
- **`/demo`**: Guided end-to-end simulation flow walking through initial plan creation, MetaMask signing, budget revision, and dual-version on-chain immutability.

---

## Prerequisites

- **Node.js**: v20 or newer (`node -v`)
- **MetaMask browser extension**
- **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)
- **Base Sepolia Testnet ETH** (free from faucets)

---

## Setup & Local Development

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/404Suvo/INTORA.git
cd INTORA
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your values in `.env`:

```env
# Google Gemini API (Server-Side Only)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Base Sepolia Blockchain (Chain ID 84532)
BASE_SEPOLIA_RPC=https://sepolia.base.org

# Deployed ShoppingIntentRegistry Address
NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS=0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3

# Optional Testnet Deployer Key (For contract re-deployment only)
DEPLOYER_PRIVATE_KEY=0x_throwaway_testnet_private_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Funding Your Testnet Wallet

To record commitments on Base Sepolia, you need testnet ETH for gas:
1. Open MetaMask and switch your network to **Base Sepolia** (Chain ID: `84532`).
2. Get free testnet ETH from any of these faucets:
   - [Chainlink Faucets (Base Sepolia)](https://faucets.chain.link/base-sepolia)
   - [Superchain Faucet](https://console.optimism.io/faucet)
   - [Coinbase Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

---

## Automated Test Suite

Intora includes a 34-test suite covering validation, catalog integrity, AI tooling, smart contracts, and integration edge cases:

```bash
# Run all 34 tests across all suites
npm test

# Run individual test suites
npm run test:phase1     # Validation, catalog grounding, canonicalization, hashing
npm run test:phase2     # Controlled Gemini tools, revision handling, calldata
npm run test:contracts  # Hardhat Solidity tests (ShoppingIntentRegistry.sol)
npm run test:phase6     # Edge cases, hash mismatch detection, integration
```

### Test Coverage Highlights:
- ✅ **Version 1 Recording**: First version initialization and owner assignment.
- ✅ **Sequential Increments**: Enforces `version == latestVersion + 1`; blocks skipping (e.g., version 1 to 3).
- ✅ **Immutability of Prior Versions**: Updating to version 2 preserves version 1 intact on-chain.
- ✅ **Non-Owner Rejection**: Unauthorized addresses cannot revise another user's intent.
- ✅ **Past Expiry Rejection**: Expired plans cannot be recorded.
- ✅ **Zero-Value Protection**: Null intent IDs or empty hashes are rejected.
- ✅ **Permanent Cancellation**: Cancelled intents cannot be revised.
- ✅ **Price Hallucination Defense**: AI price modifications are detected and reset to catalog ground truth.

---

## Running the End-to-End Demo Script

Run the automated integration demo script to simulate the complete dual-version flow:

```bash
npm run demo
```

### Demo Flow:
1. **Initial Prompt**: *"I need supplies for three days of college activities, my budget is Rs 3,000"*
2. **AI Planning**: Parses budget as `300000` paise (₹3,000). Selects essential supplies totaling ₹2,489.
3. **Canonical Hash**: Deterministic UTF-8 JSON key-ordered serialization hashed with `keccak256`.
4. **On-Chain Recording**: Version 1 commitment written to Base Sepolia.
5. **Verification**: Contract read query confirms `onChainHash == canonicalHash` (PASS ✅).
6. **Revision Prompt**: *"Budget is now Rs 2,000, keep the essentials"*
7. **Version 2 Creation**: Preserves the **identical** `intentId`, increments to `version = 2`, drops expensive power bank, adds first-aid kit.
8. **Dual-Version Verification**: Version 2 recorded on-chain while Version 1 remains permanently preserved on Base Sepolia.

---

## Smart Contract Details

- **Contract**: [`ShoppingIntentRegistry.sol`](./contracts/ShoppingIntentRegistry.sol)
- **Network**: Base Sepolia (`84532`)
- **Deployed Address**: [`0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3`](https://sepolia.basescan.org/address/0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3)

### Core Interface:
```solidity
function recordIntent(bytes32 intentId, bytes32 planHash, uint32 version, uint64 expiry) external;
function recordVersion(bytes32 intentId, bytes32 planHash, uint32 version, uint64 expiry) external;
function cancelIntent(bytes32 intentId) external;
function getCommitment(bytes32 intentId, uint32 version) external view returns (address owner, bytes32 planHash, uint32 version, uint64 expiry);
function getLatestVersion(bytes32 intentId) external view returns (uint32);
function isIntentValid(bytes32 intentId) external view returns (bool);
```

---

## Deploying to Vercel

1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. Import the project in [Vercel](https://vercel.com).
3. Add the following **Environment Variables** in Vercel project settings:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `GEMINI_MODEL`: `gemini-2.5-flash`
   - `BASE_SEPOLIA_RPC`: `https://sepolia.base.org`
   - `NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS`: `0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3`
4. Click **Deploy**.

---

## Limitations & Disclaimers

1. **Commitment Only (Not a Purchase)**: Recording an intent on-chain registers user review and approval of a shopping plan. It does **not** charge credit cards, initiate bank transfers, place merchant orders, or reserve inventory.
2. **Product Authenticity**: The on-chain hash verifies cryptographic immutability of the approved data structure; it does not independently certify physical product condition or supplier reliability.
3. **Plan Privacy**: Plain hashes of plans with very few, easily guessable items could theoretically be verified against a known catalog by an observer. An optional 32-byte salt (`NEXT_PUBLIC_ENABLE_SALT=true`) is supported for heightened privacy.
4. **Testnet Prototype**: This software is deployed on **Base Sepolia Testnet** for demonstration purposes. The smart contracts are unaudited and should not be used on mainnet without a full security audit.

---

## License

This project is licensed under the [MIT License](./LICENSE).
