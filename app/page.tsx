"use client";

import { Header } from "@/components/Header";
import { SwapCard } from "@/components/SwapCard";
import { TokenDetails } from "@/components/TokenDetails";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 to-black text-gray-100 selection:bg-brand-PRIMARY/30">
      {/* Background grid pattern */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle,var(--tw-colors-brand-PRIMARY)/0.03_1px,transparent_1px)] [background-size:24px_24px]"></div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(0,194,255,0.02)_0%,transparent_70%)]"></div>

      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Uniswap
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Web3 Swap interface for selling native coins to Ksh
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          <SwapCard />
        </div>

        <div className="mt-8">
          <TokenDetails />
        </div>
      </main>
    </div>
  );
}
