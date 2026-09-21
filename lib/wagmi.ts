import { createConfig, http, injected } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { walletConnect } from "@wagmi/connectors";

export { mainnet, sepolia };

// WalletConnect v2 Project ID (get from https://cloud.walletconnect.com)
const WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "c1b5c5c5c5c5c5c5c5c5c5c5c5c5c5c5";

// ---------------------------------------------------------------------------
// Wallet detection helpers
// ---------------------------------------------------------------------------

export function getPhantomProvider(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (w.phantom && w.phantom.ethereum) return w.phantom.ethereum;
  if (w.ethereum && w.ethereum.isPhantom) return w.ethereum;
  return null;
}

export function isPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.phantom && w.phantom.solana) return true;
  if (w.phantom && w.phantom.ethereum) return true;
  if (w.ethereum && w.ethereum.isPhantom) return true;
  return false;
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== "undefined" && Boolean(window?.ethereum?.isMetaMask);
}

export function isBraveInstalled(): boolean {
  return typeof window !== "undefined" && Boolean(window?.ethereum?.isBraveWallet);
}

export function isBaseWalletInstalled(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window?.ethereum?.isCoinbaseWallet)
  );
}

export function isUniswapWalletInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w?.ethereum?.isUniswap) || Boolean(w?.uniswap?.ethereum);
}

export function getUniswapWalletProvider(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (w?.ethereum?.isUniswap) return w.ethereum;
  if (w?.uniswap?.ethereum) return w.uniswap.ethereum;
  return null;
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
}

export function isInWalletBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.ethereum?.isMetaMask) return true;
  if (w.phantom?.solana) return true;
  if (w.ethereum?.isUniswap) return true;
  if (w.ethereum?.isWalletConnect) return true;
  return false;
}

/**
 * Deep link URLs for when user is outside wallet's in-app browser.
 * Used only as fallback — WalletConnect v2 handles mobile natively.
 */
export function getWalletDeepLink(walletId: string, redirectUrl?: string): string | undefined {
  const origin = redirectUrl || (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) return undefined;

  switch (walletId) {
    case "phantom":
      return `https://phantom.app/ul/v1/connect?redirect=${encodeURIComponent(origin)}`;
    case "metamask":
      return `https://metamask.app.link/dapp/${origin}`;
    case "uniswap":
      return `https://uniswap.app.link/dapp/${origin}`;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

function getConnectors() {
  return [
    injected({ target: "metaMask" }),
    walletConnect({
      projectId: WALLET_CONNECT_PROJECT_ID,
      showQrModal: true,
      qrModalOptions: {
        themeMode: "dark",
      },
    }),
  ];
}

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: getConnectors(),
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
  },
  ssr: true,
});

export default config;