import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";

const WalletButton = () => {
  const { connected, publicKey, disconnect } = useWallet();
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    if (publicKey) {
      setWalletAddress(publicKey.toString());
    } else {
      setWalletAddress("");
    }
  }, [publicKey]);

  const formatWalletAddress = (address) => {
    if (address.length > 10) {
      return `${address.substring(0, 4)}...${address.substring(
        address.length - 4
      )}`;
    }
    return address;
  };

  return (
    <div className="flex items-center">
      {connected ? (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {formatWalletAddress(walletAddress)}
          </span>
          <button
            onClick={disconnect}
            className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md text-sm transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <WalletMultiButton className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition-all duration-200 transform hover:scale-105" />
      )}
    </div>
  );
};

export default WalletButton;
