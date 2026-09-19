import { SWAP_CONFIG, type TokenKey, type SwappableTokenKey } from "@/config/swapConfig";
import type { TokenConfig } from "@/config/swapConfig";

export type { TokenKey } from "@/config/swapConfig";

/**
 * Result of a swap quote calculation.
 */
export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  exchangeRateDisplay: string;
  priceImpact: number;
  minimumReceived: number;
  slippageTolerance: number;
  inputToken: TokenKey;
  outputToken: TokenKey;
}

/**
 * Get the exchange rate from `from` token to `to` token.
 *
 * Direction logic:
 * - Non-KSH → KSH:  rate = SWAP_CONFIG.exchange.rates[fromToken]
 * - KSH → token:    rate = 1 / SWAP_CONFIG.exchange.rates[toToken]
 *
 * @param fromToken  Which token is being sold
 * @param toToken    Which token is being received
 * @returns          Exchange rate (units of `toToken` per 1 unit of `fromToken`)
 */
export function getExchangeRate(fromToken: TokenKey, toToken: TokenKey): number {
  if (fromToken === "ksh") {
    // KSH → other token: inverse of the KSH rate
    const key = toToken as SwappableTokenKey;
    return 1 / SWAP_CONFIG.exchange.rates[key];
  }
  // other token → KSH
  const key = fromToken as SwappableTokenKey;
  return SWAP_CONFIG.exchange.rates[key];
}

/**
 * Calculate the output amount for a given input based on the fixed
 * educational exchange rate.
 *
 * Direction logic:
 * - BT-c/ETH/USDT → KSH: output = input * rate
 * - KSH → BT-c/ETH/USDT: output = input * (1 / rate)
 *
 * @param inputAmount  Decimal input amount as a number
 * @param inputToken   Which token is being sold
 * @param outputToken  Which token is being received (derived if KSH↔other)
 * @returns            SwapQuote with all derived values
 */
export function calculateSwap(
  inputAmount: number,
  inputToken: TokenKey,
  outputToken?: TokenKey,
): SwapQuote {
  const resolvedOutput: TokenKey = outputToken ?? (inputToken === "ksh" ? "btc" : "ksh");
  const rate = getExchangeRate(inputToken, resolvedOutput);
  const outputAmount = inputAmount * rate;

  // Simulate price impact based on a virtual pool.
  // Larger trades relative to pool size have higher impact.
  const virtualPool = inputToken === "ksh"
    ? SWAP_CONFIG.virtualPoolLiquidity.ksh
    : inputToken === "eth"
      ? SWAP_CONFIG.virtualPoolLiquidity.eth
      : inputToken === "usdt"
        ? SWAP_CONFIG.virtualPoolLiquidity.usdt
        : SWAP_CONFIG.virtualPoolLiquidity.btc;
  const poolRatio = inputAmount / virtualPool;
  // Quadratic impact capped at 5%
  const priceImpact = Math.min(poolRatio * poolRatio * 10000, 5.0);

  const { slippageTolerance } = SWAP_CONFIG.exchange;
  // Minimum received = output * (1 - slippage%)
  const minReceived = outputAmount * (1 - slippageTolerance / 100);

  const inputSymbol = SWAP_CONFIG.tokens[inputToken].symbol;
  const outputSymbol = SWAP_CONFIG.tokens[resolvedOutput].symbol;

  return {
    inputAmount,
    outputAmount,
    exchangeRate: rate,
    exchangeRateDisplay: `1 ${inputSymbol} = ${rate === Math.floor(rate) ? rate : rate.toFixed(6)} ${outputSymbol}`,
    priceImpact,
    minimumReceived: minReceived,
    slippageTolerance,
    inputToken,
    outputToken: resolvedOutput,
  };
}

/**
 * Convenience: given an output, calculate the required input.
 */
export function calculateInputForOutput(
  outputAmount: number,
  outputToken: TokenKey,
): number {
  const rate = getExchangeRate(outputToken === "ksh" ? "btc" : "ksh", outputToken);
  return outputAmount / rate;
}

/**
 * Simulate a blockchain transaction.
 * Returns a promise that resolves with a tx hash after a delay,
 * to mimic real network latency.
 */
export function simulateSwapTransaction(
  quote: SwapQuote,
): Promise<{
  success: boolean;
  txHash: string;
  gasUsed: string;
  gasPrice: string;
}> {
  // Generate a pseudo-random tx hash
  const randomHex = (len: number) => {
    let s = "";
    const chars = "0123456789abcdef";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const txHash = "0x" + randomHex(64);

  return new Promise((resolve) => {
    // Simulate network latency (1-3 seconds)
    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      // ~92% success rate for realism
      const success = Math.random() > 0.08;
      resolve({
        success,
        txHash,
        gasUsed: (21000 + Math.floor(Math.random() * 30000)).toString(),
        gasPrice: "15",
      });
    }, delay);
  });
}