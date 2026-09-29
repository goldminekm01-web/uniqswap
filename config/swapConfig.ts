/**
 * Swap Configuration
 * ===================
 * Central configuration for the Uniswap Web3 swap interface.
 * All token addresses, network settings, token metadata, and USD prices
 * are defined here so they can be easily changed without touching component code.
 *
 * Tokens supported (normal pairs like known exchanges):
 *   - ETH  (native, Ethereum mainnet)
 *   - USDT (ERC-20, Ethereum mainnet)
 *   - USDC (ERC-20, Ethereum mainnet)
 *   - DAI  (ERC-20, Ethereum mainnet)
 *   - WBTC (ERC-20, Ethereum mainnet)
 *   - BT-c (SPL, Solana — balance read via Phantom Solana provider)
 *
 * Exchange rates are derived from each token's `usdPrice`:
 *   rate(from -> to) = usdPrice[from] / usdPrice[to]
 * These are fixed educational rates — edit here to change.
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
  /** Educational USD price used to derive exchange rates between any two tokens. */
  usdPrice: number;
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
    /** Solana JSON-RPC endpoint */
    solanaRpcUrl: string;
    /** Solana Token-2022 program ID */
    token2022ProgramId: string;
    /** Solana legacy SPL Token program ID */
    tokenLegacyProgramId: string;
  };
  tokens: {
    eth: TokenConfig;
    usdt: TokenConfig;
    usdc: TokenConfig;
    dai: TokenConfig;
    wbtc: TokenConfig;
    btc: TokenConfig;
  };
  /**
   * Exchange configuration.
   * Rates are derived from each token's `usdPrice` (see getExchangeRate).
   */
  exchange: {
    /** Slippage tolerance in percent */
    slippageTolerance: number;
    /** Transaction deadline in minutes */
    transactionDeadlineMinutes: number;
  };
  /** Virtual pool size used for price-impact simulation (educational) */
  virtualPoolLiquidity: {
    eth: number;
    usdt: number;
    usdc: number;
    dai: number;
    wbtc: number;
    btc: number;
  };
  walletConnect: {
    projectId: string;
  };
}

export const SWAP_CONFIG: SwapConfig = {
  app: {
    name: "Uniswap",
    version: "1.0.0",
    description: "Web3 swap interface for normal token pairs (ETH, USDT, USDC, DAI, WBTC)",
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
    /** Solana JSON-RPC endpoint (public mainnet-beta) */
    solanaRpcUrl: "https://api.mainnet-beta.solana.com",
    /** Solana Token-2022 program ID */
    token2022ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCxEpPxuEb",
    /** Solana legacy SPL Token program ID */
    tokenLegacyProgramId: "TokenkegQfy2P4DT9Ej6mwoCliNV4z6wN67kEgsyqv9q",
  },
  tokens: {
    eth: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      contractAddress: "",
      icon: "/icons/eth-token.svg",
      isNative: true,
      usdPrice: 3000,
    },
    usdt: {
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      // Real USDT ERC-20 contract on Ethereum mainnet
      contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      icon: "/icons/usdt-token.svg",
      isNative: false,
      usdPrice: 1,
    },
    usdc: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      // Real USDC ERC-20 contract on Ethereum mainnet
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      icon: "/icons/usdc-token.svg",
      isNative: false,
      usdPrice: 1,
    },
    dai: {
      name: "Dai",
      symbol: "DAI",
      decimals: 18,
      // Real DAI ERC-20 contract on Ethereum mainnet
      contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      icon: "/icons/dai-token.svg",
      isNative: false,
      usdPrice: 1,
    },
    wbtc: {
      name: "Wrapped Bitcoin",
      symbol: "WBTC",
      decimals: 8,
      // Real WBTC ERC-20 contract on Ethereum mainnet
      contractAddress: "0x2260FAC5E554396273dC8f959B4534f0E1Db5a3D",
      icon: "/icons/wbtc-token.svg",
      isNative: false,
      usdPrice: 60000,
    },
    btc: {
      name: "BT-c Token",
      symbol: "BT-c",
      decimals: 6,
      // BT-c SPL token on Solana. Mint: 5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ
      // Balance is read via Phantom's Solana provider + Solana RPC.
      contractAddress: "5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ",
      solanaMint: "5ZpyyfccnWuLc99mtX7D2NXPsg5B6DcaLKiYRk1vskAQ",
      chain: "solana",
      tokenProgram: "token-2022",
      icon: "/icons/bt-c-token.svg",
      isNative: false,
      usdPrice: 0.01,
    },
  },
  exchange: {
    slippageTolerance: 0.5, // 0.5%
    transactionDeadlineMinutes: 20,
  },
  virtualPoolLiquidity: {
    eth: 100_000, // 100K ETH
    usdt: 100_000_000, // 100M USDT
    usdc: 100_000_000, // 100M USDC
    dai: 100_000_000, // 100M DAI
    wbtc: 1_000, // 1K WBTC
    btc: 100_000_000, // 100M BT-c
  },
  walletConnect: {
    projectId: "", // Set via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID env var
  },
};

/** All token keys in the system — every token is swappable in either direction. */
export type TokenKey = "eth" | "usdt" | "usdc" | "dai" | "wbtc" | "btc";

/** Tokens that can be swapped FROM. All tokens are swappable. */
export type SwappableTokenKey = TokenKey;

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
  if (addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
}

/**
 * Check whether a string is a valid EVM hex address.
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
