/**
 * Swap Configuration
 * ===================
 * Central configuration for the Uniswap Web3 swap interface.
 * All token addresses, network settings, token metadata, and exchange rates
 * are defined here so they can be easily changed without touching component code.
 *
 * TOKEN: BT-c (SPL) on Solana via Phantom
 *   Mint: 5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ
 *   Name: BT-c Token
 *   Symbol: BT-c
 *   Decimals: 6
 *   No liquidity — balance detected via Phantom Solana provider only
 *
 *   Contract: 0xdac17f958d2ee523a2206206994597c13d831ec7
 *   Name:      Tether USD
 *   Symbol:    USDT
 *   Decimals:  6
 *
 * TOKEN: Ether (ETH) native on Ethereum mainnet
 *   Symbol:    ETH
 *   Decimals:  18
 *
 * The original BT-c Solana address (5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ)
 * is documented below as a reference.
 */

export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: string;
  /** Optional EVM-compatible address for actual contract reads. Falls back to `contractAddress` if not set. */
  evmContractAddress?: string;
  /** Optional Solana SPL token mint address (for non-EVM tokens). */
  solanaMint?: string;
  /** Token chain: 'ethereum' (ERC-20/native) or 'solana' (SPL). */
  chain?: "ethereum" | "solana";
  /** Solana token program: 'token-2022' or 'legacy' (default: 'legacy' for backward compat). */
  tokenProgram?: "token-2022" | "legacy";
  icon: string;
  /** Whether the token is native (ETH) vs an ERC-20 contract */
  isNative?: boolean;
}

export interface SwapConfig {
  app: {
    name: string;
    version: string;
    description: string;
  };
  network: {
    chainId: number;
    chainName: string;
    rpcUrl: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    blockExplorerUrl: string;
    /** Solana blockchain explorer (for Solana SPL token addresses) */
    solanaExplorerUrl: string;
    /** Solana Token-2022 program ID */
    token2022ProgramId: string;
    /** Solana legacy SPL Token program ID */
    tokenLegacyProgramId: string;
  };
  tokens: {
    btc: TokenConfig;
    eth: TokenConfig;
    usdt: TokenConfig;
    ksh: TokenConfig;
  };
  /**
   * Exchange rates: how many KSH you receive for 1 unit of each from-token.
   * Reverse direction (KSH → token) uses 1 / rate.
   * These are fixed educational exchange rates — edit here to change.
   */
  exchange: {
    rates: {
      btc: number;
      eth: number;
      usdt: number;
    };
    /** Slippage tolerance in percent */
    slippageTolerance: number;
  };
  /** Virtual pool size used for price-impact simulation (educational) */
  virtualPoolLiquidity: {
    btc: number;
    eth: number;
    usdt: number;
    ksh: number;
  };
  walletConnect: {
    projectId: string;
  };
}

export const SWAP_CONFIG: SwapConfig = {
  app: {
    name: "Uniswap",
    version: "1.0.0",
    description: "Web3 swap interface for selling native coins to Ksh",
  },
  network: {
    chainId: 1,
    chainName: "Ethereum",
    rpcUrl: "https://eth.llama.fi",
    // Alternative RPC: "https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrl: "https://etherscan.io",
    /** Solana blockchain explorer (for Solana SPL token addresses) */
    solanaExplorerUrl: "https://solscan.io",
    /** Solana Token-2022 program ID */
    token2022ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    /** Solana legacy SPL Token program ID */
    tokenLegacyProgramId: "TokenkegQfy2P4DT9Ej6mwoCliNV4z6wN67kEgsyqv9q",
  },
  tokens: {
    btc: {
      name: "BT-c Token",
      symbol: "BT-c",
      decimals: 6,
      // BT-c SPL token on Solana. Mint: 5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ
      // No liquidity — detected via Phantom's Solana provider, not swappable.
      contractAddress: "5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ",
      solanaMint: "5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ",
      chain: "solana",
      tokenProgram: "token-2022",
      icon: "/icons/bt-c-token.svg",
      isNative: false,
    },
    eth: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      contractAddress: "",
      icon: "/icons/eth-token.svg",
      isNative: true,
    },
    usdt: {
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      // Real USDT ERC-20 contract on Ethereum mainnet
      contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      icon: "/icons/usdt-token.svg",
      isNative: false,
    },
    ksh: {
      name: "KSH Token",
      symbol: "KSH",
      decimals: 18,
      contractAddress: "0x0000000000000000000000000000000000000000",
      icon: "/icons/ksh-token.svg",
      isNative: false,
    },
  },
  exchange: {
    rates: {
      btc: 100,  // 1 BT-c = 100 KSH (educational rate)
      eth: 200000,  // 1 ETH = 200,000 KSH
      usdt: 100,  // 1 USDT = 100 KSH
    },
    slippageTolerance: 0.5, // 0.5%
  },
  virtualPoolLiquidity: {
    btc: 100_000_000,   // 100M BT-c
    eth: 100_000,       // 100K ETH
    usdt: 100_000_000,  // 100M USDT
    ksh: 10_000_000_000, // 10B KSH
  },
  walletConnect: {
    projectId: "", // Set via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var
  },
};

/** Tokens that can be swapped FROM (to KSH). Includes BT-c even though it has no liquidity. */
export type SwappableTokenKey = "btc" | "eth" | "usdt";

/** All token keys in the system. */
export type TokenKey = SwappableTokenKey | "ksh";

/**
 * Original BT-c Solana SPL token mint address (documented for reference).
 * Mint: 5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ
 * BT-c is an SPL token on Solana — balance is read via Phantom's Solana
 * provider + Solana RPC, not via EVM contract calls.
 */
export const ORIGINAL_BTC_SOLANA_ADDRESS = "5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ";

/**
 * Helper: get the effective EVM contract address for a token.
 * Uses evmContractAddress if set, falls back to contractAddress.
 * Returns null for native tokens (ETH).
 */
export function getEvmAddress(token: TokenConfig): string | null {
  if (token.isNative) return null;
  const addr = token.evmContractAddress || token.contractAddress;
  if (!addr) return null;
  // Reject the zero address — it passes regex validation but is not a real contract.
  // This prevents on-chain read errors for simulated tokens like KSH.
  if (addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
}

/**
 * Check whether a string is a valid EVM hex address.
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}