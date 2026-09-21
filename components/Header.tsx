"use client";

import { WalletConnectButton } from "./WalletConnectButton";

export function Header() {
  return (
    <header className="border-b border-white/5 bg-dark-950/90 supports-[backdrop-filter]:bg-dark-950/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo + App Name */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-PRIMARY to-blue-500">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60 ring-2 ring-brand-PRIMARY/30"></span>
            <div className="relative z-10 text-xs font-bold text-white">
              UNI
            </div>
          </div>

          <span className="font-display text-xl font-bold text-white">
            Uniswap
          </span>
        </div>

        {/* Connect Wallet — centered top-right, visible on all devices */}
        <div className="flex items-center gap-4">
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}