import { createContext, useContext, useEffect, useState } from "react";
import { useUmi } from "./UmiProvider";

const SolanaTimeContext = createContext({
  solanaTime: BigInt(0),
});

export const useSolanaTime = () => useContext(SolanaTimeContext).solanaTime;

// Helper function to get Solana time
const getSolanaTime = async (umi) => {
  try {
    const slot = await umi.rpc.getSlot();
    let solanaTime = await umi.rpc.getBlockTime(slot);
    if (!solanaTime) solanaTime = BigInt(0);
    return solanaTime;
  } catch (error) {
    console.error("Error fetching Solana time:", error);
    return BigInt(0);
  }
};

export const SolanaTimeProvider = ({ children }) => {
  const umi = useUmi();
  const [solanaTime, setSolanaTime] = useState(BigInt(0));

  useEffect(() => {
    const fetchSolanaTime = async () => {
      const tempSolanaTime = await getSolanaTime(umi);
      setSolanaTime(tempSolanaTime);
    };

    fetchSolanaTime();

    // Set up periodic refreshes
    const intervalId = setInterval(fetchSolanaTime, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [umi]);

  return (
    <SolanaTimeContext.Provider value={{ solanaTime }}>
      {children}
    </SolanaTimeContext.Provider>
  );
};
