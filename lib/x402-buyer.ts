import { x402Client, x402HTTPClient } from "@x402/core/client";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  X402_NETWORK,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  BASE_SEPOLIA_EXPLORER_BASE,
  MAX_PAYMENT_USD,
  USDC_DECIMALS,
  getAgentAccount,
  getAgentWalletBalances,
  paymentLimiter,
} from "./x402-config";
import type { ProductResearchResult } from "@/app/api/research/product/route";

export type PaymentLifecycleStatus =
  | "Ready"
  | "Payment required"
  | "Authorizing"
  | "Submitting settlement"
  | "Confirmed"
  | "Failed"
  | "Pending verification";

export interface SettlementTelemetry {
  status: PaymentLifecycleStatus;
  service: string;
  network: string;
  chainId: number;
  quotedAmountUsd: string;
  tokenSymbol: string;
  tokenAddress: string;
  payerAddress: string | null;
  receiverAddress: string | null;
  transactionHash: string | null;
  explorerUrl: string | null;
  errorMessage: string | null;
  isRetryable: boolean;
  requiresFunds: boolean;
  faucetUrl: string | null;
  researchData?: ProductResearchResult | null;
}

export interface ExecutePaymentOptions {
  query: string;
  category?: string;
  targetUrl?: string;
  maxSpendUsd?: string;
  baseUrl?: string;
}

/**
 * Resolves the absolute URL for the protected research resource.
 */
function resolveResourceUrl(targetUrl?: string, baseUrl?: string, query?: string, category?: string): string {
  const queryParam = encodeURIComponent(query || "essential supplies");
  const catParam = category ? `&category=${encodeURIComponent(category)}` : "";
  const relativePath = `/api/research/product?query=${queryParam}${catParam}`;

  if (targetUrl && targetUrl.startsWith("http")) {
    return targetUrl;
  }

  if (baseUrl) {
    const cleanBase = baseUrl.replace(/\/$/, "");
    return `${cleanBase}${relativePath}`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const cleanAppUrl = appUrl.replace(/\/$/, "");
  return `${cleanAppUrl}${relativePath}`;
}

/**
 * Executes the complete x402 Buyer workflow using official protocol SDKs.
 */
export async function executePaidResearch(options: ExecutePaymentOptions): Promise<SettlementTelemetry> {
  const maxSpend = options.maxSpendUsd || MAX_PAYMENT_USD;
  const maxSpendNum = parseFloat(maxSpend);
  const resourceUrl = resolveResourceUrl(options.targetUrl, options.baseUrl, options.query, options.category);

  // 1. Check dedicated agent wallet
  const account = getAgentAccount();
  if (!account) {
    return {
      status: "Failed",
      service: "Intora Deep Product Intelligence",
      network: X402_NETWORK,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      quotedAmountUsd: "0.01",
      tokenSymbol: "USDC",
      tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
      payerAddress: null,
      receiverAddress: null,
      transactionHash: null,
      explorerUrl: null,
      errorMessage: "Dedicated test agent wallet is not configured. Set X402_BUYER_PRIVATE_KEY in backend environment.",
      isRetryable: false,
      requiresFunds: false,
      faucetUrl: "https://faucet.circle.com/",
    };
  }

  // 2. Anti-replay and in-flight lock
  const lockKey = `${account.address.toLowerCase()}:${options.query.trim().toLowerCase()}`;
  const lockStatus = paymentLimiter.canAttempt(lockKey);
  if (!lockStatus.allowed) {
    return {
      status: "Failed",
      service: "Intora Deep Product Intelligence",
      network: X402_NETWORK,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      quotedAmountUsd: "0.01",
      tokenSymbol: "USDC",
      tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
      payerAddress: account.address,
      receiverAddress: null,
      transactionHash: null,
      explorerUrl: null,
      errorMessage: lockStatus.reason || "Payment lock active. Please wait a moment.",
      isRetryable: true,
      requiresFunds: false,
      faucetUrl: null,
    };
  }

  paymentLimiter.acquireLock(lockKey);

  try {
    // 3. Initial Unpaid Request -> Expect HTTP 402
    let initialRes: Response;
    try {
      initialRes = await fetch(resourceUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (netErr: any) {
      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: "0.01",
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: null,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Network error connecting to protected resource: ${netErr?.message || netErr}`,
        isRetryable: true,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    if (initialRes.status === 200) {
      // Endpoint was already accessible or unlocked
      const data = (await initialRes.json()) as ProductResearchResult;
      return {
        status: "Confirmed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: "0.00",
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: null,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: null,
        isRetryable: false,
        requiresFunds: false,
        faucetUrl: null,
        researchData: data,
      };
    }

    if (initialRes.status !== 402) {
      const errText = await initialRes.text().catch(() => "");
      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: "0.01",
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: null,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Protected resource returned HTTP ${initialRes.status} instead of expected 402: ${errText.slice(0, 200)}`,
        isRetryable: true,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    // 4. Initialize official x402 client & parse requirements
    const client = new x402Client();
    client.register(X402_NETWORK, new ExactEvmScheme(account));
    client.setSpendControls({
      maxAmountPerPayment: maxSpend,
    });

    const httpClient = new x402HTTPClient(client);

    let paymentRequired;
    try {
      const getHeader = (name: string) => initialRes.headers.get(name);
      let body: unknown;
      try {
        const text = await initialRes.text();
        if (text) body = JSON.parse(text);
      } catch {
        // empty body
      }
      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);
    } catch (err: any) {
      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: "0.01",
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: null,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Failed to parse official x402 payment requirements from server: ${err?.message || err}`,
        isRetryable: false,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    // 5. Inspect payment requirement & enforce spending limits strictly before signing
    const evmRequirement = paymentRequired.accepts.find(
      (opt: any) => opt.network === X402_NETWORK && opt.scheme === "exact"
    );

    if (!evmRequirement) {
      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: "0.01",
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: null,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Server did not offer exact payment scheme for network ${X402_NETWORK}.`,
        isRetryable: false,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    // Convert atomic units (e.g. 10000 -> 0.01 USDC)
    const atomicAmount = BigInt(evmRequirement.amount || "0");
    const quotedUsd = (Number(atomicAmount) / 10 ** USDC_DECIMALS).toFixed(2);
    const receiver = evmRequirement.payTo as string;

    // Strict spending limit check
    if (parseFloat(quotedUsd) > maxSpendNum) {
      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: quotedUsd,
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: receiver,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Price protection triggered: Quoted price ($${quotedUsd} USDC) exceeds configured per-request maximum limit of $${maxSpend} USDC. Payment authorization aborted before signing.`,
        isRetryable: false,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    // Check if testnet USDC is available in wallet
    const balances = await getAgentWalletBalances(account.address);
    if (!balances.hasUsdcFunds) {
      return {
        status: "Payment required",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: quotedUsd,
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: receiver,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Agent wallet has insufficient Base Sepolia USDC balance (${balances.usdcBalance} USDC available, ${quotedUsd} USDC required). Obtain free testnet USDC from the Circle faucet.`,
        isRetryable: true,
        requiresFunds: true,
        faucetUrl: "https://faucet.circle.com/",
      };
    }

    // 6. Sign official EIP-3009 typed data payment payload via x402 client SDK
    let paymentPayload;
    try {
      paymentPayload = await client.createPaymentPayload(paymentRequired);
    } catch (signErr: any) {
      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: quotedUsd,
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: receiver,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `EIP-3009 payment payload creation failed: ${signErr?.message || signErr}`,
        isRetryable: true,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    // 7. Encode official PAYMENT-SIGNATURE header and retry request
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

    let paidRes: Response;
    try {
      paidRes = await fetch(resourceUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...paymentHeaders,
          "Access-Control-Expose-Headers": "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
        },
        cache: "no-store",
      });
    } catch (retryErr: any) {
      return {
        status: "Pending verification",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: quotedUsd,
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: receiver,
        transactionHash: null,
        explorerUrl: null,
        errorMessage: `Network error during payment submission: ${retryErr?.message || retryErr}`,
        isRetryable: false,
        requiresFunds: false,
        faucetUrl: null,
      };
    }

    // 8. Capture and decode settlement response
    const paymentResponseHeader =
      paidRes.headers.get("PAYMENT-RESPONSE") ||
      paidRes.headers.get("payment-response") ||
      paidRes.headers.get("X-PAYMENT-RESPONSE") ||
      paidRes.headers.get("x-payment-response");

    let settlementData: any = null;
    if (paymentResponseHeader) {
      try {
        settlementData = decodePaymentResponseHeader(paymentResponseHeader);
      } catch (decodeErr) {
        console.warn("[x402-buyer] Could not decode PAYMENT-RESPONSE header:", decodeErr);
      }
    }

    // 9. Inspect settlement success and on-chain transaction hash
    const isSuccess = paidRes.status === 200 && settlementData?.success === true;
    const txHash = settlementData?.transaction || null;
    const explorerUrl = txHash ? `${BASE_SEPOLIA_EXPLORER_BASE}/tx/${txHash}` : null;

    if (!isSuccess) {
      const errorReason =
        settlementData?.errorReason ||
        settlementData?.errorMessage ||
        (paidRes.status === 402 ? "Settlement verification rejected by facilitator" : `Server returned HTTP ${paidRes.status}`);

      const needsFunds =
        errorReason.includes("insufficient_balance") ||
        errorReason.includes("exceeds balance");

      return {
        status: "Failed",
        service: "Intora Deep Product Intelligence",
        network: X402_NETWORK,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        quotedAmountUsd: quotedUsd,
        tokenSymbol: "USDC",
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        payerAddress: account.address,
        receiverAddress: receiver,
        transactionHash: txHash,
        explorerUrl,
        errorMessage: errorReason,
        isRetryable: !needsFunds,
        requiresFunds: needsFunds,
        faucetUrl: needsFunds ? "https://faucet.circle.com/" : null,
      };
    }

    // 10. Parse fulfilled research data
    let researchResult: ProductResearchResult | null = null;
    try {
      researchResult = (await paidRes.json()) as ProductResearchResult;
    } catch {
      // empty json
    }

    return {
      status: "Confirmed",
      service: "Intora Deep Product Intelligence",
      network: X402_NETWORK,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      quotedAmountUsd: quotedUsd,
      tokenSymbol: "USDC",
      tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
      payerAddress: account.address,
      receiverAddress: receiver,
      transactionHash: txHash,
      explorerUrl,
      errorMessage: null,
      isRetryable: false,
      requiresFunds: false,
      faucetUrl: null,
      researchData: researchResult,
    };
  } finally {
    paymentLimiter.releaseLock(lockKey);
  }
}
