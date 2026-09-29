"use client";

import { useState, useMemo } from "react";
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
  Zap,
} from "lucide-react";
import { SWAP_CONFIG, type TokenKey } from "@/config/swapConfig";
import { shortenAddress } from "@/lib/utils";
import { useTokenInfo, usePhantomSolana } from "@/lib/hooks";
import { calculateSwap, simulateSwapTransaction } from "@/lib/swap";
import type { SwapQuote } from "@/lib/swap";
import type { TransactionStatus } from "@/types";
import { TokenSelector } from "./TokenSelector";
import { SettingsModal } from "./SettingsModal";

/**
 * SwapCard – Uniswap-style swap interface.
 *
 * Resembles https://app.uniswap.org/swap:
 *  - From / To token selectors (any pair: ETH, USDT, USDC, DAI, WBTC, BT-c)
 *  - Amount input with live quote calculation
 *  - Swap direction toggle (⇅)
 *  - Exchange rate, price impact, minimum received, slippage, deadline
 *  - Settings modal
 *  - Simulated transaction flow (signing → pending → success/failed)
 */

const ALL_TOKENS: TokenKey[] = ["eth", "usdt", "usdc", "dai", "wbtc", "btc", "nvda", "aapl", "tsla", "googl", "msft", "amzn", "meta"];

export function SwapCard() {
  // --- Wallet state ---
  const { isConnected: evmConnected } = useAccount();
  const { isConnected: solanaConnected } = usePhantomSolana();
  const isConnected = evmConnected || solanaConnected;

  // --- Token info (on-chain detection) ---
  const ethData = useTokenInfo("eth");
  const usdtData = useTokenInfo("usdt");
  const usdcData = useTokenInfo("usdc");
  const daiData = useTokenInfo("dai");
  const wbtcData = useTokenInfo("wbtc");
  const btcData = useTokenInfo("btc");
  const nvdaData = useTokenInfo("nvda");
  const aaplData = useTokenInfo("aapl");
  const tslaData = useTokenInfo("tsla");
  const googlData = useTokenInfo("googl");
  const msftData = useTokenInfo("msft");
  const amznData = useTokenInfo("amzn");
  const metaData = useTokenInfo("meta");

  const tokenDataMap: Record<TokenKey, typeof ethData> = {
    eth: ethData,
    usdt: usdtData,
    usdc: usdcData,
    dai: daiData,
    wbtc: wbtcData,
    btc: btcData,
    nvda: nvdaData,
    aapl: aaplData,
    tsla: tslaData,
    googl: googlData,
    msft: msftData,
    amzn: amznData,
    meta: metaData,
  };

  // --- Swap state ---
  const [fromToken, setFromToken] = useState<TokenKey>("eth");
  const [toToken, setToToken] = useState<TokenKey>("usdt");
  const [inputAmount, setInputAmount] = useState("");
  const [customSlippage, setCustomSlippage] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState(
    SWAP_CONFIG.exchange.slippageTolerance,
  );
  const [deadline, setDeadline] = useState(
    SWAP_CONFIG.exchange.transactionDeadlineMinutes,
  );

  // --- Transaction state ---
  const [txStatus, setTxStatus] = useState<TransactionStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // --- Modals ---
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<"from" | "to">("from");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Derived: the "from" token data and "to" token data
  const fromData = tokenDataMap[fromToken];
  const toData = tokenDataMap[toToken];

  const fromTokenConfig = SWAP_CONFIG.tokens[fromToken];
  const toTokenConfig = SWAP_CONFIG.tokens[toToken];

  // Calculate quote when input changes
  const quote: SwapQuote | null = useMemo(() => {
    const num = parseFloat(inputAmount);
    if (!inputAmount || isNaN(num) || num <= 0) return null;
    return calculateSwap(num, fromToken, toToken);
  }, [inputAmount, fromToken, toToken]);

  // Check if user has insufficient balance for the "from" token
  const insufficientBalance = useMemo(() => {
    if (!isConnected) return false;
    const inputNum = parseFloat(inputAmount);
    if (isNaN(inputNum) || inputNum <= 0) return false;
    const bal = parseFloat(fromData.balanceFormatted || "0");
    return inputNum > bal;
  }, [isConnected, fromData.balanceFormatted, inputAmount]);

  // Price impact color
  const priceImpact = quote?.priceImpact ?? 0;
  const priceImpactColor =
    priceImpact === 0
      ? "text-[var(--color-text-secondary)]"
      : priceImpact > 3
        ? "text-[var(--uniswap-red)]"
        : "text-[var(--uniswap-accent)]";

  // --- Handlers ---
  const handleSwapDirection = () => {
    const newFrom = toToken;
    const newTo = fromToken;
    setFromToken(newFrom);
    setToToken(newTo);
    if (quote) {
      setInputAmount(
        quote.outputAmount.toLocaleString("en-US", { maximumFractionDigits: 6 }),
      );
    } else {
      setInputAmount("");
    }
  };

  const handleInputChange = (value: string) => {
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

  const handleSwap = async () => {
    if (!isConnected) return;
    if (!quote || quote.inputAmount <= 0) return;

    // Check if user has enough balance
    if (isConnected) {
      const fromBalance = parseFloat(fromData.balanceFormatted || "0");
      if (parseFloat(quote.inputAmount.toFixed(8)) > fromBalance) {
        alert("Insufficient balance");
        return;
      }
    }

    setTxStatus("signing");
    setTxError(null);

    try {
      const result = await simulateSwapTransaction(quote);
      setTxHash(result.txHash);
      if (result.success) {
        setTxStatus("success");
      } else {
        setTxError("Transaction simulation failed. Please try again.");
        setTxStatus("failed");
      }
    } catch (e: any) {
      setTxError(e?.message || "Transaction failed. Please try again.");
      setTxStatus("failed");
    }
  };

  const resetSwap = () => {
    setTxStatus("idle");
    setTxHash(null);
    setTxError(null);
    setInputAmount("");
  };

  const getSwapButtonText = () => {
    switch (txStatus) {
      case "signing":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sign in wallet</span>
          </>
        );
      case "pending":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Swapping…</span>
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            <span>Swap complete</span>
          </>
        );
      case "failed":
        return (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>Swap failed</span>
          </>
        );
      default:
        return !isConnected ? (
          <>
            <Zap className="h-4 w-4" />
            <span>Connect Wallet</span>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            <span>Swap</span>
          </>
        );
    }
  };

  // --- Render helpers ---
  const renderTokenButton = (
    tokenKey: TokenKey,
    tokenData: typeof fromData,
    isFrom: boolean,
  ) => {
    const token = SWAP_CONFIG.tokens[tokenKey];
    const symbol = tokenData.symbol || token.symbol;
    const balance = isFrom ? tokenData.balanceFormatted : null;

    return (
      <button
        type="button"
        onClick={() => {
          setSelectingFor(isFrom ? "from" : "to");
          setTokenSelectorOpen(true);
        }}
        className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-left transition-colors hover:border-[var(--uniswap-purple)] hover:bg-[var(--color-input-bg)]"
      >
        <img
          src={token.icon}
          alt={symbol}
          className="h-6 w-6 rounded-full"
          onError={(e) => {
            e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${symbol}`;
          }}
        />
        <span className="font-medium text-[var(--color-text)]">{symbol}</span>
        <ChevronDown className="h-3 w-3 text-[var(--color-text-tertiary)]" />
      </button>
    );
  };

  const cardClass =
    "w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-sm";

  return (
    <div className="w-full" id="swap">
      <div className={cardClass}>
        {/* From Section */}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>From</span>
          {fromData.balanceFormatted && (
            <button
              onClick={handleMaxClick}
              className="rounded-md px-2 py-0.5 font-medium text-[var(--uniswap-purple)] hover:text-[var(--uniswap-purple)]/80"
            >
              Max
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3">
          {renderTokenButton(fromToken, fromData, true)}

          <input
            type="number"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={txStatus !== "idle" && txStatus !== "failed"}
            className="w-full bg-transparent text-right text-2xl font-medium text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            min="0"
            step="any"
          />
        </div>

        {isConnected && (
          <div className="mt-1 text-right text-xs text-[var(--color-text-tertiary)]">
            {fromData.isLoading
              ? "Loading balance…"
              : `${parseFloat(fromData.balanceFormatted || "0").toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })} ${fromTokenConfig.symbol} available`}
          </div>
        )}

        {/* Swap Direction Button */}
        <div className="my-4 flex justify-center">
          <button
            onClick={handleSwapDirection}
            disabled={!inputAmount && txStatus !== "idle" && txStatus !== "failed"}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5 text-[var(--color-text-secondary)] shadow transition-all hover:border-[var(--uniswap-purple)] hover:bg-[var(--color-input-bg)] hover:text-[var(--uniswap-purple)] disabled:opacity-40"
            title="Switch tokens"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        {/* To Section */}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>To</span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          {renderTokenButton(toToken, toData, false)}

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
            className="w-full bg-transparent text-right text-2xl font-medium text-[var(--color-text-secondary)] outline-none"
            placeholder="0.00"
          />
        </div>

        {/* Exchange Details */}
        {quote && (
          <div className="my-4 space-y-2.5 border-t border-[var(--color-border)] pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                <RefreshCw className="h-3 w-3" />
                Exchange Rate
              </span>
              <span className="text-[var(--color-text)]">
                {quote.exchangeRateDisplay}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                <Zap className="h-3 w-3" />
                Price Impact
              </span>
              <span className={priceImpactColor}>
                {priceImpact > 0.01 ? `-${priceImpact.toFixed(2)}%` : "0.00%"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                <Settings className="h-3 w-3" />
                Minimum Received
              </span>
              <span className="font-medium text-[var(--color-text)]">
                {quote.minimumReceived.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                {toTokenConfig.symbol}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                <Timer className="h-3 w-3" />
                Slippage Tolerance
              </span>
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-[var(--color-text)] hover:text-[var(--uniswap-purple)]"
              >
                {slippageTolerance}%
              </button>
            </div>
          </div>
        )}

        {/* Transaction Status Panel */}
        {txStatus !== "idle" && (
          <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-center">
            {txStatus === "signing" && (
              <p className="text-sm text-[var(--uniswap-accent)]">
                Please confirm the transaction in your wallet.
              </p>
            )}
            {txStatus === "pending" && (
              <p className="text-sm text-[var(--uniswap-accent)]">
                Swapping…
              </p>
            )}
            {txStatus === "success" && txHash && (
              <div className="space-y-1">
                <p className="text-sm text-[var(--uniswap-green)]">
                  Swap completed successfully!
                </p>
                <div className="flex items-center justify-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <span>Tx: {shortenAddress(txHash)}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(txHash);
                    }}
                    className="rounded p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            {txStatus === "failed" && (
              <p className="text-sm text-[var(--uniswap-red)]">
                {txError || "Transaction failed. Please try again."}
              </p>
            )}
          </div>
        )}

        {/* Insufficient balance warning */}
        {isConnected && insufficientBalance && (
          <div className="mb-3 rounded-lg border border-[var(--uniswap-red)]/30 bg-[var(--uniswap-red)]/5 p-3 text-center">
            <p className="text-sm text-[var(--uniswap-red)]">
              Insufficient {fromTokenConfig.symbol} balance
            </p>
          </div>
        )}

        {/* Swap / Connect Button */}
        <button
          onClick={handleSwap}
          disabled={
            txStatus === "signing" ||
            txStatus === "pending" ||
            !isConnected ||
            !quote ||
            insufficientBalance ||
            fromData.isLoading
          }
          className={`relative flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
            !isConnected
              ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]"
              : txStatus === "success"
                ? "border-[var(--uniswap-green)]/30 bg-gradient-to-r from-[var(--uniswap-green)]/10 to-green-500/10 text-[var(--uniswap-green)] hover:from-[var(--uniswap-green)]/20 hover:to-green-500/20"
                : txStatus === "failed"
                  ? "border-[var(--uniswap-red)]/30 bg-gradient-to-r from-[var(--uniswap-red)]/10 to-red-500/10 text-[var(--uniswap-red)] hover:from-[var(--uniswap-red)]/20 hover:to-red-500/20"
                  : "border-[var(--uniswap-purple)]/30 bg-gradient-to-r from-[var(--uniswap-purple)]/10 to-blue-500/10 text-[var(--uniswap-purple)] hover:from-[var(--uniswap-purple)]/20 hover:to-blue-500/20 hover:shadow-neon"
          }`}
        >
          {getSwapButtonText()}
        </button>

        {(txStatus === "pending" || txStatus === "success" || txStatus === "failed") && (
          <button
            onClick={resetSwap}
            className="mt-3 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text)]"
          >
            New Swap
          </button>
        )}
      </div>

      {/* Token Detection Status */}
      <div className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">
        {fromData.isEvmValid ? (
          <span className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--uniswap-green)] animate-pulse"></span>
            Token detected • Contract address verified
          </span>
        ) : fromToken === "btc" ? (
          <span className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--uniswap-green)] animate-pulse"></span>
            Solana SPL token • Balance via Phantom Solana provider
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3 text-[var(--uniswap-accent)]" />
            Config address not EVM-compatible — replace in config/swapConfig.ts
          </span>
        )}
      </div>

      {/* Token Selector Modal */}
      <TokenSelector
        isOpen={tokenSelectorOpen}
        onClose={() => setTokenSelectorOpen(false)}
        onSelect={(tk) => {
          if (selectingFor === "from") {
            setFromToken(tk);
          } else {
            setToToken(tk);
          }
          setTokenSelectorOpen(false);
        }}
        exclude={selectingFor === "from" ? toToken : fromToken}
        title={selectingFor === "from" ? "Select token to sell" : "Select token to buy"}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        slippage={slippageTolerance}
        onSlippageChange={setSlippageTolerance}
        customSlippage={customSlippage}
        onCustomSlippageChange={setCustomSlippage}
        deadline={deadline}
        onDeadlineChange={setDeadline}
      />
    </div>
  );
}
