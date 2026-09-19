import { formatUnits, parseUnits } from "viem";

/**
 * Format a BigInt balance with proper decimals.
 * Returns a human-readable string with appropriate precision.
 */
export function formatBalance(
  value: bigint | string | undefined,
  decimals: number = 18,
  maxDisplayDecimals: number = 6,
): string {
  if (value === undefined || value === null) return "0";

  const bn = typeof value === "bigint" ? value : BigInt(value);
  const formatted = formatUnits(bn, decimals);

  // Trim to max display decimals
  const parts = formatted.split(".");
  if (parts.length === 2 && parts[1].length > maxDisplayDecimals) {
    parts[1] = parts[1].slice(0, maxDisplayDecimals);
  }
  return parts.join(".");
}

/**
 * Format a balance for display, trimming trailing zeros.
 */
export function formatDisplayBalance(
  value: bigint | string | undefined,
  decimals: number = 18,
  displayDecimals: number = 4,
): string {
  if (value === undefined || value === null) return "0.00";

  const bn = typeof value === "bigint" ? value : BigInt(value);
  const formatted = formatUnits(bn, decimals);

  const num = parseFloat(formatted);
  if (num === 0) return "0.00";

  // For large numbers, use compact notation
  if (num >= 1_000_000) {
    return num.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      notation: "compact",
      compactDisplay: "short",
    });
  }

  if (num >= 1_000) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: displayDecimals,
    });
  }

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: displayDecimals,
  });
}

/**
 * Parse a decimal string to a BigInt with the given number of decimals.
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || isNaN(parseFloat(amount))) return 0n;
  return parseUnits(amount, decimals);
}

/**
 * Shorten an Ethereum address for display.
 * e.g. "0x1234...5678"
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address || address.length < 10) return address;
  if (address.includes("0x") || address.includes("0X")) {
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }
  // Non-EVM address (e.g., Solana base58)
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Shorten a contract address for display.
 */
export function shortenTokenAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;

  // EVM address
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Solana / other base58
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

/**
 * Truncate a number to a fixed number of decimals without rounding up.
 */
export function truncateDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}
