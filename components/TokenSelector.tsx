"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { SWAP_CONFIG, type TokenKey } from "@/config/swapConfig";
import { useTokenInfo } from "@/lib/hooks";
import { useAccount } from "wagmi";

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenKey) => void;
  exclude?: TokenKey;
  title?: string;
}

const ALL_TOKENS: TokenKey[] = ["eth", "usdt", "usdc", "dai", "wbtc", "btc"];

export function TokenSelector({
  isOpen,
  onClose,
  onSelect,
  exclude,
  title = "Select a token",
}: TokenSelectorProps) {
  const [search, setSearch] = useState("");
  const { address, isConnected } = useAccount();

  // Fetch balances for all tokens so the selector can show them
  const eth = useTokenInfo("eth");
  const usdt = useTokenInfo("usdt");
  const usdc = useTokenInfo("usdc");
  const dai = useTokenInfo("dai");
  const wbtc = useTokenInfo("wbtc");
  const btc = useTokenInfo("btc");

  const tokenDataMap: Record<TokenKey, ReturnType<typeof useTokenInfo>> = {
    eth,
    usdt,
    usdc,
    dai,
    wbtc,
    btc,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_TOKENS.filter((k) => {
      if (k === exclude) return false;
      const cfg = SWAP_CONFIG.tokens[k];
      if (!q) return true;
      return (
        cfg.symbol.toLowerCase().includes(q) ||
        cfg.name.toLowerCase().includes(q)
      );
    });
  }, [search, exclude]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-display text-lg font-semibold text-[var(--color-text)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search by name or symbol…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--uniswap-purple)]"
              autoFocus
            />
          </div>
        </div>

        {/* Token list */}
        <div className="max-h-80 overflow-y-auto px-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              No tokens found
            </div>
          ) : (
            filtered.map((tk) => {
              const cfg = SWAP_CONFIG.tokens[tk];
              const data = tokenDataMap[tk];
              const symbol = data.symbol || cfg.symbol;
              const balance = data.balanceFormatted;
              const isNative = cfg.isNative;

              return (
                <button
                  key={tk}
                  onClick={() => {
                    onSelect(tk);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-elevated)]"
                >
                  <img
                    src={cfg.icon}
                    alt={symbol}
                    className="h-8 w-8 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${symbol}`;
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[var(--color-text)]">
                        {symbol}
                      </span>
                      {isNative && (
                        <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                          NATIVE
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {cfg.name}
                    </span>
                  </div>
                  {isConnected && balance !== null && (
                    <div className="text-right text-sm text-[var(--color-text-secondary)]">
                      {balance}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
          {isConnected
            ? `${address?.slice(0, 6)}…${address?.slice(-4)}`
            : "Connect wallet to see balances"}
        </div>
      </div>
    </div>,
    document.body
  );
}
