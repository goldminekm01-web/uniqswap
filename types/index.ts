import type { TokenKey } from "@/lib/swap";
import type { TokenConfig } from "@/config/swapConfig";

export type { TokenKey };
export type { TokenConfig };

/**
 * Detected token information from blockchain reads.
 * This is populated when the user connects their wallet and
 * the ERC-20 contract is queried for name(), symbol(), decimals(), balanceOf().
 *
 * For native tokens (ETH), balance is read via publicClient.getBalance
 * instead of an ERC-20 balanceOf call.
 */
export interface DetectedTokenInfo {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  balance: string | null;
  balanceFormatted: string | null;
  isLoading: boolean;
  error: string | null;
  /** The effective address used for the read (evmContractAddress or contractAddress) */
  addressUsed: string;
  /** Whether the address is valid for EVM reads */
  isEvmValid: boolean;
  /** Refetch the balance from the contract */
  refetch?: () => void;
}

/**
 * Status of the wallet connection.
 */
export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "rejected";

/**
 * Status of a swap transaction.
 */
export type TransactionStatus =
  | "idle"
  | "signing"
  | "pending"
  | "success"
  | "failed";

/**
 * M-Pesa phone number input state.
 * Shown when swapping TO KSH so the user can specify
 * the recipient M-Pesa number for the educational payout.
 */
export interface MpesaState {
  number: string;
  error: string | null;
  isTouched: boolean;
}

/**
 * Represents a completed transaction for display.
 */
export interface TransactionRecord {
  status: TransactionStatus;
  txHash: string | null;
  inputAmount: string;
  outputAmount: string;
  inputToken: TokenKey;
  outputToken: TokenKey;
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
  error?: string;
}