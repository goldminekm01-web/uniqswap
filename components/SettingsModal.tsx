"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  onSlippageChange: (v: number) => void;
  customSlippage: string;
  onCustomSlippageChange: (v: string) => void;
  deadline: number;
  onDeadlineChange: (v: number) => void;
}

const PRESET_SLIPPAGE = [0.1, 0.5, 1.0];

export function SettingsModal({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  customSlippage,
  onCustomSlippageChange,
  deadline,
  onDeadlineChange,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-display text-lg font-semibold text-[var(--color-text)]">
            Settings
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          {/* Slippage tolerance */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              Slippage tolerance
            </label>
            <div className="mt-2 flex gap-2">
              {PRESET_SLIPPAGE.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    onSlippageChange(v);
                    onCustomSlippageChange("");
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    slippage === v && customSlippage === ""
                      ? "border-[var(--uniswap-purple)] bg-[var(--uniswap-purple)]/10 text-[var(--uniswap-purple)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="mt-2">
              <input
                type="number"
                min="0.01"
                max="50"
                step="0.01"
                placeholder="Custom…"
                value={customSlippage}
                onChange={(e) => {
                  onCustomSlippageChange(e.target.value);
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 0) onSlippageChange(num);
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--uniswap-purple)]"
              />
            </div>
          </div>

          {/* Transaction deadline */}
          <div className="mb-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              Transaction deadline (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={deadline}
              onChange={(e) => onDeadlineChange(parseInt(e.target.value, 10) || 1)}
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--uniswap-purple)]"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
