import { SWAP_CONFIG, type TokenKey } from "@/config/swapConfig";

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
 * Rate is derived from each token's educational USD price:
 *   rate = usdPrice[from] / usdPrice[to]
 *
 * @param fromToken  Which token is being sold
 * @param toToken    Which token is being received
 * @returns          Exchange rate (units of `toToken` per 1 unit of `fromToken`)
 */
export function getExchangeRate(fromToken: TokenKey, toToken: TokenKey): number {
  const fromPrice = SWAP_CONFIG.tokens[fromToken].usdPrice;
  const toPrice = SWAP_CONFIG.tokens[toToken].usdPrice;
  return fromPrice / toPrice;
}

/**
 * Calculate the output amount for a given input based on the fixed
 * educational exchange rate (derived from USD prices).
 *
 * @param inputAmount  Decimal input amount as a number
 * @param inputToken   Which token is being sold
 * @param outputToken  Which token is being received
 * @returns            SwapQuote with all derived values
 */
export function calculateSwap(
  inputAmount: number,
  inputToken: TokenKey,
  outputToken: TokenKey,
): SwapQuote {
  const rate = getExchangeRate(inputToken, outputToken);
  const outputAmount = inputAmount * rate;

  // Simulate price impact based on a virtual pool.
  // Larger trades relative to pool size have higher impact.
  const virtualPool = SWAP_CONFIG.virtualPoolLiquidity[inputToken];
  const poolRatio = inputAmount / virtualPool;
  // Quadratic impact capped at 5%
  const priceImpact = Math.min(poolRatio * poolRatio * 10000, 5.0);

  const { slippageTolerance } = SWAP_CONFIG.exchange;
  // Minimum received = output * (1 - slippage%)
  const minReceived = outputAmount * (1 - slippageTolerance / 100);

  const inputSymbol = SWAP_CONFIG.tokens[inputToken].symbol;
  const outputSymbol = SWAP_CONFIG.tokens[outputToken].symbol;

  return {
    inputAmount,
    outputAmount,
    exchangeRate: rate,
    exchangeRateDisplay: `1 ${inputSymbol} = ${rate === Math.floor(rate) ? rate : rate.toFixed(6)} ${outputSymbol}`,
    priceImpact,
    minimumReceived: minReceived,
    slippageTolerance,
    inputToken,
    outputToken,
  };
}

/**
 * Convenience: given an output, calculate the required input.
 */
export function calculateInputForOutput(
  outputAmount: number,
  outputToken: TokenKey,
  inputToken: TokenKey,
): number {
  const rate = getExchangeRate(inputToken, outputToken);
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
