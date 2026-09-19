"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  Copy,
  Check,
  ExternalLink,
  Info,
  BarChart3,
  Wallet,
  Shield,
} from "lucide-react";
import { SWAP_CONFIG } from "@/config/swapConfig";
import { shortenAddress } from "@/lib/utils";
import { useTokenInfo } from "@/lib/hooks";
import type { TokenKey } from "@/lib/swap";

export function TokenDetails() {
  const { isConnected } = useAccount();
  const btcData = useTokenInfo("btc");
  const ethData = useTokenInfo("eth");
  const usdtData = useTokenInfo("usdt");
  const kshData = useTokenInfo("ksh");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const tokenDataMap: Record<TokenKey, typeof btcData> = {
    btc: btcData,
    eth: ethData,
    usdt: usdtData,
    ksh: kshData,
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const renderTokenPanel = (tokenKey: TokenKey, title: string) => {
    const tokenConfig = SWAP_CONFIG.tokens[tokenKey];
    const tokenData = tokenDataMap[tokenKey];
    const addressUsed = tokenData.addressUsed || tokenConfig.contractAddress || "";
    const isEvmValid = tokenData.isEvmValid;
    const symbol = tokenData.symbol || tokenConfig.symbol;

    // Use the correct blockchain explorer based on the token's chain
    const explorerUrl =
      tokenConfig.chain === "solana"
        ? SWAP_CONFIG.network.solanaExplorerUrl
        : SWAP_CONFIG.network.blockExplorerUrl;

    const rows: Array<{
      label: string;
      value: string;
      icon: any;
      isAddress?: boolean;
      address?: string;
      isStatus?: boolean;
      status?: boolean;
    }> = [
      { label: "Token Name", value: tokenData.name || tokenConfig.name, icon: Info },
      { label: "Symbol", value: symbol, icon: BarChart3 },
      { label: "Decimals", value: String(tokenData.decimals ?? tokenConfig.decimals), icon: Info },
      {
        label: "Contract Address",
        value: addressUsed,
        icon: Shield,
        isAddress: true,
        address: addressUsed,
      },
      {
        label: "Wallet Balance",
        value: tokenData.balanceFormatted
          ? `${tokenData.balanceFormatted} ${symbol}`
          : isConnected
            ? tokenData.isLoading
              ? "Loading…"
              : "0.00"
            : "Not connected",
        icon: Wallet,
      },
    ];

    // Only show EVM compatibility for non-native tokens
    if (!tokenConfig.isNative) {
      rows.push({
        label: "EVM Compatible",
        value: isEvmValid ? "Yes" : "No",
        icon: Shield,
        isStatus: true,
        status: isEvmValid,
      });
    }

    return (
      <div className="rounded-2xl border border-white/10 bg-dark-800/60 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-3">
          <img
            src={tokenConfig.icon}
            alt={symbol}
            className="h-8 w-8 rounded-full"
          />
          <h3 className="font-display text-lg font-semibold text-white">
            {title}
          </h3>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 text-sm"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-dark-900/50">
                <row.icon className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-gray-500">{row.label}</span>
                <div className="flex items-center gap-2">
                  {row.isAddress && row.address ? (
                    <>
                      <code className="text-xs text-gray-300">
                        {shortenAddress(row.address)}
                      </code>
                      <button
                        onClick={() => copyAddress(row.address!)}
                        className="rounded p-0.5 text-gray-500 hover:text-white"
                        title="Copy address"
                      >
                        {copiedAddress === row.address ? (
                          <Check className="h-3 w-3 text-brand-green" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <a
                        href={`${explorerUrl}/address/${row.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-brand-PRIMARY"
                        title="View on block explorer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  ) : row.isStatus ? (
                    <span
                      className={`text-xs font-medium ${
                        row.status
                          ? "text-brand-green"
                          : "text-brand-accent"
                      }`}
                    >
                      {row.status ? "✓ Detected" : "⚠ Not EVM Compatible"}
                    </span>
                  ) : (
                    <span className="text-gray-200">{row.value}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {tokenData.error && (
          <div className="mt-3 rounded-lg border border-brand-red/20 bg-brand-red/5 p-2">
            <span className="text-xs text-brand-red">
              Error fetching token data: {tokenData.error}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      id="details"
      className="mb-8 grid gap-6 md:grid-cols-2"
    >
      {renderTokenPanel("btc", "BT-c Token Details")}
      {renderTokenPanel("eth", "ETH (Native) Details")}
      {renderTokenPanel("usdt", "USDT Token Details")}
      {renderTokenPanel("ksh", "KSH Token Details")}
    </section>
  );
}
