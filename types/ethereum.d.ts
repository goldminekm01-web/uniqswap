/**
 * Type declarations for browser-injected Ethereum providers.
 *
 * Allows `window.ethereum` to be accessed safely in TypeScript without
 * requiring the `@types/node` DOM lib to include EIP-1193 types.
 */

import type { EIP1193Provider } from "viem";

declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      isMetaMask?: boolean;
      isBraveWallet?: boolean;
      isCoinbaseWallet?: boolean;
      request?: (args: {
        method: string;
        params?: unknown[] | object;
      }) => Promise<unknown>;
    };
  }
}

export {};
