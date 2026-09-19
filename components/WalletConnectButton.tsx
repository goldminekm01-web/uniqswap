"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
} from "wagmi";
import { injected } from "wagmi/connectors";
import type { Connector, CreateConnectorFn } from "wagmi";
import {
  Copy,
  Check,
  Loader2,
  LogOut,
  ExternalLink,
  ChevronDown,
  X,
} from "lucide-react";
import { shortenAddress } from "@/lib/utils";
import {
  isMetaMaskInstalled,
  isPhantomInstalled,
  isUniswapWalletInstalled,
  getUniswapWalletProvider,
} from "@/lib/wagmi";
import { usePhantomSolana } from "@/lib/hooks";

interface WalletConnectButtonProps {
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Wallet definitions — each entry maps a wallet to its icon, connector
// factory, install link, and detection helper.
// ─────────────────────────────────────────────────────────────────────────
interface WalletOption {
  id: string;
  name: string;
  icon: string; // path to /icons/*.svg
  connector: CreateConnectorFn<any> | null;
  installed: boolean;
  isSolana?: boolean; // true = Solana-only wallet (Phantom), no wagmi/EVM
  installUrl?: string;
}

function useWalletOptions(connectingConnector: string | null) {
  // Initialize state synchronously so the first render reflects actual wallet state
  const [mmInstalled, setMmInstalled] = useState(isMetaMaskInstalled());
  const [phantomInstalled, setPhantomInstalled] = useState(isPhantomInstalled());
  const [uniswapInstalled, setUniswapInstalled] = useState(
    isUniswapWalletInstalled(),
  );

  useEffect(() => {
    const detect = () => {
      setMmInstalled(isMetaMaskInstalled());
      setPhantomInstalled(isPhantomInstalled());
      setUniswapInstalled(isUniswapWalletInstalled());
    };

    // Immediate recheck (after mount, DOM ready)
    detect();

    // Delayed rechecks — browser extensions load async
    const t1 = setTimeout(detect, 500);
    const t2 = setTimeout(detect, 1500);

    // Listen for ethereum provider injection events
    const handleChainChanged = () => detect();
    if (typeof window !== "undefined") {
      window.addEventListener("ethereum#initialized", detect);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (typeof window !== "undefined") {
        window.removeEventListener("ethereum#initialized", detect);
      }
    };
  }, []);

  // Phantom is a Solana-only wallet — uses window.phantom.solana directly,
  // NOT wagmi/EVM. No Phantom EVM provider needed.
  // Phantom connector — removed from wagmi/EVM flow entirely

  // Uniswap Wallet connector — EVM-only
  const uniswapConnector = isUniswapWalletInstalled()
    ? injected({
        target: () => ({
          id: "uniswap",
          name: "Uniswap Wallet",
          provider: getUniswapWalletProvider(),
        }),
      })
    : null;

  const wallets: WalletOption[] = [
    {
      id: "metamask",
      name: "MetaMask",
      icon: "/icons/metamask-fox.svg",
      connector: injected({ target: "metaMask" }),
      installed: mmInstalled,
      installUrl: "https://metamask.io/download/",
    },
    {
      id: "phantom",
      name: "Phantom",
      icon: "/icons/phantom-wallet.svg",
      connector: null, // Solana wallet — no wagmi connector
      isSolana: true,
      installed: phantomInstalled,
      installUrl: "https://phantom.app/download",
    },
    {
      id: "uniswap",
      name: "Uniswap Wallet",
      icon: "/icons/uniswap-wallet.svg",
      connector: uniswapConnector,
      installed: uniswapInstalled,
      installUrl: "https://uniswap.org/wallet",
    },
  ];

  return wallets;
}

export function WalletConnectButton({
  compact = false,
}: WalletConnectButtonProps) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync, error: connectHookError, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { isConnected: solanaConnected, publicKey: solanaPubkey, connect: connectPhantomSolana, disconnect: disconnectPhantomSolana } = usePhantomSolana();

  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [connectingConnector, setConnectingConnector] = useState<string | null>(
    null,
  );

  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async (connector: CreateConnectorFn<any> | null, walletId?: string) => {
    try {
      setConnectingConnector(walletId || (connector ? connector.name : "Wallet"));
      setConnectError(null);
      reset(); // Clear any previous mutation error

      // ─── Phantom — pure Solana connection (no wagmi/EVM) ───
      // Uses window.phantom.solana directly. No ProviderNotFoundError possible.
      if (walletId === "phantom") {
        const solanaOk = await connectPhantomSolana();
        if (solanaOk) {
          setShowModal(false);
          return;
        }
        setConnectError(
          "Phantom connection failed. Please unlock Phantom and try again.",
        );
        return;
      }

      // ─── EVM wallets (MetaMask, Uniswap Wallet) ───
      if (connector) {
        await connectAsync({ connector });
        // connectAsync may resolve even when wagmi sets an internal error
        if (connectHookError) {
          throw connectHookError;
        }
        setShowModal(false);
      }
    } catch (e) {
      const err = e as any;
      // Extract error name and message for matching
      const errName = (err?.name || "").toLowerCase();
      const errMsgLower = (err?.message || "").toLowerCase();
      console.error("Connection failed:", err);
      // Extract a user-friendly error message
      let msg =
        err?.message ||
        err?.shortMessage ||
        (err?.cause && typeof err?.cause === "object" && "message" in err?.cause
          ? (err?.cause as Error).message
          : "Connection failed. Please try again.");
      const errName2 = (err?.name || "").toLowerCase();
      const errMsgLower2 = msg?.toLowerCase() || "";
      // Simplify common errors
      if (errName2 === "providernotfounderror" || errMsgLower2.includes("provider not found"))
        msg = "Wallet provider not found. Please install the wallet extension.";
      if (errMsgLower2.includes("rejected") || errName2.includes("userrejected"))
        msg = "Connection rejected. Please approve in your wallet.";
      setConnectError(msg);
    } finally {
      setConnectingConnector(null);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- Connected state ---
  if (isConnected && address) {
    const displayName =
      chainId === 11155111 ? "Sepolia Testnet" : "Ethereum Mainnet";

    return (
      <div className="relative">
        <button
          data-wallet-trigger
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-dark-800/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition-all hover:border-white/20 hover:bg-dark-800/50"
        >
          <span className="hidden sm:inline">
            {shortenAddress(address)}
          </span>
          {compact && <span className="inline sm:hidden">Account</span>}
          <img
            src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
            alt="Wallet"
            className="h-5 w-5 rounded-full"
          />
          <ChevronDown className="h-3 w-3 text-gray-400 transition-transform" />
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <ConnectDropdown
            address={address}
            displayName={displayName}
            copied={copied}
            copyAddress={copyAddress}
            disconnect={disconnect}
          />
        )}
      </div>
    );
  }

  // --- Phantom Solana connected (EVM not available) ---
  if (solanaConnected && solanaPubkey && !isConnected) {
    return (
      <div className="relative">
        <button
          data-wallet-trigger
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-dark-800/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition-all hover:border-white/20 hover:bg-dark-800/50"
        >
          <span className="hidden sm:inline">
            {shortenAddress(solanaPubkey, 6)}
          </span>
          {compact && <span className="inline sm:hidden">Account</span>}
          <img
            src="/icons/phantom-wallet.svg"
            alt="Phantom"
            className="h-5 w-5 rounded-full"
          />
          <ChevronDown className="h-3 w-3 text-gray-400 transition-transform" />
        </button>
        {showDropdown && (
          <ConnectDropdown
            address={solanaPubkey}
            displayName="Phantom Solana"
            copied={copied}
            copyAddress={() => {
              navigator.clipboard.writeText(solanaPubkey);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            disconnect={disconnectPhantomSolana}
          />
        )}
      </div>
    );
  }

  // --- Connecting state ---
  if (isConnecting || connectingConnector) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-full border border-white/10 bg-dark-800/30 px-4 py-2 text-sm font-medium text-gray-300 backdrop-blur"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{connectingConnector || "Connecting…"}</span>
      </button>
    );
  }

  // --- Disconnected state ---
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`cursor-pointer rounded-full border border-brand-PRIMARY/30 bg-gradient-to-r from-brand-PRIMARY/10 to-blue-500/10 px-6 py-3 text-sm font-medium text-brand-PRIMARY shadow-lg shadow-brand-PRIMARY/5 transition-all hover:from-brand-PRIMARY/20 hover:to-blue-500/20 hover:shadow-neon ${
          compact ? "px-2.5 py-1.5 text-xs" : ""
        }`}
      >
        {compact ? "Connect" : "Connect Wallet"}
      </button>

      <ConnectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConnect={handleConnect}
        connectingConnector={connectingConnector}
        connectError={connectError}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Connect Dropdown — portal-based, escaped from all stacking contexts
// ─────────────────────────────────────────────────────────────────────────
interface ConnectDropdownProps {
  address: string;
  displayName: string;
  copied: boolean;
  copyAddress: () => void;
  disconnect: () => void;
}

function ConnectDropdown({
  address,
  displayName,
  copied,
  copyAddress,
  disconnect,
}: ConnectDropdownProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Calculate position relative to the trigger button
  // The trigger button is inside the Header, so we need to calculate
  // its position and place the dropdown below it using fixed positioning
  const buttonRect = (document?.querySelector('[data-wallet-trigger]') as HTMLElement)?.getBoundingClientRect();
  let top = 0;
  let right = 0;
  if (buttonRect) {
    top = buttonRect.bottom + 12; // 12px (mt-3)
    right = window.innerWidth - buttonRect.right;
  }

  return createPortal(
    <div
      className="fixed z-[998] w-72 rounded-2xl border border-white/10 bg-dark-800/30 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ top: `${top}px`, right: `${right}px` }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 text-xs text-gray-400">
        <span>{shortenAddress(address, 6)}</span>
        <button
          onClick={copyAddress}
          className="rounded p-0.5 text-gray-400 hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="my-1 border-t border-white/5" />
      <div className="px-3 py-2 text-xs">
        <span className="block text-gray-400">Connected to</span>
        <span className="font-medium text-white">{displayName}</span>
      </div>
      <button
        onClick={() => disconnect()}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Disconnect
      </button>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Connect Modal — Uniswap-style wallet selection modal
// ─────────────────────────────────────────────────────────────────────────
interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connector: CreateConnectorFn<any> | null, walletId?: string) => void;
  connectingConnector: string | null;
  connectError: string | null;
}

function ConnectModal({
  isOpen,
  onClose,
  onConnect,
  connectingConnector,
  connectError,
}: ConnectModalProps) {
  // Hooks must be called BEFORE any early return (React Rules of Hooks)
  const wallets = useWalletOptions(connectingConnector);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal — centered, dark, polished, glass surface */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-dark-800/20 p-8 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-white">
            Connect Wallet
          </h3>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 opacity-60 hover:opacity-100 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-gray-400">
          Connect your wallet to swap tokens and view your balance.
        </p>

        {/* Error message */}
        {connectError && (
          <div className="mt-3 rounded-xl border border-brand-red/20 bg-brand-red/5 p-3 text-sm text-brand-red">
            {connectError}
          </div>
        )}

        {/* Wallet options */}
        <div className="mt-6 space-y-3">
          {wallets.map((wallet) => {
            const isConnecting =
              connectingConnector !== null &&
              connectingConnector.includes(wallet.name);

            return (
              <div
                key={wallet.id}
                className={
                  wallet.installed && wallet.connector
                    ? "cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-0.5 shadow-inner transition-all hover:border-white/20 hover:bg-white/10"
                    : "rounded-2xl border border-white/5 bg-white/3 p-0.5"
                }
              >
                {wallet.installed && (wallet.connector || wallet.isSolana) ? (
                  <button
                    onClick={() => {
                      if (wallet.isSolana) {
                        void onConnect(null, wallet.id); // Solana wallet — no wagmi
                      } else if (wallet.connector) {
                        void onConnect(wallet.connector, wallet.id);
                      }
                    }}
                    disabled={connectingConnector !== null}
                    className="flex w-full items-center gap-4 rounded-xl bg-transparent px-4 py-3.5 text-left transition-all disabled:opacity-50"
                  >
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="h-8 w-8 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-white">
                        {wallet.name}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <span className="text-xs text-brand-green">✓ Detected</span>
                      )}
                    </div>
                  </button>
                ) : (
                  <a
                    href={wallet.installUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition-all hover:bg-white/5"
                  >
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="h-8 w-8 flex-shrink-0 opacity-40 grayscale"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-400">
                        {wallet.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        Not installed
                      </span>
                    </div>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-500 transition-colors" />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* WalletConnect — bottom option */}
        <a
          href="https://walletconnect.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-300 opacity-60 grayscale transition-all hover:border-white/20 hover:bg-white/10 hover:opacity-100 hover:grayscale-0"
        >
          <img
            src="/icons/walletconnect.svg"
            alt="WalletConnect"
            className="h-6 w-6"
          />
          <span>WalletConnect</span>
          <ExternalLink className="h-3 w-3 text-gray-500" />
        </a>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By connecting, you agree to our Terms of Service.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
