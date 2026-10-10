import { BASE_SEPOLIA_CHAIN_ID, DEFAULT_BASE_SEPOLIA_RPC } from "./contract-config";

export const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34"; // 84532 in hex

export const BASE_SEPOLIA_NETWORK_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
  chainName: "Base Sepolia Testnet",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [
    DEFAULT_BASE_SEPOLIA_RPC,
    "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.base.org",
  ],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

/**
 * Checks if MetaMask / an Ethereum provider is available in window.
 */
export function isMetaMaskAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/**
 * Triggers the MetaMask popup to switch to Base Sepolia Testnet (84532).
 * If Base Sepolia has not been added to MetaMask yet, prompts to add it first.
 */
export async function promptSwitchToBaseSepolia(): Promise<boolean> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not detected. Please install the MetaMask browser extension.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: any) {
    // 4902 error code: chain not added to MetaMask
    const isUnrecognized =
      switchError.code === 4902 ||
      switchError?.data?.originalError?.code === 4902 ||
      switchError?.message?.includes("wallet_addEthereumChain") ||
      switchError?.message?.includes("Unrecognized chain");

    if (isUnrecognized) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [BASE_SEPOLIA_NETWORK_PARAMS],
      });
      return true;
    }
    throw switchError;
  }
}

/**
 * Requests accounts from MetaMask (pops up MetaMask account picker)
 * and immediately ensures the wallet is active on Base Sepolia Testnet
 * (pops up network switch/addition dialog if not currently on Base Sepolia).
 */
export async function connectMetaMaskOnTestnet(): Promise<{
  account: string;
  chainId: number;
}> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not detected. Please install the MetaMask extension.");
  }

  // 1. Popup MetaMask to request account access
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts selected in MetaMask.");
  }

  // 2. Query current chain
  const chainHex = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;
  let currentChainId = parseInt(chainHex, 16);

  // 3. If not on Base Sepolia, popup MetaMask to switch/add Base Sepolia Testnet
  if (currentChainId !== BASE_SEPOLIA_CHAIN_ID) {
    await promptSwitchToBaseSepolia();
    currentChainId = BASE_SEPOLIA_CHAIN_ID;
  }

  return {
    account: accounts[0],
    chainId: currentChainId,
  };
}
