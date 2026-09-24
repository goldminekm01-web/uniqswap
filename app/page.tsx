"use client";

import { Header } from "@/components/Header";
import { SwapCard } from "@/components/SwapCard";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-dark-950 to-black text-gray-100 selection:bg-brand-PRIMARY/30">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <SwapCard />
        </div>
      </main>
    </div>
  );
}