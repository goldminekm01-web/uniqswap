import { createConfig, http, injected } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

export { mainnet, sepolia };

// ---------------------------------------------------------------------------
// Wallet detection helpers
// ---------------------------------------------------------------------------

/**
 * Detect Phantom Wallet.
 *
 * Phantom is primarily a Solana wallet, but it also supports Ethereum
 * (EVM) through its own injected provider. Phantom can expose the EVM
 * provider in two ways:
 *
 * 1. `window.phantom.ethereum`  — Phantom's dedicated EVM provider (preferred)
 * 2. `window.ethereum.isPhantom` — Phantom sharing window.ethereum with
 *    other injected wallets (e.g. MetaMask)
 *
 * @returns The Phantom EVM provider, or null if not available.
 */
export function getPhantomProvider(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  // Primary: Phantom's dedicated EVM provider (some versions don't set isPhantom flag)
  if (w.phantom && w.phantom.ethereum) {
    return w.phantom.ethereum;
  }
  // Secondary: Phantom sharing window.ethereum with isPhantom flag
  if (w.ethereum && w.ethereum.isPhantom) {
    return w.ethereum;
  }
  return null;
}

/**
 * Detect Phantom Wallet.
 *
 * Phantom is primarily a Solana wallet. We check for
 * `window.phantom.solana` first — this is always available when
 * Phantom is installed, regardless of EVM settings.
 *
 * Phantom's EVM provider (window.phantom.ethereum) is still checked
 * as a secondary signal for display purposes, but Phantom is ALWAYS
 * connected via its Solana provider — never via wagmi/EVM.
 */
export function isPhantomInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  // Primary: Phantom Solana provider (always present when Phantom is installed)
  if (w.phantom && w.phantom.solana) return true;
  // Secondary: Phantom EVM provider (for detection only, not used for connection)
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

/**
 * Detect Uniswap Wallet (browser extension).
 * Uniswap Wallet injects its own EVM provider. We check for
 * `window.ethereum.isUniswap` — if not present, fall back to
 * checking the provider's `isUniswap` flag.
 */
export function isUniswapWalletInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w?.ethereum?.isUniswap) || Boolean(w?.uniswap?.ethereum);
}

/**
 * Get the Uniswap Wallet EVM provider for connector creation.
 */
export function getUniswapWalletProvider(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (w?.ethereum?.isUniswap) return w.ethereum;
  if (w?.uniswap?.ethereum) return w.uniswap.ethereum;
  return null;
}

/**
 * Detect if the user is on a mobile device.
 *
 * On mobile, wallet apps (Phantom, MetaMask, Uniswap Wallet) do NOT inject
 * their provider into the browser. Instead, they use deep links (universal
 * links) to open their in-app browser, where the provider IS injected.
 *
 * This detection allows the connect flow to switch to deep-link mode on
 * mobile devices.
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Build the deep-link URL for opening a wallet app on mobile.
 *
 * Each wallet has a universal link format:
 * - Phantom:  https://phantom.app/ul/v1/connect?redirect=<URL>
 * - MetaMask:  https://metamask.app.link/dapp/<URL>
 * - Uniswap:  https://uniswap.app.link/dapp/<URL>
 *
 * After the user approves the connection in the wallet app, the wallet opens
 * its in-app browser at the `redirect` URL, where the wallet provider is
 * injected and connection completes normally.
 */
export function getWalletDeepLink(walletId: string, redirectUrl?: string): string | undefined {
  const origin = redirectUrl || (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) return undefined;

  switch (walletId) {
    case "phantom":
      // Custom URL scheme — directly opens Phantom app if installed.
      // User navigates to site within Phantom's Browser tab.
      return `phantom://`;
    case "metamask":
      // Custom URL scheme — opens MetaMask's in-app browser directly at the dApp URL.
      return `metamask://dapp/${encodeURIComponent(origin)}`;
    case "uniswap":
      // Custom URL scheme — opens Uniswap Wallet's in-app browser at the dApp URL.
      return `uniswap://dapp/${encodeURIComponent(origin)}`;
    default:
      return undefined;
  }
}

export function isAnyWalletInstalled(): boolean {
  return (
    typeof window !== "undefined" &&
    (Boolean(window?.ethereum) || Boolean((window as any).phantom?.solana))
  );
}

/**
 * Detect Phantom's Solana provider for SPL token balance queries.
 * Phantom exposes its Solana provider at `window.phantom.solana`.
 */
export function getPhantomSolanaProvider(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).phantom?.solana ?? null;
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

/**
 * Build an array of available EVM connectors.
 *
 * Phantom is NOT included here — Phantom is handled as a pure Solana
 * wallet via window.phantom.solana in the WalletConnectButton component.
 * Only MetaMask is available as an EVM connector.
 */
function getConnectors() {
  const connectors = [
    injected({
      target: "metaMask",
    }),
  ];

  return connectors;
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