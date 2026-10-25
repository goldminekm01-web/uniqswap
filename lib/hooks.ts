"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { ERC20_ABI } from "@/lib/abis";
import {
  SWAP_CONFIG,
  getEvmAddress,
  isValidEvmAddress,
} from "@/config/swapConfig";
import { formatBalance, formatDisplayBalance } from "@/lib/utils";
import type { DetectedTokenInfo, TokenConfig } from "@/types";
import type { TokenKey } from "@/lib/swap";
import { useState, useEffect, useCallback, useRef } from "react";
import { getPhantomProvider } from "@/lib/wagmi";

/**
 * Fetch on-chain token data (name, symbol, decimals, balance)
 * for the configured ERC-20 token.
 *
 * Uses wagmi's useReadContract to query the standard ERC-20
 * functions: name(), symbol(), decimals(), balanceOf().
 *
 * For native tokens (ETH), uses wagmi's useBalance hook instead
 * and fills metadata from the config.
 *
 * Falls back to config values when the contract address is not
 * a valid EVM address (e.g., a Solana SPL address was provided).
 */
export function useTokenInfo(tokenKey: TokenKey): DetectedTokenInfo {
  const { address, isConnected } = useAccount();
  const token: TokenConfig = SWAP_CONFIG.tokens[tokenKey];

  const evmAddress = getEvmAddress(token);
  const isEvmValid = evmAddress ? isValidEvmAddress(evmAddress) : false;
  const addressUsed = evmAddress || token.contractAddress || "";

  // --- Native ETH handling ---
  if (token.isNative) {
    const { data: ethBalanceData, isLoading: isBalanceLoading, refetch: refetchBalance } =
      useBalance({
        address: isConnected ? address : undefined,
      });

    const balanceRaw = ethBalanceData?.value;
    const decimals = token.decimals;

    const balance = balanceRaw !== undefined
      ? formatBalance(balanceRaw, decimals)
      : isConnected ? "0" : null;
    const balanceFormatted = balanceRaw !== undefined
      ? formatDisplayBalance(balanceRaw, decimals)
      : isConnected ? "0" : null;

    return {
      name: token.name,
      symbol: token.symbol,
      decimals,
      balance: balance !== null ? String(balance) : null,
      balanceFormatted: balanceFormatted !== null ? String(balanceFormatted) : null,
      isLoading: isBalanceLoading && isConnected,
      error: null,
      addressUsed,
      isEvmValid: true, // native ETH is always "valid" for balance queries
      refetch: refetchBalance,
    };
  }

  // --- Solana SPL token handling (e.g. BT-c) ---
  if (token.chain === "solana") {
    const { balance: solanaBalance, balanceFormatted: solanaBalanceFormatted, isLoading: solanaLoading, error: solanaError } =
      useSolanaTokenBalance(token.solanaMint || token.contractAddress, token.tokenProgram);

    const resolvedDecimals = token.decimals;
    return {
      name: token.name,
      symbol: token.symbol,
      decimals: resolvedDecimals,
      balance: solanaBalance,
      balanceFormatted: solanaBalanceFormatted,
      isLoading: solanaLoading,
      error: solanaError,
      addressUsed: token.contractAddress || "",
      isEvmValid: false,
      refetch: () => {},
    };
  }

  // --- ERC-20 token handling ---
  const shouldRead = isConnected && isEvmValid && !!address;

  const contractAddress = isEvmValid
    ? (addressUsed as `0x${string}`)
    : undefined;

  // Read token name
  const {
    data: name,
    isPending: isPendingName,
    error: nameError,
  } = useReadContract({
    abi: ERC20_ABI,
    address: contractAddress,
    functionName: "name",
    query: {
      enabled: shouldRead,
    },
  });

  // Read token symbol
  const {
    data: symbol,
    isPending: isPendingSymbol,
    error: symbolError,
  } = useReadContract({
    abi: ERC20_ABI,
    address: contractAddress,
    functionName: "symbol",
    query: {
      enabled: shouldRead,
    },
  });

  // Read token decimals
  const {
    data: decimals,
    isPending: isPendingDecimals,
    error: decimalsError,
  } = useReadContract({
    abi: ERC20_ABI,
    address: contractAddress,
    functionName: "decimals",
    query: {
      enabled: shouldRead,
    },
  });

  // Read wallet balance
  const {
    data: balanceRaw,
    isPending: isPendingBalance,
    refetch: refetchBalance,
    error: balanceError,
  } = useReadContract({
    abi: ERC20_ABI,
    address: contractAddress,
    functionName: "balanceOf",
    args: isConnected && isEvmValid ? [address as `0x${string}`] : undefined,
    query: {
      enabled: shouldRead,
    },
  });

  const isLoading =
    isPendingName || isPendingSymbol || isPendingDecimals || isPendingBalance;

  const firstError = nameError || symbolError || decimalsError || balanceError;
  const error = firstError ? (firstError as Error).message ?? "Unknown error" : null;

  const resolvedDecimals = decimals !== undefined ? Number(decimals) : token.decimals;

  const balance = balanceRaw !== undefined
    ? formatBalance(balanceRaw, resolvedDecimals)
    : isConnected ? "0" : null;

  const balanceFormatted = balanceRaw !== undefined
    ? formatDisplayBalance(balanceRaw, resolvedDecimals)
    : isConnected ? "0" : null;

  return {
    name: name !== undefined ? String(name) : null,
    symbol: symbol !== undefined ? String(symbol) : token.symbol,
    decimals: resolvedDecimals,
    balance: balance !== null ? String(balance) : null,
    balanceFormatted: balanceFormatted !== null ? String(balanceFormatted) : null,
    isLoading,
    error,
    addressUsed,
    isEvmValid,
    refetch: refetchBalance,
  };
}

/**
 * Hook to detect if MetaMask is installed in the browser.
 */
export function useMetaMaskDetection() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInstalled(Boolean(window.ethereum?.isMetaMask));
    }
  }, []);

  return { isInstalled };
}

/**
 * Hook to manage Phantom Solana provider connection state.
 *
 * Phantom is primarily a Solana wallet. Users may have Phantom's Solana
 * provider available without Phantom's EVM (Ethereum) provider enabled.
 * This hook tracks Solana-only connections so the UI can show SLP token
 * balances without requiring the user to enable Phantom EVM mode.
 */
export function usePhantomSolana() {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Track when a mobile deep-link connection is pending (Phantom app opened,
  // provider not yet available in the in-app browser). Enables 500 BT-c fallback.
  const [isMobilePending, setIsMobilePending] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  // Prevent syncState() from overriding a user-initiated disconnect when
  // Phantom's provider.isConnected hasn't updated yet (it lags behind).
  const userDisconnectedRef = useRef(false);

  const connect = useCallback(async (onlyIfTrusted = false): Promise<boolean> => {
    userDisconnectedRef.current = false;
    const provider = getPhantomProvider();
    if (!provider) return false;
    setIsLoading(true);
    try {
      // Request the 'solana:rpc' feature so that provider.request() supports
      // standard Solana JSON-RPC methods (getTokenAccountsByOwner, etc.)
      // without needing a separate fetch() call (which Phantom's extension
      // content script can block).
      const connectOpts: any = { features: ['solana:rpc'] };
      if (onlyIfTrusted) connectOpts.onlyIfTrusted = true;
      const resp = await provider.connect(connectOpts);
      const pk =
        resp?.publicKey?.toString() || (resp?.toString() || null);
      setPublicKey(pk);
      setIsConnected(true);
      setIsMobilePending(false);
      return true;
    } catch (err: any) {
      // Phantom may not support 'features' option — retry without it
      try {
        const resp = await provider.connect(onlyIfTrusted ? { onlyIfTrusted: true } : undefined);
        const pk = resp?.publicKey?.toString() || (resp?.toString() || null);
        setPublicKey(pk);
        setIsConnected(true);
        setIsMobilePending(false);
        return true;
      } catch {
        setIsConnected(false);
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
    setIsDisconnecting(true);
    setIsConnected(false);
    setPublicKey(null);
    setIsMobilePending(false);
    const provider = getPhantomProvider();
    if (provider) {
      try {
        const result = provider.disconnect();
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {}
    }
    // Reset disconnecting state after Phantom has had time to process
    setTimeout(() => setIsDisconnecting(false), 800);
  }, []);

  /**
   * Called when the user clicks Phantom on mobile and the provider is not
   * available (Phantom app will open via deep link). This optimistically
   * sets the connection state so that the 500 BT-c fallback is displayed
   * immediately, without waiting for Phantom's in-app browser to reconnect.
   *
   * When Phantom's browser opens the site, the `syncState()` in the useEffect
   * below will detect the real provider and upgrade the connection.
   */
  const initiateMobilePhantomConnect = useCallback(() => {
    setIsMobilePending(true);
    setIsConnected(true);
    setPublicKey(null);
  }, []);

  // On mount: check if already connected (from a previous session)
  // Also handle async Phantom provider injection (Phantom may inject after first render)
  useEffect(() => {
    const syncState = () => {
      // Don't let polling/sync override a user-initiated disconnect.
      // Phantom's provider.isConnected may lag by 500ms-15s, causing
      // syncState to falsely reconnect the user right after they disconnect.
      if (userDisconnectedRef.current) return;
      const provider = getPhantomProvider();
      if (provider?.isConnected || provider?.publicKey) {
        setIsConnected(true);
        setPublicKey(provider.publicKey?.toString() || null);
        setIsMobilePending(false);
      }
    };
    syncState();

    // Register Phantom native event listeners so ALL usePhantomSolana instances
    // (Header, SwapCard, useSolanaTokenBalance, etc.) update immediately when
    // the user connects/disconnects — not just via 5s polling which may expire
    // before the user approves the connection.
    const handleConnect = () => {
      userDisconnectedRef.current = false;
      setIsDisconnecting(false);
      const provider = getPhantomProvider();
      setIsConnected(true);
      setPublicKey(provider?.publicKey?.toString() || null);
    };
    const handleDisconnect = () => {
      userDisconnectedRef.current = true;
      setIsConnected(false);
      setPublicKey(null);
    };
    const handleAccountChanged = (pk: any) => {
      if (pk) {
        setIsConnected(true);
        setPublicKey(pk?.toString?.() || String(pk));
      } else {
        setIsConnected(false);
        setPublicKey(null);
      }
    };

    const tryRegister = (): boolean => {
      const p = getPhantomProvider();
      if (p && p.on) {
        try { p.on('connect', handleConnect); } catch {}
        try { p.on('disconnect', handleDisconnect); } catch {}
        try { p.on('accountChanged', handleAccountChanged); } catch {}
        return true;
      }
      return false;
    };

    let registered = tryRegister();
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (!registered) {
      // Phantom injects its provider asynchronously — poll until it appears
      pollInterval = setInterval(() => {
        if (tryRegister()) {
          if (pollInterval) clearInterval(pollInterval);
          syncState(); // Re-check connection state now that provider is available
        }
      }, 500);
      // Stop polling after 15 seconds
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          tryRegister(); // Final attempt
          syncState();
        }
      }, 15000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      const p = getPhantomProvider();
      if (p?.removeListener) {
        try { p.removeListener('connect', handleConnect); } catch {}
        try { p.removeListener('disconnect', handleDisconnect); } catch {}
        try { p.removeListener('accountChanged', handleAccountChanged); } catch {}
      } else if (p?.off) {
        try { p.off('connect', handleConnect); } catch {}
        try { p.off('disconnect', handleDisconnect); } catch {}
        try { p.off('accountChanged', handleAccountChanged); } catch {}
      }
    };
  }, []);

  return { isConnected, publicKey, isLoading, isDisconnecting, connect, disconnect, initiateMobilePhantomConnect, isMobilePending };
}

const SOLANA_TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCxEpPxuEb";
const SOLANA_TOKEN_LEGACY_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SOLANA_RPC_URLS = [
  SWAP_CONFIG.network.solanaRpcUrl,
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

function toSolanaPubkey(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.length >= 32) return value;
  const obj = value as { toBase58?: () => string; toString?: () => string };
  if (typeof obj.toBase58 === "function") {
    try {
      const encoded = obj.toBase58();
      if (encoded && encoded !== "[object Object]") return encoded;
    } catch {
      // ignore
    }
  }
  if (typeof obj.toString === "function") {
    const encoded = obj.toString();
    if (encoded && encoded !== "[object Object]") return encoded;
  }
  return null;
}

function unwrapTokenAccounts(result: unknown): unknown[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  const record = result as {
    value?: unknown;
    result?: { value?: unknown };
  };
  if (Array.isArray(record.value)) return record.value;
  if (Array.isArray(record.result?.value)) return record.result.value;
  return [];
}

function sumMintBalance(
  rawAccounts: unknown[],
  mintAddress: string,
): { amount: bigint; decimals: number } | null {
  let total = 0n;
  let decimals = 6;
  let found = false;

  for (const account of rawAccounts) {
    const info = (account as {
      account?: { data?: { parsed?: { info?: {
        mint?: string;
        tokenAmount?: { amount?: string; decimals?: number };
      } } } };
    })?.account?.data?.parsed?.info;
    if (!info) continue;
    if (info.mint && info.mint !== mintAddress) continue;
    const tokenAmount = info.tokenAmount;
    if (!tokenAmount?.amount) continue;
    found = true;
    decimals = Number(tokenAmount.decimals ?? 6);
    try {
      total += BigInt(tokenAmount.amount);
    } catch {
      // skip malformed amount
    }
  }

  return found ? { amount: total, decimals } : null;
}

async function rpcGetTokenAccountsByOwner(
  owner: string,
  filter: { mint: string } | { programId: string },
  provider?: { request?: (args: { method: string; params: unknown[] }) => Promise<unknown> },
): Promise<unknown[]> {
  const params = [owner, filter, { encoding: "jsonParsed" as const }];

  if (typeof provider?.request === "function") {
    try {
      const result = await provider.request({
        method: "getTokenAccountsByOwner",
        params,
      });
      const accounts = unwrapTokenAccounts(result);
      if (accounts.length > 0) return accounts;
    } catch {
      // Fall through to HTTP RPC. Solana RPC rejects filters that include
      // both mint and programId, which some wallets still send.
    }
  }

  for (const url of SOLANA_RPC_URLS) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params,
        }),
      });
      const data = await resp.json();
      if (data?.error) continue;
      const accounts = unwrapTokenAccounts(data?.result ?? data);
      if (Array.isArray(accounts)) return accounts;
    } catch {
      // try next RPC
    }
  }

  return [];
}

/**
 * Query the SPL / Token-2022 balance for Bukkt (BT-c) via Phantom and Solana RPC.
 *
 * Does NOT require wagmi's EVM `isConnected` — users can view
 * their BT-c balance through Phantom's Solana provider
 * without having to enable Phantom EVM mode.
 */
export function useSolanaTokenBalance(mintAddress: string, tokenProgram?: "token-2022" | "legacy") {
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceFormatted, setBalanceFormatted] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected: phantomConnected, publicKey: phantomPubkey } = usePhantomSolana();

  const getProvider = useCallback(() => getPhantomProvider(), []);

  useEffect(() => {
    if (!mintAddress) return;

    let cancelled = false;

    const applyZero = () => {
      setBalance("0");
      setBalanceFormatted("0.00");
      setIsLoading(false);
    };

    const fetchBalance = async () => {
      if (cancelled) return;
      try {
        setIsLoading(true);
        setError(null);

        const solanaProvider = getProvider();
        let solPubkey = phantomPubkey || toSolanaPubkey(solanaProvider?.publicKey);

        if (!solPubkey && solanaProvider && !solanaProvider.isConnected) {
          try {
            const connectResp = await solanaProvider.connect({ onlyIfTrusted: true });
            solPubkey =
              toSolanaPubkey(solanaProvider.publicKey) ||
              toSolanaPubkey(connectResp?.publicKey) ||
              toSolanaPubkey(connectResp);
          } catch {
            if (!cancelled) {
              setBalance(null);
              setBalanceFormatted(null);
              setIsLoading(false);
            }
            return;
          }
        }

        if (!solPubkey) {
          if (!cancelled) {
            setBalance(null);
            setBalanceFormatted(null);
            setIsLoading(false);
          }
          return;
        }

        const preferredProgram =
          tokenProgram === "legacy"
            ? SOLANA_TOKEN_LEGACY_PROGRAM
            : SOLANA_TOKEN_2022_PROGRAM;
        const fallbackProgram =
          preferredProgram === SOLANA_TOKEN_2022_PROGRAM
            ? SOLANA_TOKEN_LEGACY_PROGRAM
            : SOLANA_TOKEN_2022_PROGRAM;

        // Solana RPC allows *either* mint or programId, not both. Token-2022
        // accounts are owned by the Token-2022 program, so query that first
        // and filter to the Bukkt mint client-side.
        let parsed = sumMintBalance(
          await rpcGetTokenAccountsByOwner(
            solPubkey,
            { programId: preferredProgram },
            solanaProvider,
          ),
          mintAddress,
        );

        if (!parsed) {
          parsed = sumMintBalance(
            await rpcGetTokenAccountsByOwner(
              solPubkey,
              { mint: mintAddress },
              solanaProvider,
            ),
            mintAddress,
          );
        }

        if (!parsed) {
          parsed = sumMintBalance(
            await rpcGetTokenAccountsByOwner(
              solPubkey,
              { programId: fallbackProgram },
              solanaProvider,
            ),
            mintAddress,
          );
        }

        if (cancelled) return;

        if (parsed) {
          setBalance(parsed.amount.toString());
          setBalanceFormatted(formatDisplayBalance(parsed.amount, parsed.decimals));
        } else {
          applyZero();
          return;
        }
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          applyZero();
        }
      }
    };

    if (!phantomConnected && !phantomPubkey && !getProvider()?.publicKey) {
      setBalance(null);
      setBalanceFormatted(null);
      setIsLoading(false);
    }

    void fetchBalance();

    const handleProviderConnect = () => {
      if (!cancelled) void fetchBalance();
    };

    const pollInterval = setInterval(() => {
      if (cancelled) return;
      const p = getProvider();
      if (p?.isConnected && p?.publicKey) {
        void fetchBalance();
      }
    }, 15000);

    let registerPoll: ReturnType<typeof setInterval> | null = null;
    const tryRegister = (): boolean => {
      const p = getProvider();
      if (p && p.on) {
        try { p.on("connect", handleProviderConnect); } catch {}
        try { p.on("accountChanged", handleProviderConnect); } catch {}
        return true;
      }
      return false;
    };

    if (!tryRegister()) {
      registerPoll = setInterval(() => {
        if (cancelled) return;
        if (tryRegister() && registerPoll) clearInterval(registerPoll);
      }, 500);
      setTimeout(() => {
        if (registerPoll) clearInterval(registerPoll);
      }, 15000);
    }

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      if (registerPoll) clearInterval(registerPoll);
      const p = getProvider();
      if (p?.removeListener) {
        try { p.removeListener("connect", handleProviderConnect); } catch {}
        try { p.removeListener("accountChanged", handleProviderConnect); } catch {}
      } else if (p?.off) {
        try { p.off("connect", handleProviderConnect); } catch {}
        try { p.off("accountChanged", handleProviderConnect); } catch {}
      }
    };
  }, [mintAddress, tokenProgram, phantomConnected, phantomPubkey, getProvider]);

  return {
    balance,
    balanceFormatted,
    isLoading,
    error,
  };
}