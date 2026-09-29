"use client";

import { WalletConnectButton } from "./WalletConnectButton";
import { NetworkIndicator } from "./NetworkIndicator";
import { Settings } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <div className="flex items-center gap-6">
        {/* Logo + App Name */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--uniswap-purple)] to-[var(--uniswap-teal)]">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full ring-2 ring-[var(--uniswap-purple)]/30 opacity-60"></span>
            <div className="relative z-10 text-xs font-bold text-white">
              UNI
            </div>
          </div>
          <span className="font-display text-xl font-bold text-[var(--color-text)]">
            Uniswap
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] sm:flex">
          <a
            href="#swap"
            className="rounded-lg px-3 py-1.5 text-[var(--uniswap-purple)] hover:text-[var(--uniswap-purple)]"
          >
            Swap
          </a>
          <a
            href="#how-it-works"
            className="rounded-lg px-3 py-1.5 hover:text-[var(--color-text)]"
          >
            How it works
          </a>
          <a
            href="#details"
            className="rounded-lg px-3 py-1.5 hover:text-[var(--color-text)]"
          >
            Token details
          </a>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <NetworkIndicator />
        <button
          aria-label="Settings"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text)]"
        >
          <Settings className="h-4 w-4" />
        </button>
        <WalletConnectButton />
      </div>
    </header>
  );
}
