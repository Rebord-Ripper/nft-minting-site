import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUmi } from "../utils/UmiProvider";
import { useSolanaTime } from "../utils/SolanaTimeContext";
import { guardChecker } from "../utils/guardChecker";
import MintGroup from "./MintGroup";
import { MintedNftDisplay } from "./NftDisplay";
import WalletButton from "./WalletButton";

const MintContainer = ({ candyMachineId }) => {
  const umi = useUmi();
  const { connected } = useWallet();
  const solanaTime = useSolanaTime();

  const [loading, setLoading] = useState(true);
  const [candyMachine, setCandyMachine] = useState();
  const [candyGuard, setCandyGuard] = useState();
  const [guardGroups, setGuardGroups] = useState([]);
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [mintsCreated, setMintsCreated] = useState();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [checkEligibility, setCheckEligibility] = useState(true);
  const [progress, setProgress] = useState(0);
  const [solPrice, setSolPrice] = useState(0);

  // Fetch SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await response.json();
        if (data.solana && data.solana.usd) {
          setSolPrice(data.solana.usd);
        }
      } catch (error) {
        console.error("Error fetching SOL price:", error);
      }
    };

    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000); // Update price every minute

    return () => clearInterval(interval);
  }, []);

  // Load Candy Machine
  useEffect(() => {
    const loadCandyMachine = async () => {
      if (!checkEligibility || !candyMachineId) return;

      try {
        setLoading(true);

        const { fetchCandyMachine, safeFetchCandyGuard, AccountVersion } =
          await import("@metaplex-foundation/mpl-candy-machine");

        // Fetch candy machine
        const candyMachine = await fetchCandyMachine(umi, candyMachineId);

        // Verify version
        if (candyMachine.version !== AccountVersion.V2) {
          console.error(
            "Wrong candy machine account version! Please use Account Version 2"
          );
          setLoading(false);
          return;
        }

        setCandyMachine(candyMachine);

        // Calculate progress
        const itemsRedeemed = Number(candyMachine.itemsRedeemed);
        const itemsAvailable = Number(candyMachine.data.itemsAvailable);
        setProgress(Math.floor((itemsRedeemed / itemsAvailable) * 100));

        // Fetch candy guard
        const candyGuard = await safeFetchCandyGuard(
          umi,
          candyMachine.mintAuthority
        );
        setCandyGuard(candyGuard);

        setCheckEligibility(false);
      } catch (error) {
        console.error("Error loading candy machine:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCandyMachine();
  }, [umi, candyMachineId, checkEligibility]);

  // Check guard eligibility
  useEffect(() => {
    const checkGuardEligibility = async () => {
      if (!candyMachine || !candyGuard || !connected) {
        setGuardGroups([]);
        return;
      }

      try {
        setLoading(true);
        const { guardReturn, ownedTokens } = await guardChecker(
          umi,
          candyGuard,
          candyMachine,
          solanaTime
        );

        setGuardGroups(guardReturn);
        setOwnedTokens(ownedTokens);

        // Select the first allowed group by default
        const firstAllowedGroup = guardReturn.find((guard) => guard.allowed);
        setSelectedGroup(firstAllowedGroup?.label || null);
      } catch (error) {
        console.error("Error checking guard eligibility:", error);
      } finally {
        setLoading(false);
      }
    };

    checkGuardEligibility();
  }, [umi, candyMachine, candyGuard, solanaTime, connected]);

  // Modal to show minted NFT
  const [showMintedNft, setShowMintedNft] = useState(false);

  const handleMintSuccess = () => {
    setShowMintedNft(true);
    setCheckEligibility(true);
  };

  if (!candyMachineId) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
        <p className="text-red-700">
          No Candy Machine ID found. Please add your candy machine address to
          the .env file!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">NFT Mint</h1>
        <WalletButton />
      </div>

      {!connected ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to mint NFTs
          </p>
          <WalletButton />
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg
              className="animate-spin h-10 w-10 text-purple-600"
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
          </div>
          <p className="text-gray-600">Loading mint options...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 lg:col-span-8">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {candyMachine?.data?.image && (
                <img
                  src={candyMachine.data.image}
                  alt="Collection"
                  className="w-full h-auto object-cover"
                />
              )}
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  {candyMachine?.data?.name || "NFT Collection"}
                </h2>

                <p className="text-gray-600 mb-4">
                  {candyMachine?.data?.description || "Mint your NFT now!"}
                </p>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Minted</span>
                    <span>
                      {candyMachine
                        ? `${candyMachine.itemsRedeemed} / ${candyMachine.data.itemsAvailable}`
                        : "Loading..."}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 h-2.5 rounded-full"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {showMintedNft && mintsCreated && (
              <div className="mt-6">
                <MintedNftDisplay nfts={mintsCreated} />
              </div>
            )}
          </div>

          <div className="md:col-span-5 lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Mint Options
              </h2>

              {guardGroups.length === 0 ? (
                <p className="text-gray-600">No mint options available</p>
              ) : (
                <div className="space-y-4">
                  {guardGroups.map((guard) => (
                    <MintGroup
                      key={guard.label}
                      guard={guard}
                      isSelected={selectedGroup === guard.label}
                      onClick={() => setSelectedGroup(guard.label)}
                      umi={umi}
                      candyMachine={candyMachine}
                      candyGuard={candyGuard}
                      ownedTokens={ownedTokens}
                      setMintsCreated={setMintsCreated}
                      onSuccess={handleMintSuccess}
                      setCheckEligibility={setCheckEligibility}
                      solPrice={solPrice}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6 text-xs text-gray-500">
                <p>Current SOL Price: ${solPrice}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MintContainer;
