import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Uniswap — Web3 Swap Interface",
  description:
    "Swap native tokens (ETH, USDT, BT-c) to KSH. Connect your wallet to view balances and swap.",
  keywords: [
    "Web3",
    "Uniswap",
    "Swap",
    "Phantom",
    "MetaMask",
    "Brave",
    "Base Wallet",
    "ERC-20",
    "BT-c",
    "Solana SPL Token",
    "KSH",
    "Ethereum",
  ],
  authors: [{ name: "Lazurus Group" }],
  openGraph: {
    title: "Uniswap — Web3 Swap Interface",
    description:
      "Swap native tokens to KSH. Connect your wallet to view balances and swap.",
    url: "https://lazurusgroup.com",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
