import { useState, useEffect } from "react";

const MintTimer = ({ solanaTime, toTime, label, setCheckEligibility }) => {
  const [remainingTime, setRemainingTime] = useState(toTime - solanaTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= BigInt(1)) {
          // When timer reaches zero, trigger eligibility check
          if (setCheckEligibility) {
            setCheckEligibility(true);
          }
          clearInterval(interval);
          return BigInt(0);
        }
        return prev - BigInt(1);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [setCheckEligibility]);

  // Convert to days, hours, minutes, seconds
  const days = remainingTime / BigInt(86400);
  const hours = (remainingTime % BigInt(86400)) / BigInt(3600);
  const minutes = (remainingTime % BigInt(3600)) / BigInt(60);
  const seconds = remainingTime % BigInt(60);

  if (remainingTime <= BigInt(0)) {
    return null;
  }

  const formatDigit = (value) => {
    return value.toString().padStart(2, "0");
  };

  return (
    <div className="flex items-center space-x-1">
      <span className="text-gray-600 text-sm">{label}:</span>
      <div className="flex items-center space-x-1">
        {days > BigInt(0) && (
          <>
            <div className="bg-purple-600 text-white rounded px-2 py-1 text-xs font-mono">
              {formatDigit(days)}d
            </div>
            <span className="text-gray-400">:</span>
          </>
        )}
        <div className="bg-purple-600 text-white rounded px-2 py-1 text-xs font-mono">
          {formatDigit(hours)}h
        </div>
        <span className="text-gray-400">:</span>
        <div className="bg-purple-600 text-white rounded px-2 py-1 text-xs font-mono">
          {formatDigit(minutes)}m
        </div>
        <span className="text-gray-400">:</span>
        <div className="bg-purple-600 text-white rounded px-2 py-1 text-xs font-mono">
          {formatDigit(seconds)}s
        </div>
      </div>
    </div>
  );
};

export default MintTimer;
