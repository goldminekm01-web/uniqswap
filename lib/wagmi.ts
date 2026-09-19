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