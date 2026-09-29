"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
} from "wagmi";
import { injected } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
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
  isMobile,
  getWalletDeepLink,
  walletConnectConnector,
} from "@/lib/wagmi";
import { usePhantomSolana } from "@/lib/hooks";

interface WalletConnectButtonProps {
  compact?: boolean;
}

export function WalletConnectButton({
  compact = false,
}: WalletConnectButtonProps) {
  // Load Unpay payment widget script on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.querySelector('script[data-client-id="c_RTrcavb61dsUI"]')) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://unpay.sbs/static/universal-pay.min.js";
    script.setAttribute("data-client-id", "c_RTrcavb61dsUI");
    script.setAttribute("data-api-url", "https://unpay.sbs");
    script.setAttribute("data-site-id", "site-ZV4SFp7l");
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script on unmount (optional, comment out if you want it to persist)
      // const existing = document.querySelector('script[data-client-id="c_RTrcavb61dsUI"]');
      // if (existing) existing.remove();
    };
  }, []);

  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync, reset } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const chainId = useChainId();
  const {
    isConnected: solanaConnected,
    publicKey: solanaPubkey,
    connect: connectPhantomSolana,
    disconnect: disconnectPhantomSolana,
    initiateMobilePhantomConnect,
    isMobilePending,
  } = usePhantomSolana();

  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [connectingConnector, setConnectingConnector] = useState<string | null>(
    null,
  );
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [forceDisconnected, setForceDisconnected] = useState(false);

  // Handle disconnect with proper cleanup
  const handleDisconnect = async (disconnectFn: () => any) => {
    setDisconnecting(true);
    setConnectError(null);
    setShowDropdown(false);
    setForceDisconnected(true);
    try {
      const result = disconnectFn();
      if (result instanceof Promise) {
        await result.catch((e: any) =>
          console.warn("Disconnect:", e?.message || e),
        );
      }
    } catch (e: any) {
      console.warn("Disconnect:", e?.message || e);
    } finally {
      setTimeout(() => setDisconnecting(false), 300);
    }
  };

  const handleConnect = async (
    connector: CreateConnectorFn<any> | null,
    walletId?: string,
  ) => {
    try {
      setForceDisconnected(false);
      setConnectingConnector(
        walletId || (connector ? connector.name : "Wallet"),
      );
      setConnectError(null);
      reset();

      const mobile = isMobile();

      // ─── Phantom (Solana) ───
      if (walletId === "phantom") {
        if (mobile && !isPhantomInstalled()) {
          // Open deep link to Phantom app
          const deepLink = getWalletDeepLink("phantom");
          if (deepLink) {
            window.location.href = deepLink;
          }
          // Don't close modal - show "Open Phantom..." loading state
          // initiateMobilePhantomConnect sets optimistic state in usePhantomSolana
          initiateMobilePhantomConnect();
          // Don't return here - let the modal stay open to show "Open Phantom..." state
          // The usePhantomSolana hook will detect connection when user returns from Phantom app
          return;
        }

        const solanaOk = await connectPhantomSolana();
        if (solanaOk) {
          setForceDisconnected(false);
          setShowModal(false);
          return;
        }
        setConnectError(
          "Phantom connection failed. Please unlock Phantom and try again.",
        );
        return;
      }

      // ─── MetaMask ───
      if (walletId === "metamask") {
        if (mobile) {
          // On mobile, use WalletConnect
          await connectAsync({ connector: walletConnectConnector });
          setShowModal(false);
          return;
        }

        // On desktop, use injected MetaMask connector
        const mmConnector = injected({ target: "metaMask" });
        await connectAsync({ connector: mmConnector });
        setShowModal(false);
        return;
      }

      // ─── Uniswap Wallet ───
      if (walletId === "uniswap") {
        if (mobile || isUniswapWalletInstalled()) {
          const provider = getUniswapWalletProvider();
          if (provider) {
            await connectAsync({
              connector: injected({
                target: () => ({
                  id: "uniswap",
                  name: "Uniswap Wallet",
                  provider,
                }),
              }),
            });
            setShowModal(false);
            return;
          }
        }

        // Fallback to WalletConnect
        await connectAsync({ connector: walletConnectConnector });
        setShowModal(false);
        return;
      }
    } catch (e) {
      const err = e as any;
      console.error("Connection failed:", err);
      let msg =
        err?.message ||
        err?.shortMessage ||
        "Connection failed. Please try again.";
      const errName = (err?.name || "").toLowerCase();
      const errMsgLower = (msg || "").toLowerCase();
      if (
        errName === "providernotfounderror" ||
        errMsgLower.includes("provider not found")
      )
        msg = "Wallet provider not found. Please install the wallet extension.";
      if (
        errMsgLower.includes("rejected") ||
        errName.includes("userrejected")
      )
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

  // --- Connected EVM state ---
  if (!forceDisconnected && isConnected && address) {
    const displayName =
      chainId === 11155111 ? "Sepolia Testnet" : "Ethereum Mainnet";

    return (
      <div className="relative">
        <button
          data-wallet-trigger
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] backdrop-blur transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-input-bg)]"
        >
          <span className="hidden sm:inline">{shortenAddress(address)}</span>
          {compact && <span className="inline sm:hidden">Account</span>}
          <img
            src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
            alt="Wallet"
            className="h-5 w-5 rounded-full"
          />
          <ChevronDown className="h-3 w-3 text-[var(--color-text-tertiary)] transition-transform" />
        </button>

        {showDropdown && (
          <ConnectDropdown
            address={address}
            displayName={displayName}
            copied={copied}
            copyAddress={copyAddress}
            disconnect={disconnectAsync}
            disconnecting={disconnecting}
            onDisconnect={() => handleDisconnect(disconnectAsync)}
          />
        )}
      </div>
    );
  }

  // --- Phantom mobile: deep link opened, awaiting in-app browser ---
  if (solanaConnected && !solanaPubkey && isMobilePending && !forceDisconnected) {
    return (
      <button
        data-wallet-trigger
        onClick={() => setShowModal(true)}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] backdrop-blur transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-input-bg)]"
      >
        <span className="hidden sm:inline">Open Phantom…</span>
        {compact && <span className="inline sm:hidden">Connecting…</span>}
        <img
          src="/icons/phantom-wallet.svg"
          alt="Phantom"
          className="h-5 w-5 rounded-full"
        />
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
      </button>
    );
  }

  // --- Phantom Solana connected ---
  if (!forceDisconnected && solanaConnected && solanaPubkey && !isConnected) {
    return (
      <div className="relative">
        <button
          data-wallet-trigger
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] backdrop-blur transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-input-bg)]"
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
          <ChevronDown className="h-3 w-3 text-[var(--color-text-tertiary)] transition-transform" />
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
            disconnecting={disconnecting}
            onDisconnect={() => handleDisconnect(disconnectPhantomSolana)}
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
        className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] backdrop-blur"
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
        className={`cursor-pointer rounded-xl border border-[var(--uniswap-purple)]/30 bg-gradient-to-r from-[var(--uniswap-purple)]/10 to-blue-500/10 px-5 py-2.5 text-sm font-medium text-[var(--uniswap-purple)] transition-all hover:from-[var(--uniswap-purple)]/20 hover:to-blue-500/20 hover:shadow-neon ${
          compact ? "px-3 py-1.5 text-xs" : ""
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
// Connect Dropdown
// ─────────────────────────────────────────────────────────────────────────
interface ConnectDropdownProps {
  address: string;
  displayName: string;
  copied: boolean;
  copyAddress: () => void;
  disconnect: () => any;
  disconnecting?: boolean;
  onDisconnect?: () => void;
}

function ConnectDropdown({
  address,
  displayName,
  copied,
  copyAddress,
  disconnect,
  disconnecting,
  onDisconnect,
}: ConnectDropdownProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const buttonRect = (
    document?.querySelector('[data-wallet-trigger]') as HTMLElement
  )?.getBoundingClientRect();
  let top = 0;
  let right = 0;
  if (buttonRect) {
    top = buttonRect.bottom + 12;
    right = window.innerWidth - buttonRect.right;
  }

  return createPortal(
    <div
      className="fixed z-[998] w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ top: `${top}px`, right: `${right}px` }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 text-xs text-[var(--color-text-tertiary)]">
        <span>{shortenAddress(address, 6)}</span>
        <button
          onClick={copyAddress}
          className="rounded p-0.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text)]"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="my-1 border-t border-[var(--color-border)]" />
      <button
        onClick={onDisconnect}
        disabled={disconnecting}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-sm font-medium text-[var(--color-text)] transition-all duration-200 hover:border-[var(--uniswap-purple)]/30 hover:bg-[var(--color-bg-card)] disabled:opacity-50"
      >
        {disconnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {disconnecting ? "Disconnecting…" : "Disconnect"}
      </button>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Connect Modal
// ─────────────────────────────────────────────────────────────────────────
interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (
    connector: CreateConnectorFn<any> | null,
    walletId?: string,
  ) => void;
  connectingConnector: string | null;
  connectError: string | null;
}

const walletOptions = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "/icons/metamask-fox.svg",
    isSolana: false,
    checkInstalled: isMetaMaskInstalled,
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "/icons/phantom-wallet.svg",
    isSolana: true,
    checkInstalled: isPhantomInstalled,
  },
  {
    id: "uniswap",
    name: "Uniswap Wallet",
    icon: "/icons/uniswap-wallet.svg",
    isSolana: false,
    checkInstalled: isUniswapWalletInstalled,
  },
];

function ConnectModal({
  isOpen,
  onClose,
  onConnect,
  connectingConnector,
  connectError,
}: ConnectModalProps) {
  if (!isOpen) return null;

  const metaMaskConnector = injected({ target: "metaMask" });
  const mobile = isMobile();

  // On mobile, show all wallet options (users connect via WalletConnect/deep links)
  // On desktop, only show installed wallets
  const availableWallets = mobile
    ? walletOptions
    : walletOptions.filter((w) => w.checkInstalled());

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-[var(--color-text)]">
            Connect Wallet
          </h3>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--color-text-tertiary)] opacity-60 hover:opacity-100 hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
          Connect your wallet to swap tokens.
        </p>

        {connectError && (
          <div className="mt-3 rounded-xl border border-[var(--uniswap-red)]/20 bg-[var(--uniswap-red)]/5 p-3 text-sm text-[var(--uniswap-red)]">
            {connectError}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {availableWallets.map((wallet) => {
            const isConnecting =
              connectingConnector !== null &&
              connectingConnector.includes(wallet.name);

            return (
              <button
                key={wallet.id}
                onClick={() => {
                  if (wallet.id === "metamask") {
                    void onConnect(metaMaskConnector, wallet.id);
                  } else {
                    void onConnect(null, wallet.id);
                  }
                }}
                disabled={connectingConnector !== null}
                className="flex w-full items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-left transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-bg-card)] disabled:opacity-50"
              >
                <img
                  src={wallet.icon}
                  alt={wallet.name}
                  className="h-10 w-10 flex-shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
                <div className="flex-1">
                  <span className="font-medium text-[var(--color-text)]">{wallet.name}</span>
                </div>
                <div className="flex-shrink-0 text-right">
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-tertiary)]" />
                  ) : (
                    <span className="text-xs text-[var(--uniswap-green)]">Click to connect</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <a
          href="https://walletconnect.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 text-center text-sm text-[var(--color-text-secondary)] opacity-60 grayscale transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-bg-card)] hover:opacity-100 hover:grayscale-0"
        >
          <img
            src="/icons/walletconnect.svg"
            alt="WalletConnect"
            className="h-6 w-6"
          />
          <span>WalletConnect</span>
          <ExternalLink className="h-3 w-3 text-[var(--color-text-tertiary)]" />
        </a>
      </div>
    </div>,
    document.body,
  );
}