"use client";

import { Header } from "@/components/Header";
import { SwapCard } from "@/components/SwapCard";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />

      <main className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
        <div className="w-full max-w-lg">
          <SwapCard />
        </div>
      </main>
    </div>
  );
}
