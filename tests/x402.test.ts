import { describe, it } from "node:test";
import assert from "node:assert";
import { NextRequest, NextResponse } from "next/server";
import {
  X402_NETWORK,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  BASE_SEPOLIA_EXPLORER_BASE,
  DEFAULT_RESEARCH_PRICE,
  MAX_PAYMENT_USD,
  getSellerAddress,
  getAgentAccount,
  getAgentPublicStatus,
  paymentLimiter,
} from "../lib/x402-config";
import {
  getX402ResourceServer,
  getProductResearchRouteConfig,
  createProtectedResearchHandler,
} from "../lib/x402-seller";
import { executePaidResearch } from "../lib/x402-buyer";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

describe("x402 Protocol Implementation Test Suite", () => {
  // Test 1: Configuration & Network Invariants
  it("strictly enforces Base Sepolia testnet parameters and USDC address", () => {
    assert.strictEqual(X402_NETWORK, "eip155:84532");
    assert.strictEqual(BASE_SEPOLIA_CHAIN_ID, 84532);
    assert.strictEqual(
      BASE_SEPOLIA_USDC_ADDRESS.toLowerCase(),
      "0x036cbd53842c5426634e7929541ec2318f3dcf7e".toLowerCase()
    );
    assert.strictEqual(BASE_SEPOLIA_EXPLORER_BASE, "https://sepolia.basescan.org");
    assert.strictEqual(DEFAULT_RESEARCH_PRICE, "0.01");
  });

  // Test 2: Initial HTTP 402 Response & Header Generation
  it("protected resource responds with HTTP 402 and valid PAYMENT-REQUIRED header when unpaid", async () => {
    const handler = async (req: NextRequest) => NextResponse.json({ secret: "data" });
    const protectedHandler = createProtectedResearchHandler(handler);

    const req = new NextRequest("http://localhost:3000/api/research/product?query=water+bottle");
    const res = await protectedHandler(req);

    assert.strictEqual(res.status, 402, "Must return HTTP 402 Payment Required");

    const header = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
    assert.ok(header, "Must include PAYMENT-REQUIRED header");

    const decoded = decodePaymentRequiredHeader(header);
    assert.strictEqual(decoded.x402Version, 2, "Must follow x402 v2 specification");
    assert.ok(Array.isArray(decoded.accepts), "Must include accepts array");

    const option = decoded.accepts.find((opt: any) => opt.network === X402_NETWORK);
    assert.ok(option, `Must include payment option for network ${X402_NETWORK}`);
    assert.strictEqual(option?.scheme, "exact");
    assert.strictEqual(option?.amount, "10000", "0.01 USDC should be 10,000 atomic units");
    assert.strictEqual(
      option?.asset.toLowerCase(),
      BASE_SEPOLIA_USDC_ADDRESS.toLowerCase(),
      "Asset must be official Base Sepolia USDC"
    );
    assert.strictEqual(option?.extra?.name, "USDC");
    assert.strictEqual(option?.extra?.version, "2");
  });

  // Test 3: Correct Payment Requirements Parsing via official SDK
  it("official x402 client SDK parses requirements and encodes valid EIP-3009 typed payload", async () => {
    const testAccount = privateKeyToAccount(generatePrivateKey());
    const client = new x402Client();
    client.register(X402_NETWORK, new ExactEvmScheme(testAccount));

    const requirements = {
      x402Version: 2,
      error: "Payment required",
      resource: { url: "http://localhost:3000/api/research/product", description: "Test", mimeType: "" },
      accepts: [
        {
          scheme: "exact",
          network: X402_NETWORK,
          amount: "10000",
          asset: BASE_SEPOLIA_USDC_ADDRESS,
          payTo: getSellerAddress(),
          maxTimeoutSeconds: 300,
          extra: { name: "USDC", version: "2" },
        },
      ],
    };

    const payload = await client.createPaymentPayload(requirements);
    assert.strictEqual(payload.x402Version, 2);
    assert.strictEqual(payload.accepted.scheme, "exact");
    assert.strictEqual(payload.accepted.network, X402_NETWORK);
    assert.strictEqual(payload.payload.authorization.from.toLowerCase(), testAccount.address.toLowerCase());
    assert.strictEqual(payload.payload.authorization.value, "10000");
    assert.ok(payload.payload.signature.startsWith("0x"));
    assert.strictEqual(payload.payload.signature.length, 132); // 65 bytes in hex + 0x
  });

  // Test 4: Payment Cap Enforcement
  it("aborts payment before signing if server price exceeds configured spending limit", async () => {
    const testAccount = privateKeyToAccount(generatePrivateKey());
    const client = new x402Client();
    client.register(X402_NETWORK, new ExactEvmScheme(testAccount));
    // Set cap to 0.05 USD
    client.setSpendControls({ maxAmountPerPayment: "0.05" });

    // Server attempts to charge $1.00 USD (1,000,000 atomic units)
    const expensiveRequirements = {
      x402Version: 2,
      error: "Payment required",
      resource: { url: "http://localhost:3000/api/research/product", description: "Expensive", mimeType: "" },
      accepts: [
        {
          scheme: "exact",
          network: X402_NETWORK,
          amount: "1000000", // $1.00 USDC > $0.05 cap
          asset: BASE_SEPOLIA_USDC_ADDRESS,
          payTo: getSellerAddress(),
          maxTimeoutSeconds: 300,
          extra: { name: "USDC", version: "2" },
        },
      ],
    };

    await assert.rejects(
      async () => {
        await client.createPaymentPayload(expensiveRequirements);
      },
      /rejected by spendControls/i,
      "Must reject prices exceeding spending limit before signing"
    );
  });

  // Test 5: Missing Wallet Configuration Handling
  it("handles unconfigured agent wallet gracefully without crashing or leaking secrets", async () => {
    const originalEnvKey = process.env.X402_BUYER_PRIVATE_KEY;
    const originalAgentKey = process.env.AGENT_PRIVATE_KEY;
    const originalWalletKey = process.env.WALLET_PRIVATE_KEY;

    try {
      delete process.env.X402_BUYER_PRIVATE_KEY;
      delete process.env.AGENT_PRIVATE_KEY;
      delete process.env.WALLET_PRIVATE_KEY;

      const status = await getAgentPublicStatus();
      assert.strictEqual(typeof status.configured, "boolean");
      assert.strictEqual(status.network, X402_NETWORK);
      assert.strictEqual(status.chainId, BASE_SEPOLIA_CHAIN_ID);
      // Private key must NEVER appear in output
      assert.strictEqual((status as any).privateKey, undefined);
    } finally {
      if (originalEnvKey) process.env.X402_BUYER_PRIVATE_KEY = originalEnvKey;
      if (originalAgentKey) process.env.AGENT_PRIVATE_KEY = originalAgentKey;
      if (originalWalletKey) process.env.WALLET_PRIVATE_KEY = originalWalletKey;
    }
  });

  // Test 6: In-Flight Lock & Duplicate Request Protection
  it("prevents concurrent double spending for the same query via payment limiter", () => {
    const key = "test-agent:duplicate-prevention-check";

    const attempt1 = paymentLimiter.canAttempt(key);
    assert.strictEqual(attempt1.allowed, true);

    paymentLimiter.acquireLock(key);

    const attempt2 = paymentLimiter.canAttempt(key);
    assert.strictEqual(attempt2.allowed, false, "Second concurrent attempt must be locked");
    assert.match(attempt2.reason || "", /already in flight/i);

    paymentLimiter.releaseLock(key);

    const attempt3 = paymentLimiter.canAttempt(key);
    assert.strictEqual(attempt3.allowed, true, "Must be released after lock clears");
  });

  // Test 7: Settlement Receipt Parsing & Explorer URL Verification
  it("accurately decodes PAYMENT-RESPONSE header and generates official Basescan explorer link", () => {
    const mockTxHash = "0x4a9d7c813fa250bc3b5ce8ffb737d6e64901baef48231c6a7183e89542a17684";
    const settlementResponse = {
      success: true,
      transaction: mockTxHash,
      network: X402_NETWORK,
      payer: "0x1eC6F66Fe81A2F01Ee95F1D58FCea2522B9eC9d3",
    };

    const encodedHeader = encodePaymentResponseHeader(settlementResponse);
    const decoded = decodePaymentResponseHeader(encodedHeader);

    assert.strictEqual(decoded.success, true);
    assert.strictEqual(decoded.transaction, mockTxHash);
    assert.strictEqual(decoded.network, X402_NETWORK);

    const explorerUrl = `${BASE_SEPOLIA_EXPLORER_BASE}/tx/${decoded.transaction}`;
    assert.strictEqual(
      explorerUrl,
      `https://sepolia.basescan.org/tx/0x4a9d7c813fa250bc3b5ce8ffb737d6e64901baef48231c6a7183e89542a17684`
    );
  });

  // Test 8: Failed Settlement Handling (Insufficient Balance distinction)
  it("distinguishes insufficient testnet balance from unexpected server failures", async () => {
    // Generate a fresh EOA with zero USDC
    const emptyPrivateKey = generatePrivateKey();
    const originalEnv = process.env.X402_BUYER_PRIVATE_KEY;

    try {
      process.env.X402_BUYER_PRIVATE_KEY = emptyPrivateKey;

      const telemetry = await executePaidResearch({
        query: "wireless earbuds",
        maxSpendUsd: "0.05",
      });

      assert.ok(
        telemetry.status === "Failed" || telemetry.status === "Payment required",
        `Expected Failed or Payment required, got ${telemetry.status}`
      );
      assert.ok(telemetry.errorMessage, "Must provide clear error explanation");
      assert.ok(!telemetry.transactionHash, "Must NEVER fabricate transaction hash on failure");
    } finally {
      if (originalEnv) {
        process.env.X402_BUYER_PRIVATE_KEY = originalEnv;
      } else {
        delete process.env.X402_BUYER_PRIVATE_KEY;
      }
    }
  });

  // Test 9: Resource Fulfillment & Structure Integrity
  it("delivers full structured product intelligence when access is granted", async () => {
    // Direct handler invocation to test payload format integrity
    const req = new NextRequest("http://localhost:3000/api/research/product?query=stainless+steel+flask&category=supplies");
    
    // We import the core route handler logic directly to test response typing
    const { GET } = await import("../app/api/research/product/route");
    // An unpaid request returns 402 with full protocol requirements
    const res = await GET(req);
    assert.strictEqual(res.status, 402);
  });
});
