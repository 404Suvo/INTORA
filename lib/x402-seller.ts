import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  X402_NETWORK,
  X402_FACILITATOR_URL,
  DEFAULT_RESEARCH_PRICE,
  getSellerAddress,
} from "./x402-config";

let cachedServer: x402ResourceServer | null = null;
let serverInitPromise: Promise<x402ResourceServer> | null = null;

/**
 * Resilient facilitator client that provides fallback supported kinds
 * if the remote facilitator endpoint is unreachable or offline during startup.
 */
class ResilientFacilitatorClient extends HTTPFacilitatorClient {
  override async getSupported() {
    try {
      return await super.getSupported();
    } catch (err: any) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[x402-seller] Remote facilitator unreachable for getSupported, using fallback static kinds:",
          err?.message || err
        );
      }
      return {
        kinds: [
          {
            x402Version: 2,
            scheme: "exact",
            network: X402_NETWORK,
          },
        ],
        extensions: [],
        signers: {},
      };
    }
  }
}

/**
 * Returns a singleton instance of the official x402 Resource Server
 * registered for Base Sepolia EVM exact payments.
 */
export async function getX402ResourceServer(): Promise<x402ResourceServer> {
  if (cachedServer) return cachedServer;

  if (!serverInitPromise) {
    serverInitPromise = (async () => {
      const facilitator = new ResilientFacilitatorClient({
        url: X402_FACILITATOR_URL,
        timeoutMs: 25_000,
      });

      const server = new x402ResourceServer(facilitator);
      server.register(X402_NETWORK, new ExactEvmScheme());

      try {
        await server.initialize();
      } catch (err) {
        console.warn("[x402-seller] Facilitator init warning (will retry on demand):", err);
      }

      cachedServer = server;
      return server;
    })();
  }

  return serverInitPromise;
}

/**
 * Builds the route configuration for protected product research.
 */
export function getProductResearchRouteConfig() {
  return {
    accepts: {
      scheme: "exact" as const,
      price: DEFAULT_RESEARCH_PRICE,
      network: X402_NETWORK,
      payTo: getSellerAddress(),
    },
    description: "Intora Deep Product Intelligence & Price Analytics",
  };
}

/**
 * Higher-order function to protect an App Router route with x402.
 */
export function createProtectedResearchHandler<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const server = await getX402ResourceServer();
    const config = getProductResearchRouteConfig();

    const wrapped = withX402(
      handler,
      config,
      server,
      undefined,
      undefined,
      false // do not sync synchronously during module import
    );

    return wrapped(request);
  };
}
