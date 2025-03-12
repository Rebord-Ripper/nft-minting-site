import { useState } from "react";
import MintButton from "./MintButton";
import { useSolanaTime } from "../utils/SolanaTimeContext";

const MintGroup = ({
  guard,
  isSelected,
  onClick,
  umi,
  candyMachine,
  candyGuard,
  ownedTokens,
  setMintsCreated,
  onSuccess,
  setCheckEligibility,
  solPrice = 0,
}) => {
  const solanaTime = useSolanaTime();

  // Format currency values
  const formatPrice = (value) => {
    return Number(value).toFixed(2);
  };

  // Determine if this guard is active (within start/end times)
  const isActive = () => {
    const now = solanaTime;
    const hasStarted = !guard.startTime || guard.startTime <= now;
    const hasEnded = guard.endTime && guard.endTime <= now;
    return hasStarted && !hasEnded;
  };

  // Calculate status message
  const getStatusMessage = () => {
    if (!guard.allowed) {
      return guard.reason || "Not eligible";
    }

    const now = solanaTime;

    if (guard.startTime && guard.startTime > now) {
      return "Not started yet";
    }

    if (guard.endTime && guard.endTime <= now) {
      return "Ended";
    }

    return "Active";
  };

  // Get price information
  const getSolPayment = () => {
    if (!guard.solPayment) return null;
    return {
      amount: formatPrice(guard.solPayment),
      usdValue: formatPrice(guard.solPayment * solPrice),
    };
  };

  const getTokenPayment = () => {
    if (!guard.tokenPayment) return null;
    return {
      amount: guard.tokenPayment,
      symbol: "TOKEN", // Replace with actual token symbol if available
    };
  };

  const price = getSolPayment() || getTokenPayment();

  return (
    <div
      className={`border rounded-xl p-4 transition-all duration-200 ${
        isSelected
          ? "border-purple-500 bg-purple-50"
          : guard.allowed
          ? "border-gray-300 hover:border-purple-300 cursor-pointer"
          : "border-gray-300 bg-gray-50 opacity-75"
      }`}
      onClick={guard.allowed ? onClick : undefined}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="inline-block bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
            {guard.header || guard.label}
          </span>
        </div>

        <div className="text-sm text-gray-500">{getStatusMessage()}</div>
      </div>

      <div className="flex items-center gap-1.5 text-gray-800 tracking-wide mb-3">
        <span>
          Max <b>{guard.displayMintLimit || 1} NFTs</b>
        </span>
        <span>•</span>
        {price && (
          <div className="inline-flex items-center">
            Price:{" "}
            <b className="ml-1">
              {price.amount} {price.symbol || "SOL"}
            </b>
            {price.usdValue && (
              <span className="text-xs text-gray-500 ml-1">
                (${price.usdValue})
              </span>
            )}
          </div>
        )}
      </div>

      {isSelected && (
        <MintButton
          umi={umi}
          guard={guard}
          candyMachine={candyMachine}
          candyGuard={candyGuard}
          ownedTokens={ownedTokens}
          setMintsCreated={setMintsCreated}
          onSuccess={onSuccess}
          setCheckEligibility={setCheckEligibility}
        />
      )}
    </div>
  );
};

export default MintGroup;
