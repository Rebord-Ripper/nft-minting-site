import { useState } from "react";
import { mintV2 } from "@metaplex-foundation/mpl-candy-machine";
import {
  generateSigner,
  transactionBuilder,
  some,
  none,
  sol,
} from "@metaplex-foundation/umi";
import {
  fetchAddressLookupTable,
  setComputeUnitLimit,
  transferSol,
} from "@metaplex-foundation/mpl-toolbox";
import { base58 } from "@metaplex-foundation/umi/serializers";
import MintTimer from "./MintTimer";
import {
  chooseGuardToUse,
  mintArgsBuilder,
  routeBuilder,
  verifyTx,
} from "@/utils/mintHelper";
import { useSolanaTime } from "@/utils/SolanaTimeContext";

const MintButton = ({
  umi,
  guard,
  candyMachine,
  candyGuard,
  ownedTokens = [],
  setMintsCreated,
  onSuccess,
  setCheckEligibility,
  allowLists = new Map(),
}) => {
  const solanaTime = useSolanaTime();
  const [isMinting, setIsMinting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [quantity, setQuantity] = useState(1);

  const handleMint = async () => {
    const guardToUse = chooseGuardToUse(guard, candyGuard);
    if (!guardToUse.guards) {
      console.error("No guard defined!");
      return;
    }

    try {
      setIsMinting(true);
      setLoadingText("Preparing mint...");

      // Build and submit any required routes (for allowlist etc)
      let routeBuild = await routeBuilder(
        umi,
        guardToUse,
        candyMachine,
        allowLists
      );
      if (routeBuild) {
        setLoadingText("Approval required...");
        await routeBuild.sendAndConfirm(umi, {
          confirm: { commitment: "processed" },
          send: { skipPreflight: true },
        });
      }

      // Fetch LUT if available
      let tables = [];
      const lut = process.env.NEXT_PUBLIC_LUT;
      if (lut) {
        const lutPubKey = publicKey(lut);
        const fetchedLut = await fetchAddressLookupTable(umi, lutPubKey);
        tables = [fetchedLut];
      }

      // Create mint transactions
      const mintTxs = [];
      const nftSigners = [];
      const latestBlockhash = (await umi.rpc.getLatestBlockhash()).blockhash;

      for (let i = 0; i < quantity; i++) {
        const nftMint = generateSigner(umi);
        nftSigners.push(nftMint);

        const mintArgs = mintArgsBuilder(
          candyMachine,
          guardToUse,
          ownedTokens,
          allowLists
        );
        let tx = transactionBuilder().add(
          mintV2(umi, {
            candyMachine: candyMachine.publicKey,
            collectionMint: candyMachine.collectionMint,
            collectionUpdateAuthority: candyMachine.authority,
            nftMint,
            group:
              guardToUse.label === "default" ? none() : some(guardToUse.label),
            candyGuard: candyGuard.publicKey,
            mintArgs,
            tokenStandard: candyMachine.tokenStandard,
          })
        );

        // Add pay for devs fee (optional)
        if (process.env.NEXT_PUBLIC_DEV_FEE === "true") {
          tx = tx.prepend(
            transferSol(umi, {
              destination: publicKey(
                "B6NpJRGQrKbZxuUY6x8G4Y7mr4jo77ea4WvYc9mJmY2k"
              ),
              amount: sol(0.005),
            })
          );
        }

        tx = tx.prepend(setComputeUnitLimit(umi, { units: 800_000 }));
        tx = tx.setAddressLookupTables(tables);
        tx = tx.setBlockhash(latestBlockhash);

        const transaction = tx.build(umi);
        mintTxs.push(transaction);
      }

      if (!mintTxs.length) {
        console.error("No mint tx built!");
        return;
      }

      // Sign transactions
      setLoadingText("Please sign transaction...");
      const signedTransactions = await signAllTransactions(
        mintTxs.map((transaction, index) => ({
          transaction,
          signers: [umi.payer, nftSigners[index]],
        }))
      );

      // Send transactions
      let signatures = [];
      setLoadingText("Sending transaction...");
      const sendPromises = signedTransactions.map((tx, index) => {
        return umi.rpc
          .sendTransaction(tx, { skipPreflight: true })
          .then((signature) => {
            const txId = base58.deserialize(signature)[0];
            console.log(
              `Transaction ${index + 1} sent with signature: ${txId}`
            );
            signatures.push(signature);
            return { status: "fulfilled", value: signature };
          })
          .catch((error) => {
            console.error(`Transaction ${index + 1} failed:`, error);
            return { status: "rejected", reason: error };
          });
      });

      await Promise.allSettled(sendPromises);

      if (signatures.length === 0) {
        throw new Error("No transactions were sent successfully");
      }

      // Verify transactions and fetch NFTs
      setLoadingText("Finalizing mint...");
      const successfulMints = await verifyTx(umi, signatures, quantity);

      setLoadingText("Fetching your NFT...");
      if (successfulMints.length > 0) {
        const fetchNftPromises = successfulMints.map((mintAddress) =>
          fetchNft(umi, mintAddress).then((data) => ({
            mint: mintAddress,
            ...data,
          }))
        );

        const nftResults = await Promise.all(fetchNftPromises);
        const validNfts = nftResults
          .filter((result) => result.digitalAsset && result.jsonMetadata)
          .map((result) => ({
            mint: result.mint,
            offChainMetadata: result.jsonMetadata,
          }));

        if (validNfts.length > 0) {
          setMintsCreated(validNfts);
          if (onSuccess) onSuccess();
        }
      }
    } catch (error) {
      console.error("Minting failed:", error);
      // Show error to user
    } finally {
      setIsMinting(false);
      setLoadingText("");
      setCheckEligibility(true);
    }
  };

  // Helper function to fetch NFT data
  const fetchNft = async (umi, nftAddress) => {
    try {
      const { fetchDigitalAsset, fetchJsonMetadata } = await import(
        "@metaplex-foundation/mpl-token-metadata"
      );
      const digitalAsset = await fetchDigitalAsset(umi, nftAddress);
      const jsonMetadata = await fetchJsonMetadata(
        umi,
        digitalAsset.metadata.uri
      );
      return { digitalAsset, jsonMetadata };
    } catch (error) {
      console.error("Error fetching NFT:", error);
      return { digitalAsset: null, jsonMetadata: null };
    }
  };

  // Function to sign all transactions
  const signAllTransactions = async (transactions) => {
    return Promise.all(
      transactions.map(async ({ transaction, signers }) => {
        for (const signer of signers) {
          await transaction.sign(signer);
        }
        return transaction;
      })
    );
  };

  // Calculate if start time or end time is applicable
  const isStartTime = guard.startTime && guard.startTime > solanaTime;
  const isEndTime =
    guard.endTime &&
    guard.endTime > solanaTime &&
    (!guard.startTime || guard.startTime <= solanaTime);

  const maxQuantity = guard.maxAmount || 1;

  return (
    <div className="mt-4">
      <div className="mb-4">
        {isStartTime && (
          <MintTimer
            solanaTime={solanaTime}
            toTime={guard.startTime}
            label="Starts in"
            setCheckEligibility={setCheckEligibility}
          />
        )}

        {isEndTime && (
          <MintTimer
            solanaTime={solanaTime}
            toTime={guard.endTime}
            label="Ends in"
            setCheckEligibility={setCheckEligibility}
          />
        )}
      </div>

      {maxQuantity > 1 && (
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Quantity:
          </label>
          <div className="flex items-center">
            <input
              type="number"
              min="1"
              max={maxQuantity}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.min(Math.max(1, parseInt(e.target.value)), maxQuantity)
                )
              }
              className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline w-20"
            />
            <span className="ml-2 text-gray-600 text-sm">
              (Max: {maxQuantity})
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleMint}
        disabled={isMinting || !guard.allowed}
        className={`w-full flex justify-center items-center py-3 px-4 rounded-lg font-medium transition-colors ${
          isMinting || !guard.allowed
            ? "bg-gray-400 text-gray-100 cursor-not-allowed"
            : "bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600"
        }`}
      >
        {isMinting ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {loadingText || "Minting..."}
          </>
        ) : guard.allowed ? (
          `Mint ${quantity > 1 ? `${quantity} NFTs` : "NFT"}`
        ) : (
          guard.reason || "Not Eligible"
        )}
      </button>
    </div>
  );
};

export default MintButton;
