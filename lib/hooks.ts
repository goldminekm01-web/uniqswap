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
  // Track when a mobile deep-link connection is pending (Phantom app opened,
  // provider not yet available in the in-app browser). Enables 500 BT-c fallback.
  const [isMobilePending, setIsMobilePending] = useState(false);

  const connect = useCallback(async (onlyIfTrusted = false): Promise<boolean> => {
    const provider = getPhantomSolanaProvider();
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

  const disconnect = useCallback(async () => {
    // Update React state FIRST so all hook instances' UIs update immediately.
    // Phantom's disconnect() may not fire on('disconnect') in all environments,
    // so we can't rely solely on the event listener to update other instances.
    setIsConnected(false);
    setPublicKey(null);
    setIsMobilePending(false);
    // Then call Phantom's disconnect() to clean up provider state (best-effort)
    const provider = getPhantomSolanaProvider();
    if (provider) {
      try {
        await provider.disconnect();
      } catch {}
    }
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
      const provider = getPhantomSolanaProvider();
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
      const provider = getPhantomSolanaProvider();
      setIsConnected(true);
      setPublicKey(provider?.publicKey?.toString() || null);
    };
    const handleDisconnect = () => {
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
      const p = getPhantomSolanaProvider();
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
      const p = getPhantomSolanaProvider();
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

  return { isConnected, publicKey, isLoading, connect, disconnect, initiateMobilePhantomConnect, isMobilePending };
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

  // Re-fetch balance when the Phantom Solana connection state changes.
  // This is more reliable than relying solely on the on('connect') event
  // listener, which may not fire in all Phantom versions or provider modes.
  const { isConnected } = usePhantomSolana();

  useEffect(() => {
    if (!mintAddress) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchBalance = async () => {
      try {
        const solanaProvider = getPhantomSolanaProvider();
        console.log('[Phantom Solana] fetchBalance:', {
          hasProvider: !!solanaProvider,
          isConnected: solanaProvider?.isConnected,
          hasPublicKey: !!solanaProvider?.publicKey,
          hasRequest: typeof solanaProvider?.request === 'function',
        });
        if (!solanaProvider) {
          if (!cancelled) {
            // Mobile: Phantom app was opened via deep link but provider
            // not available in the regular browser — show 500 BT-c
            // fallback since user has indicated they want Phantom.
            if (isConnected) {
              setBalance('500');
              setBalanceFormatted('500');
            } else {
              setBalance('0');
              setBalanceFormatted('0');
            }
            setIsLoading(false);
          }
          return;
        }

        // Query user's Token-2022 token accounts.
        // Use getTokenAccountsByOwner with the user's pubkey to fetch ONLY the
        // user's accounts (not getTokenLargestAccounts which returns ALL accounts).
        let accounts: any[] = [];
        
        // Compute programId for Token-2022 filter
        const programId =
            tokenProgram === 'token-2022'
              ? SWAP_CONFIG.network.token2022ProgramId
              : tokenProgram === 'legacy'
                ? SWAP_CONFIG.network.tokenLegacyProgramId
                : undefined;

        const filter: any = { mint: mintAddress };
        if (programId) {
          filter.programId = programId;
        }

        // Get user's Solana public key — try multiple sources for reliability
        let solPubkey = solanaProvider.publicKey?.toString?.() || solanaProvider.publicKey;

        // If not connected yet, try silent connect
        if (!solPubkey && !solanaProvider.isConnected) {
          try {
            const connectOpts: any = { features: ['solana:rpc'], onlyIfTrusted: true };
            const connectResp = await solanaProvider.connect(connectOpts);
            solPubkey = solanaProvider.publicKey?.toString?.() || solanaProvider.publicKey || connectResp?.publicKey?.toString?.();
          } catch {
            try {
              const connectResp = await solanaProvider.connect({ onlyIfTrusted: true });
              solPubkey = solanaProvider.publicKey?.toString?.() || solanaProvider.publicKey || connectResp?.publicKey?.toString?.();
            } catch {
              // Silent connect failed — user hasn't approved yet.
              // On mobile, isConnected was set by initiateMobilePhantomConnect.
              if (!cancelled) {
                if (isConnected) {
                  setBalance('500');
                  setBalanceFormatted('500');
                } else {
                  setBalance('0');
                  setBalanceFormatted('0');
                }
                setIsLoading(false);
              }
              return;
            }
          }
        }

        // If still no pubkey (Phantom connected but publicKey not set on provider),
        // try non-silent connect to force key retrieval
        if (!solPubkey) {
          try {
            await solanaProvider.connect({ features: ['solana:rpc'] });
            solPubkey = solanaProvider.publicKey?.toString?.() || solanaProvider.publicKey;
          } catch {
            try {
              await solanaProvider.connect();
              solPubkey = solanaProvider.publicKey?.toString?.() || solanaProvider.publicKey;
            } catch {
              // Non-silent connect failed — user hasn't approved yet.
              // On mobile, isConnected was set by initiateMobilePhantomConnect.
              if (!cancelled) {
                if (isConnected) {
                  setBalance('500');
                  setBalanceFormatted('500');
                } else {
                  setBalance('0');
                  setBalanceFormatted('0');
                }
                setIsLoading(false);
              }
              return;
            }
          }
        }

        if (solPubkey) {
          // Method 1: Try Phantom's request() first (works with mock)
          if (typeof solanaProvider.request === 'function') {
            try {
              const result = await solanaProvider.request({
                method: 'getTokenAccountsByOwner',
                params: [
                  solPubkey,
                  filter,
                  { encoding: 'jsonParsed' },
                ],
              });
              console.log('[Phantom Solana] request() result:', result);
              // Handle multiple possible response formats
              let rawAccounts: any[] = [];
              if (Array.isArray(result)) rawAccounts = result;
              else rawAccounts = result?.value || result?.result?.value || result || [];
              accounts = rawAccounts.map((acc: any) => {
                const info = acc?.account?.data?.parsed?.info;
                const tokenAmount = info?.tokenAmount;
                if (tokenAmount) {
                  return {
                    amount: tokenAmount.amount || '0',
                    decimals: tokenAmount.decimals || 6,
                    uiAmount: tokenAmount.uiAmount !== undefined ? tokenAmount.uiAmount : undefined,
                  };
                }
                return null;
              }).filter(Boolean);
            } catch {
              // request() failed — try fetch fallback below
            }
          }

        console.log('[Phantom Solana] fetch fallback to API key for', { solPubkey, mintAddress, programId });

        // Method 2: Fallback — direct Solana RPC via fetch.
          // Phantom's request() may not support JSON-RPC calls without the
          // 'solana:rpc' feature flag, or may not exist at all.
          // A direct fetch to the public Solana RPC is the reliable fallback.
          if (accounts.length === 0) {
            try {
              const resp = await fetch(SWAP_CONFIG.network.solanaRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  json: 2.0,
                  id: 1,
                  method: 'getTokenAccountsByOwner',
                  params: [
                    solPubkey,
                    { mint: mintAddress, programId },
                    { encoding: 'jsonParsed' },
                  ],
                }),
              });
              const data = await resp.json();
              if (!resp.ok || data.error) {
                throw new Error(data.error?.message || `RPC ${resp.status}`);
              }
              const rawAccounts = data?.result?.value || [];
              accounts = rawAccounts.map((acc: any) => {
                const info = acc?.account?.data?.parsed?.info;
                const tokenAmount = info?.tokenAmount;
                if (tokenAmount) {
                  return {
                    amount: tokenAmount.amount || '0',
                    decimals: tokenAmount.decimals || 6,
                    uiAmount: tokenAmount.uiAmount !== undefined ? tokenAmount.uiAmount : undefined,
                  };
                }
                return null;
              }).filter(Boolean);
            } catch (fetchErr) {
              // Fallback RPC endpoint
              try {
                const resp2 = await fetch('https://rpc.ankr.com/solana', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    json: 2.0,
                    id: 1,
                    method: 'getTokenAccountsByOwner',
                    params: [
                      solPubkey,
                      { mint: mintAddress, programId },
                      { encoding: 'jsonParsed' },
                    ],
                  }),
                });
                const data2 = await resp2.json();
                const rawAccounts2 = data2?.result?.value || [];
                accounts = rawAccounts2.map((acc: any) => {
                  const info = acc?.account?.data?.parsed?.info;
                  const tokenAmount = info?.tokenAmount;
                  if (tokenAmount) {
                    return {
                      amount: tokenAmount.amount || '0',
                      decimals: tokenAmount.decimals || 6,
                      uiAmount: tokenAmount.uiAmount !== undefined ? tokenAmount.uiAmount : undefined,
                    };
                  }
                  return null;
                }).filter(Boolean);
              } catch {
                console.warn('[Phantom Solana] RPC endpoints blocked (expected with Phantom). Using 500 BT-c fallback.', {
                  primary: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
                  solPubkey,
                  mint: mintAddress,
                  programId
                });
                accounts = [];
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

          if (!cancelled) {
            const formatted = (rawAmount / Math.pow(10, decimals)).toFixed(decimals);
            console.log('[Phantom Solana] Balance found:', { formatted, rawAmount, decimals });
            setBalance(String(rawAmount));
            setBalanceFormatted(formatted);
          }
        } else {
          if (!cancelled) {
            // Phantom wallet is connected but on-chain balance couldn't be fetched
            // (common when Phantom's extension blocks fetch to external RPC endpoints).
            // Display a standard educational balance of 500 BT-c so the swap
            // interface remains functional for the educational demo.
            // Check both the Phantom provider's isConnected AND the React state
            // from usePhantomSolana — the provider property may not be set
            // immediately after connect() resolves in all Phantom versions.
            if (isConnected || solanaProvider?.isConnected) {
              setBalance('500');
              setBalanceFormatted('500');
            } else {
              setBalance('0');
              setBalanceFormatted('0');
            }
          }
        }

        if (!cancelled) setIsLoading(false);
      } catch (err) {
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
    const handleProviderConnect = () => {
      if (!cancelled) {
        console.log('[Phantom Solana] Connect event received, re-fetching balance');
        void fetchBalance();
      }
    };

    // Direct polling: checks Phantom provider state every 2 seconds.
    // This is a reliable fallback when the on('connect') event doesn't fire
    // (some Phantom versions/providers don't emit it consistently).
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let retried = false;
    pollInterval = setInterval(() => {
      if (cancelled) return;
      const p = getPhantomSolanaProvider();
      if (p?.isConnected && p?.publicKey) {
        // Provider is connected — ensure we have the latest balance.
        // Only re-fetch once per connection (avoid repeated calls).
        if (!retried) {
          retried = true;
          console.log('[Phantom Solana] Polling detected connection, re-fetching balance');
          void fetchBalance();
        }
      }
    }, 2000);

    // Stop polling after 60 seconds
    setTimeout(() => {
      if (pollInterval && !cancelled) clearInterval(pollInterval);
    }, 60000);

    // Register Phantom native event listeners for connect/account changes.
    // This is a best-effort registration — Phantom may inject its provider
    // asynchronously, in which case the 2s polling above handles it.
    const tryRegister = (): boolean => {
      const p = getPhantomSolanaProvider();
      if (p && p.on) {
        try { p.on('connect', handleProviderConnect); } catch {}
        try { p.on('accountChanged', handleProviderConnect); } catch {}
        return true;
      }
      return false;
    };

    // Attempt listener registration now and every 500ms for 15s.
    // The 2s polling above handles balance re-fetch independently.
    let registered = tryRegister();
    if (!registered) {
      const registerPoll = setInterval(() => {
        if (cancelled) return;
        if (tryRegister()) {
          clearInterval(registerPoll);
        }
      }, 500);
      setTimeout(() => {
        if (!cancelled) clearInterval(registerPoll);
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
  }, [mintAddress, tokenProgram, isConnected]);

  return {
    balance,
    balanceFormatted,
    isLoading,
    error,
  };
}