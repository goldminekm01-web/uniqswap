"use client";

import {
  Wallet,
  Search,
  Database,
  Calculator,
  Send,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Wallet Connection",
    description:
      "Connect your MetaMask wallet or any EVM-compatible wallet. The interface detects the connected wallet address and current network.",
    icon: Wallet,
    color: "from-brand-PRIMARY to-blue-500",
  },
  {
    step: 2,
    title: "ERC-20 Balance Detection",
    description:
      "The interface queries the BT-c token's balance via Phantom's Solana provider and the Solana JSON RPC API to retrieve your wallet's SPL token balance.",
    icon: Search,
    color: "from-blue-500 to-indigo-500",
  },
  {
    step: 3,
    title: "Token Metadata Retrieval",
    description:
      "Standard ERC-20 functions (name, symbol, decimals) are called to fetch the token's metadata from the blockchain, ensuring accurate display of name, symbol, and decimal precision.",
    icon: Database,
    color: "from-indigo-500 to-purple-500",
  },
  {
    step: 4,
    title: "Exchange-Rate Calculation",
    description:
      "A fixed educational exchange rate (1 BT-c = 100 KSH) is used to calculate the estimated output. The system also computes price impact based on virtual pool liquidity.",
    icon: Calculator,
    color: "from-purple-500 to-pink-500",
  },
  {
    step: 5,
    title: "Simulated Swap Output",
    description:
      "When you confirm a swap, a simulated blockchain transaction is executed with realistic latency. The transaction status is displayed throughout (signing → pending → confirmed).",
    icon: Send,
    color: "from-pink-500 to-rose-500",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mb-8 rounded-2xl border border-white/10 bg-dark-800/60 p-6 backdrop-blur-xl"
    >
      <h2 className="font-display mb-2 text-2xl font-bold text-white">
        How It Works
      </h2>
      <p className="mb-6 text-sm text-gray-400">
        This swap interface demonstrates core Web3 concepts: wallet connection,
        ERC-20 token detection, on-chain balance reading, exchange-rate
        calculation, and simulated swaps. All token addresses and exchange rates
        are configurable in{" "}
        <code className="rounded bg-dark-900/50 px-1.5 py-0.5 text-xs text-brand-accent">
          config/swapConfig.ts
        </code>
        .
      </p>

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.step}
            className="flex gap-4"
          >
            <div className="flex-shrink-0">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${step.color}`}
              >
                <step.icon className="h-5 w-5 text-white" />
                <span className="absolute -mt-4 text-xs font-bold text-white">
                  {step.step}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-brand-green" />
            Uses standard ERC-20 ABI
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-brand-green" />
            Wagmi + Viem for contract reads
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-brand-green" />
            Responsive & mobile-friendly
          </span>
        </div>
      </div>
    </section>
  );
}
