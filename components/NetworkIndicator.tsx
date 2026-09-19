"use client";

import { useChainId, useChains } from "wagmi";
import { useState, useEffect } from "react";
import { SWAP_CONFIG } from "@/config/swapConfig";
import { AlertCircle, CheckCircle, WifiOff } from "lucide-react";

export function NetworkIndicator() {
  const chainId = useChainId();
  const chains = useChains();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const currentChain = chains?.find((c: { id: number; name?: string }) => c.id === chainId);
  const chainName = currentChain?.name || SWAP_CONFIG.network.chainName;
  const isConfiguredChain = chainId === SWAP_CONFIG.network.chainId;

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-dark-800/40 px-3 py-1.5 text-sm">
      {isOnline ? (
        <CheckCircle className="h-4 w-4 text-brand-green" />
      ) : (
        <WifiOff className="h-4 w-4 text-brand-red" />
      )}
      <span
        className={`hidden sm:inline text-xs ${isOnline ? "text-gray-300" : "text-brand-red"}`}
      >
        {isOnline ? "Online" : "Offline"}
      </span>
      <span className="text-gray-600">·</span>
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-white/10 bg-dark-900/60 px-2 py-0.5 text-xs font-medium ${
          isConfiguredChain ? "text-brand-green" : "text-brand-accent"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isConfiguredChain ? "bg-brand-green" : "bg-brand-accent"
          }`}
        />
        {chainName?.split(" ").slice(0, 2).join(" ")}
      </span>
      {!isConfiguredChain && <AlertCircle className="h-3 w-3 text-brand-accent" />}
    </div>
  );
}
