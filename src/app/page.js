"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";
import { UmiProvider } from "../utils/UmiProvider";
import { SolanaTimeProvider } from "../utils/SolanaTimeContext";
import MintContainer from "../components/MintContainer";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { publicKey } from "@metaplex-foundation/umi";
import dynamic from "next/dynamic";

export default function Home() {
  // Initialize wallet adapters
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  // Set up network and RPC endpoint
  let network = WalletAdapterNetwork.Devnet;
  if (
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet-beta" ||
    process.env.NEXT_PUBLIC_ENVIRONMENT === "mainnet"
  ) {
    network = WalletAdapterNetwork.Mainnet;
  }

  let endpoint = "https://api.devnet.solana.com";
  if (process.env.NEXT_PUBLIC_RPC) {
    endpoint = process.env.NEXT_PUBLIC_RPC;
  }

  // Get candy machine ID from environment
  const candyMachineId = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID
    ? publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID)
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <WalletProvider wallets={wallets}>
        <UmiProvider endpoint={endpoint}>
          <WalletModalProvider>
            <SolanaTimeProvider>
              <div className="container mx-auto py-8">
                <header className="mb-8 text-center">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    NFT Minting Site
                  </h1>
                  <p className="text-lg text-gray-600">
                    Mint your exclusive NFTs on Solana
                  </p>
                </header>

                <MintContainer candyMachineId={candyMachineId} />

                <footer className="mt-12 text-center text-gray-500 text-sm">
                  <p>
                    © {new Date().getFullYear()} NFT Minting Site. Built with
                    Next.js and Tailwind CSS.
                  </p>
                </footer>
              </div>
            </SolanaTimeProvider>
          </WalletModalProvider>
        </UmiProvider>
      </WalletProvider>
    </main>
  );
}
