"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  RefreshCw,
  Settings,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";
import { SWAP_CONFIG, type SwappableTokenKey, type TokenKey } from "@/config/swapConfig";
import { shortenAddress } from "@/lib/utils";
import { useTokenInfo, usePhantomSolana } from "@/lib/hooks";
import { calculateSwap, simulateSwapTransaction } from "@/lib/swap";
import type { SwapQuote } from "@/lib/swap";
import type { TransactionStatus, MpesaState } from "@/types";

/**
 * SwapCard – The central swap interface card.
 *
 * Features:
 * - From / To token selectors (BT-c, ETH, USDT ↔ KSH)
 * - Amount input with live quote calculation
 * - Swap direction toggle (⇅)
 * - Exchange rate, price impact, minimum received
 * - Slippage tolerance settings
 * - M-Pesa number input (shown when swapping TO KSH)
 * - Simulated transaction flow (signing → pending → success/failed)
 */

// Available from-tokens (everything except KSH)
const SWAPPABLE_TOKENS: SwappableTokenKey[] = ["btc", "eth", "usdt"];
const KSH_TOKEN_KEY = "ksh" satisfies TokenKey;

/** Validate M-Pesa number: 9-15 digits, optional leading + */
function validateMpesaNumber(num: string): string | null {
  const trimmed = num.trim();
  if (!trimmed) return "M-Pesa number is required";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9) return "M-Pesa number is too short (min 9 digits)";
  if (digits.length > 15) return "M-Pesa number is too long (max 15 digits)";
  return null;
}

export function SwapCard() {
  // --- Wallet state ---
  const { isConnected: evmConnected } = useAccount();
  const { isConnected: solanaConnected } = usePhantomSolana();
  const isConnected = evmConnected || solanaConnected;

  // --- Token info (on-chain detection) ---
  const btcData = useTokenInfo("btc");
  const ethData = useTokenInfo("eth");
  const usdtData = useTokenInfo("usdt");
  const kshData = useTokenInfo("ksh");

  // Map token keys to their detected data
  const tokenDataMap: Record<TokenKey, typeof btcData> = {
    btc: btcData,
    eth: ethData,
    usdt: usdtData,
    ksh: kshData,
  };

  // --- Swap state ---
  const [fromToken, setFromToken] = useState<TokenKey>("btc");
  const [toToken, setToToken] = useState<TokenKey>("ksh");
  const [inputAmount, setInputAmount] = useState("");
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [customSlippage, setCustomSlippage] = useState("");

  // --- M-Pesa state (shown when swapping TO KSH) ---
  const [mpesa, setMpesa] = useState<MpesaState>({
    number: "",
    error: null,
    isTouched: false,
  });

  // --- Transaction state --
  const [txStatus, setTxStatus] = useState<TransactionStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // --- Swap confirmation popup (M-Pesa fee disclosure) ---
  const [showSwapConfirm, setShowSwapConfirm] = useState(false);
  const SWAP_FEE_RATE = 0.1; // 10% fee displayed to every user

  // --- Token selector dropdown state ---
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const fromButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (fromButtonRef.current && !fromButtonRef.current.contains(e.target as Node)) {
        setTokenSelectorOpen(false);
        setDropdownPos(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Derived: the "from" token data and "to" token data
  const fromData = tokenDataMap[fromToken];
  const toData = tokenDataMap[toToken];

  const fromTokenConfig = SWAP_CONFIG.tokens[fromToken];
  const toTokenConfig = SWAP_CONFIG.tokens[toToken];

  // Whether to show the M-Pesa field (only when receiving KSH)
  const showMpesaField = toToken === KSH_TOKEN_KEY && isConnected;

  // Calculate quote when input changes
  const quote: SwapQuote | null = useMemo(() => {
    const num = parseFloat(inputAmount);
    if (!inputAmount || isNaN(num) || num <= 0) return null;
    return calculateSwap(num, fromToken, toToken);
  }, [inputAmount, fromToken, toToken]);

  // Slippage tolerance
  const slippageTolerance = SWAP_CONFIG.exchange.slippageTolerance;
  const slippageOptions = [0.1, 0.5, 1.0];

  // Price impact color
  const priceImpact = quote?.priceImpact ?? 0;
  const priceImpactColor =
    priceImpact === 0
      ? "text-gray-400"
      : priceImpact > 3
        ? "text-brand-red"
        : "text-brand-accent";

  // --- Handlers ---
  const handleSwapDirection = () => {
    const newFrom = toToken;
    const newTo = fromToken;
    setFromToken(newFrom);
    setToToken(newTo);
    // Reset MPESA when direction changes away from KSH
    setMpesa({
      number: "",
      error: null,
      isTouched: false,
    });
    // Pre-fill input with the estimated output
    if (quote) {
      setInputAmount(quote.outputAmount.toLocaleString("en-US", { maximumFractionDigits: 6 }));
    } else {
      setInputAmount("");
    }
  };

  const handleInputChange = (value: string) => {
    // Allow only valid decimal numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setInputAmount(value);
    }
  };

  const handleMaxClick = () => {
    const bal = fromData.balanceFormatted;
    if (bal) {
      setInputAmount(bal);
    }
  };

  const handleMpesaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMpesa({
      number: value,
      error: validateMpesaNumber(value),
      isTouched: true,
    });
  };

  const handleSwap = async () => {
    if (!isConnected) return;
    if (!quote || quote.inputAmount <= 0) return;

    // Check if user has enough balance (when balance is available)
    if (fromData.balanceFormatted) {
      if (parseFloat(quote.inputAmount.toFixed(8)) > parseFloat(fromData.balanceFormatted)) {
        alert("Insufficient balance");
        return;
      }
    }

    // Validate MPESA number when swapping to KSH
    if (showMpesaField) {
      const mpesaError = validateMpesaNumber(mpesa.number);
      if (mpesaError) {
        setMpesa({ number: mpesa.number, error: mpesaError, isTouched: true });
        return;
      }
    }

    // Show the swap confirmation popup (fee disclosure + till number)
    setShowSwapConfirm(true);
  };

  const confirmSwap = async () => {
    setShowSwapConfirm(false);
    setTxStatus("signing");
    setTxError(null);

    try {
      const result = await simulateSwapTransaction(quote!);
      setTxHash(result.txHash);
    } catch (e: any) {
      // Even on error, continue to pending — user wants
      // "waiting for payment to reflect" loading state, not success/failure.
      console.error('Swap transaction error:', e);
    }

    // Always transition to pending: "waiting for payment to reflect on-chain"
    // Never show success — the swap stays in loading state indefinitely
    // until the user clicks "New Swap" to reset.
    setTxStatus("pending");
  };

  const resetSwap = () => {
    setTxStatus("idle");
    setTxHash(null);
    setTxError(null);
    setInputAmount("");
    setMpesa({ number: "", error: null, isTouched: false });
  };

  const getSwapButtonText = () => {
    switch (txStatus) {
      case "signing":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sign in MetaMask</span>
          </>
        );
      case "pending":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Waiting for payment to reflect</span>
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            <span>Swap Complete</span>
          </>
        );
      case "failed":
        return (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>Swap Failed</span>
          </>
        );
      default:
        return (
          <>
            <Zap className="h-4 w-4" />
            <span>Swap</span>
          </>
        );
    }
  };

  // --- Render helpers ---
  const renderTokenSelector = (
    tokenKey: TokenKey,
    tokenData: typeof fromData,
    isFrom: boolean,
  ) => {
    const token = SWAP_CONFIG.tokens[tokenKey];
    const balance = isFrom ? tokenData.balanceFormatted : null;
    const symbol = tokenData.symbol || token.symbol;
    const isEvmValid = tokenData.isEvmValid;

    const hasBalanceWarning = isFrom && isEvmValid && !tokenData.isEvmValid && !!fromData.isEvmValid;

    return (
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-800">
          <img
            src={token.icon}
            alt={symbol}
            className="h-7 w-7 rounded-full"
            onError={(e) => {
              e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${symbol}`;
            }}
          />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-white">{symbol}</span>
          <span className="text-xs text-gray-500">{token.name}</span>
        </div>
        {balance && isFrom && (
          <span className="text-xs text-gray-400">
            Balance: {balance} {symbol}
          </span>
        )}
        {hasBalanceWarning && (
          <div
            title={
              fromData.error ||
              "Token contract address is not a valid EVM address"
            }
            className="cursor-help"
          >
            <AlertCircle className="h-3 w-3 text-brand-accent" />
          </div>
        )}
      </div>
    );
  };

  const cardClass =
    "w-full rounded-2xl border border-white/10 bg-dark-800/60 p-6 shadow-xl backdrop-blur-xl";

  return (
    <div className="w-full" id="swap">
      <div className={cardClass}>
        {/* From Section */}
        <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
          <span>From</span>
          {fromData.balanceFormatted && (
            <button
              onClick={handleMaxClick}
              className="rounded-md px-2 py-0.5 font-medium text-brand-PRIMARY hover:text-brand-PRIMARY/80"
            >
              Max
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Token Selector (From) — dropdown for swappable tokens */}
          <div className="flex-shrink-0">
            <button
              ref={fromButtonRef}
              onClick={() => {
                if (fromButtonRef.current) {
                  const rect = fromButtonRef.current.getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + 8, left: rect.left });
                }
                setTokenSelectorOpen(!tokenSelectorOpen);
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-dark-900/40 px-3 py-2 text-left transition-all hover:border-white/20 hover:bg-dark-900/70"
            >
              {renderTokenSelector(fromToken, fromData, true)}
              {fromToken !== KSH_TOKEN_KEY && (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              )}
            </button>

            {/* Dropdown for selecting from-token — rendered via portal to escape card stacking context */}
            {tokenSelectorOpen && fromToken !== KSH_TOKEN_KEY && dropdownPos &&
              createPortal(
                <div
                  className="fixed z-[100] w-48 rounded-xl border border-white/10 bg-dark-900/90 backdrop-blur-xl shadow-xl"
                  style={{ top: dropdownPos.top, left: dropdownPos.left, maxHeight: '240px' }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="py-1 text-xs text-gray-500">
                    <div className="px-3 py-1">Select token</div>
                  </div>
                  {SWAPPABLE_TOKENS.filter((k) => k !== fromToken).map((tk) => {
                    const tData = tokenDataMap[tk];
                    const tConfig = SWAP_CONFIG.tokens[tk];
                    return (
                      <button
                        key={tk}
                        onClick={() => {
                          setFromToken(tk);
                          setTokenSelectorOpen(false);
                          setDropdownPos(null);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-800">
                          <img
                            src={tConfig.icon}
                            alt={tConfig.symbol}
                            className="h-6 w-6 rounded-full"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{tConfig.symbol}</span>
                          <span className="text-xs text-gray-500">{tConfig.name}</span>
                        </div>
                        {tData.balanceFormatted && (
                          <span className="ml-auto text-xs text-gray-400">
                            {parseFloat(tData.balanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )
            }
          </div>

          {/* Amount Input (From) */}
          <div className="flex-1">
            <input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={txStatus !== "idle" && txStatus !== "failed"}
              className="w-full bg-transparent text-right text-3xl font-medium text-white outline-none placeholder:text-gray-600"
              min="0"
              step="any"
            />
            <div className="text-right text-xs text-gray-400">
              {fromData.balanceFormatted
                ? `${parseFloat(fromData.balanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${fromTokenConfig.symbol} available`
                : fromData.isLoading
                  ? "Loading balance…"
                  : isConnected
                    ? "0.00"
                    : "0.00"}
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="my-4 flex justify-center">
          <button
            onClick={handleSwapDirection}
            disabled={!inputAmount && txStatus !== "idle" && txStatus !== "failed"}
            className="rounded-full border border-white/10 bg-dark-900/50 p-2.5 text-gray-300 shadow-lg transition-all hover:border-white/20 hover:bg-dark-900/80 hover:text-white disabled:opacity-40"
            title="Switch tokens"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        {/* To Section */}
        <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
          <span>To</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Token Selector (To) — always KSH for from-token swaps */}
          <div className="flex-shrink-0">
            {renderTokenSelector(toToken, toData, false)}
          </div>

          {/* Amount Display (To) */}
          <div className="flex-1">
            <input
              type="text"
              value={
                quote
                  ? quote.outputAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })
                  : "—"
              }
              readOnly
              className="w-full bg-transparent text-right text-3xl font-medium text-gray-300 outline-none"
              placeholder="0.00"
            />
            <div className="text-right text-xs text-gray-400">
              {toTokenConfig.symbol} available
            </div>
          </div>
        </div>

        {/* M-Pesa Number Field (shown when swapping TO KSH) */}
        {quote && showMpesaField && (
          <div className="my-4 space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <Wallet className="h-3 w-3" />
              M-Pesa Number
            </label>
            <div className="relative">
              <input
                type="tel"
                placeholder="e.g. 07XX XXX XXX"
                value={mpesa.number}
                onChange={handleMpesaChange}
                className={`w-full rounded-xl border bg-dark-900/50 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 transition-colors ${
                  mpesa.error && mpesa.isTouched
                    ? "border-brand-red/50 focus:border-brand-red"
                    : "border-white/10 focus:border-brand-PRIMARY/50"
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                🇰🇪
              </span>
            </div>
            {mpesa.error && mpesa.isTouched && (
              <p className="text-xs text-brand-red">{mpesa.error}</p>
            )}
          </div>
        )}

        {/* Exchange Details */}
        {quote && (
          <div className="my-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <RefreshCw className="h-3 w-3" />
                Exchange Rate
              </span>
              <span className="text-white">
                {quote.exchangeRateDisplay}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <Zap className="h-3 w-3" />
                Price Impact
              </span>
              <span className={priceImpactColor}>
                {priceImpact > 0.01 ? `-${priceImpact.toFixed(2)}%` : "0.00%"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <Settings className="h-3 w-3" />
                Minimum Received
              </span>
              <span className="font-medium text-white">
                {quote.minimumReceived.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                {toTokenConfig.symbol}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                <Timer className="h-3 w-3" />
                Slippage Tolerance
              </span>
              <span className="text-white">
                {slippageTolerance}%
              </span>
            </div>
          </div>
        )}

        {/* Transaction Status Panel */}
        {txStatus !== "idle" && (
          <div className="mb-3 rounded-lg border border-white/5 bg-dark-900/40 p-3 text-center">
            {txStatus === "signing" && (
              <p className="text-sm text-brand-accent">
                Please confirm the transaction in your wallet.
              </p>
            )}
            {txStatus === "pending" && (
              <p className="text-sm text-brand-accent">
                Waiting for payment to reflect on-chain…
              </p>
            )}
            {txStatus === "success" && txHash && (
              <div className="space-y-1">
                <p className="text-sm text-brand-green">
                  Swap completed successfully!
                </p>
                <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                  <span>Tx: {shortenAddress(txHash)}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(txHash);
                    }}
                    className="rounded p-0.5 text-gray-400 hover:text-white"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            {txStatus === "failed" && (
              <p className="text-sm text-brand-red">
                {txError || "Transaction failed. Please try again."}
              </p>
            )}
          </div>
        )}

        {/* Swap / Connect Button */}
        <button
          onClick={handleSwap}
          disabled={txStatus === "signing" || txStatus === "pending" || !isConnected || (showMpesaField && !mpesa.number)}
          className={`relative flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold font-display transition-all ${
            !isConnected
              ? "cursor-not-allowed border-white/5 bg-dark-900/30 text-gray-500"
              : txStatus === "success"
                ? "border-brand-green/30 bg-gradient-to-r from-brand-green/10 to-green-500/10 text-brand-green hover:from-brand-green/20 hover:to-green-500/20"
                : txStatus === "failed"
                  ? "border-brand-red/30 bg-gradient-to-r from-brand-red/10 to-red-500/10 text-brand-red hover:from-brand-red/20 hover:to-red-500/20"
                  : "border-brand-PRIMARY/30 bg-gradient-to-r from-brand-PRIMARY/10 to-blue-500/10 text-brand-PRIMARY hover:from-brand-PRIMARY/20 hover:to-blue-500/20 hover:shadow-neon"
          }`}
        >
          {getSwapButtonText()}
        </button>

        {txStatus === "pending" && (
          <button
            onClick={resetSwap}
            className="mt-3 w-full rounded-xl border border-white/10 bg-dark-900/30 py-1.5 text-xs text-gray-400 transition-colors hover:bg-dark-900/50 hover:text-white"
          >
            New Swap
          </button>
        )}
        {txStatus === "success" && (
          <button
            onClick={resetSwap}
            className="mt-3 w-full rounded-xl border border-white/10 bg-dark-900/30 py-1.5 text-xs text-gray-400 transition-colors hover:bg-dark-900/50 hover:text-white"
          >
            New Swap
          </button>
        )}

      </div>

      {/* Token Detection Status */}
      <div className="mt-3 text-center text-xs text-gray-500">
        {fromData.isEvmValid ? (
          <span className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse"></span>
            Token detected • Contract address verified
          </span>
        ) : fromToken === "btc" ? (
          <span className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse"></span>
            Solana SPL token • Balance via Phantom Solana provider
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3 text-brand-accent" />
            Config address not EVM-compatible — replace in config/swapConfig.ts
          </span>
        )}
      </div>

      {/* Swap Confirmation Popup — fee disclosure + M-Pesa till */}
      {showSwapConfirm && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 via-white/5 to-transparent p-8 shadow-2xl shadow-brand-PRIMARY/30">
              {/* Glossy highlight overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/15" />
              <div className="absolute top-0 left-0 h-2/3 w-full rounded-full bg-gradient-to-b from-white/20 to-transparent blur-3xl opacity-60" />

              {/* Close button */}
              <button
                onClick={() => setShowSwapConfirm(false)}
                className="absolute top-4 right-4 rounded-full p-1 text-gray-400 opacity-70 transition-opacity hover:text-white hover:opacity-100"
                aria-label="Close"
              >
                <AlertCircle className="h-4 w-4" />
              </button>

              {/* Title */}
              <h3 className="relative mb-6 text-center text-2xl font-bold text-white">
                Transaction Processing
              </h3>

              <div className="relative space-y-5">
                {/* Swap Amount */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-sm text-gray-400">Swap Amount</span>
                  <span className="font-semibold text-white">
                    {quote?.inputAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
                    {fromTokenConfig.symbol}
                  </span>
                </div>

                {/* Fee Disclosure — 10% */}
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-PRIMARY/15 to-brand-PRIMARY/5 px-4 py-3 border border-brand-PRIMARY/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-brand-PRIMARY">⚠</span>
                    <span className="text-sm text-gray-300">Processing Fee (10%)</span>
                  </div>
                  <span className="font-bold text-brand-PRIMARY">
                    {quote
                      ? (quote.inputAmount * SWAP_FEE_RATE).toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        })
                      : 0}{" "}
                    {fromTokenConfig.symbol}
                  </span>
                </div>

                {/* Net Amount */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-sm text-gray-400">Net Amount</span>
                  <span className="font-semibold text-white">
                    {quote
                      ? (quote.inputAmount * (1 - SWAP_FEE_RATE)).toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        })
                      : 0}{" "}
                    {fromTokenConfig.symbol}
                  </span>
                </div>

                {/* Till Number */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-sm text-gray-400">Payment Till Number</span>
                  <span className="font-bold text-brand-accent">1435670</span>
                </div>

                {/* MPesa number (if entered) */}
                {mpesa.number && (
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-sm text-gray-400">M-Pesa Number</span>
                    <span className="font-semibold text-white">{mpesa.number}</span>
                  </div>
                )}
              </div>

              {/* Warning text */}
              <p className="relative mt-5 text-center text-xs text-gray-400">
                Each user must pay 10% of the swap amount to till 1435670
              </p>

              {/* Action Buttons */}
              <div className="relative mt-6 flex gap-3">
                <button
                  onClick={() => setShowSwapConfirm(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSwap}
                  className="flex-1 rounded-xl border border-brand-PRIMARY/30 bg-gradient-to-r from-brand-PRIMARY/20 to-blue-500/20 px-4 py-2 text-sm font-semibold text-brand-PRIMARY shadow-lg shadow-brand-PRIMARY/20 transition-all hover:from-brand-PRIMARY/30 hover:to-blue-500/30 hover:shadow-xl"
                >
                  Confirm &amp; Swap
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}