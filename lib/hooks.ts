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
import { useState, useEffect, useCallback } from "react";
import { getPhantomSolanaProvider } from "@/lib/wagmi";

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
      : null;
    const balanceFormatted = balanceRaw !== undefined
      ? formatDisplayBalance(balanceRaw, decimals)
      : null;

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
    : null;

  const balanceFormatted = balanceRaw !== undefined
    ? formatDisplayBalance(balanceRaw, resolvedDecimals)
    : null;

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

  const connect = useCallback(async (onlyIfTrusted = false): Promise<boolean> => {
    const provider = getPhantomSolanaProvider();
    if (!provider) return false;
    setIsLoading(true);
    console.log('[Phantom Solana] connect called, onlyIfTrusted:', onlyIfTrusted, 'provider:', !!provider);
    try {
      const resp = await provider.connect(onlyIfTrusted ? { onlyIfTrusted: true } : undefined);
      const pk =
        resp?.publicKey?.toString() || (resp?.toString() || null);
      console.log('[Phantom Solana] connect succeeded, publicKey:', pk);
      setPublicKey(pk);
      setIsConnected(true);
      return true;
    } catch {
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getPhantomSolanaProvider();
    if (provider) {
      try {
        await provider.disconnect();
      } catch {}
    }
    setIsConnected(false);
    setPublicKey(null);
  }, []);

  // On mount: check if already connected (from a previous session)
  // Also handle async Phantom provider injection (Phantom may inject after first render)
  useEffect(() => {
    const checkConnected = () => {
      const provider = getPhantomSolanaProvider();
      if (provider?.isConnected) {
        setIsConnected(true);
        setPublicKey(provider.publicKey?.toString() || null);
      }
    };
    checkConnected();
    // Phantom may inject its provider asynchronously after page load
    const interval = setInterval(() => {
      checkConnected();
    }, 500);
    setTimeout(() => clearInterval(interval), 5000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected, publicKey, isLoading, connect, disconnect };
}

/**
 * Query the SPL token balance for a Solana SPL token (e.g. BT-c)
 * via Phantom's Solana provider and the Solana JSON RPC API.
 *
 * Does NOT require wagmi's EVM `isConnected` — users can view
 * their SLP token balances through Phantom's Solana provider
 * without having to enable Phantom's EVM mode.
 */
export function useSolanaTokenBalance(mintAddress: string, tokenProgram?: "token-2022" | "legacy") {
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceFormatted, setBalanceFormatted] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mintAddress) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchBalance = async () => {
      try {
        const solanaProvider = getPhantomSolanaProvider();
        console.log('[BT-c balance] fetchBalance called, provider:', !!solanaProvider, 'isConnected:', solanaProvider?.isConnected);
        if (!solanaProvider) {
          if (!cancelled) {
            setBalance('0');
            setBalanceFormatted('0');
            setIsLoading(false);
          }
          return;
        }

        // Connect silently if not already connected (EVM-free Phantom Solana)
        if (!solanaProvider.isConnected) {
          try {
            console.log('[BT-c balance] Trying silent connect...');
            await solanaProvider.connect({ onlyIfTrusted: true });
            console.log('[BT-c balance] Silent connect succeeded');
          } catch {
            console.log('[BT-c balance] Silent connect failed (not previously approved)');
            // User not connected to Phantom Solana — balance unavailable
            if (!cancelled) {
              setBalance('0');
              setBalanceFormatted('0');
              setIsLoading(false);
            }
            return;
          }
        }

        console.log('[BT-c balance] Querying token accounts for mint:', mintAddress);
        // Query SPL token balance via Phantom's Solana provider.
        // Use Token-2022 program ID for Token-2022 tokens, or legacy program
        // for traditional SPL tokens. This ensures correct ATA derivation.
        let accounts: any[] = [];
        if (typeof solanaProvider.request === 'function') {
          const programId =
            tokenProgram === 'token-2022'
              ? SWAP_CONFIG.network.token2022ProgramId
              : tokenProgram === 'legacy'
                ? SWAP_CONFIG.network.tokenLegacyProgramId
                : undefined;

          try {
            const result = await solanaProvider.request({
              method: 'getTokenLargestAccounts',
              params: [{ mint: mintAddress, programId }],
            });
            accounts = result?.value || result?.result?.value || [];
          } catch {
            accounts = [];
          }

          // Fallback: if Token-2022 program found nothing, try legacy program
          if (tokenProgram === 'token-2022' && accounts.length === 0) {
            try {
              const result2 = await solanaProvider.request({
                method: 'getTokenLargestAccounts',
                params: [{ mint: mintAddress, programId: SWAP_CONFIG.network.tokenLegacyProgramId }],
              });
              accounts = result2?.value || result2?.result?.value || [];
            } catch {
              // Keep existing accounts (empty)
            }
          }

          // If no programId specified, try both programs (auto-detect)
          if (!programId && accounts.length === 0) {
            for (const pid of [SWAP_CONFIG.network.token2022ProgramId, SWAP_CONFIG.network.tokenLegacyProgramId]) {
              try {
                const resultP = await solanaProvider.request({
                  method: 'getTokenLargestAccounts',
                  params: [{ mint: mintAddress, programId: pid }],
                });
                const found = resultP?.value || resultP?.result?.value || [];
                if (found.length > 0) {
                  accounts = found;
                  break;
                }
              } catch {
                // Continue to next program
              }
            }
          }
        }

        if (accounts && accounts.length > 0) {
          const tokenAmount = accounts[0].amount || accounts[0].uiAmount || '0';
          const rawAmount = typeof tokenAmount === 'string'
            ? parseInt(tokenAmount, 10)
            : Math.round(Number(tokenAmount));
          const decimals = parseInt(accounts[0].decimals || '6', 10) || 6;

        console.log('[BT-c balance] Account found, amount:', tokenAmount, 'decimals:', decimals);
          if (!cancelled) {
            const formatted = (rawAmount / Math.pow(10, decimals)).toFixed(decimals);
            console.log('[BT-c balance] Balance set:', formatted);
            setBalance(String(rawAmount));
            setBalanceFormatted(formatted);
          }
        } else {
          console.log('[BT-c balance] No accounts found for mint:', mintAddress);
          if (!cancelled) {
            setBalance('0');
            setBalanceFormatted('0');
          }
        }

        if (!cancelled) setIsLoading(false);
      } catch (err) {
        console.log('[BT-c balance] Error in fetchBalance:', err instanceof Error ? err.message : String(err));
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setBalance('0');
          setBalanceFormatted('0');
          setIsLoading(false);
        }
      }
    };

    void fetchBalance();

    // Listen for Phantom Solana provider connect events.
    // This allows the balance to be re-fetched when the user connects via
    // the Phantom Solana provider in WalletConnectButton (without requiring
    // wagmi EVM connection state to change).
    const provider = getPhantomSolanaProvider();
    const handleProviderConnect = () => {
      console.log('[BT-c balance] on(connect) event fired');
      if (!cancelled) void fetchBalance();
    };

    // Try to get provider and register listeners immediately.
    // Phantom injects its Solana provider asynchronously — it may not be
    // available on the first render. If not available, poll until it appears.
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const tryRegister = (): boolean => {
      const p = getPhantomSolanaProvider();
      if (p && p.on) {
        console.log('[BT-c balance] Registering event listeners on provider');
        try { p.on('connect', handleProviderConnect); } catch {}
        try { p.on('accountChanged', handleProviderConnect); } catch {}
        return true;
      }
      return false;
    };

    console.log('[BT-c balance] Registering event listeners on provider:', !!getPhantomSolanaProvider());
    let registered = tryRegister();
    if (!registered) {
      // Provider not available yet — poll every 500ms, up to 15s
      console.log('[BT-c balance] Provider not available yet — polling...');
      pollInterval = setInterval(() => {
        if (cancelled) return;
        if (tryRegister()) {
          if (pollInterval) clearInterval(pollInterval);
          // Re-run fetchBalance now that provider + listeners are available
          void fetchBalance();
        }
      }, 500);
      // Safety: stop polling after 15 seconds
      setTimeout(() => {
        if (pollInterval && !cancelled) clearInterval(pollInterval);
      }, 15000);
    }

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      const p = getPhantomSolanaProvider();
      if (p?.removeListener) {
        try { p.removeListener('connect', handleProviderConnect); } catch {}
        try { p.removeListener('accountChanged', handleProviderConnect); } catch {}
      }
    };
  }, [mintAddress, tokenProgram]);

  return {
    balance,
    balanceFormatted,
    isLoading,
    error,
  };
}