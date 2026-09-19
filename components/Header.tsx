"use client";

import { useState, useEffect } from "react";
import { WalletConnectButton } from "./WalletConnectButton";
import { Menu, X } from "lucide-react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setMobileMenuOpen(false);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

        {/* Desktop Nav — just Connect Wallet */}
        <div className="flex items-center gap-4">
          <WalletConnectButton />
        </div>

        {/* Mobile Menu Button */}
        <div className="sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-gray-400 hover:bg-dark-800/50 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu — just Connect Wallet */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-white/5">
          <div className="flex flex-col gap-3 px-4 py-4">
            <div className="flex items-center justify-between">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
