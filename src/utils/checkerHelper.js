import {
  fetchToken,
  findAssociatedTokenPda,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";

/**
 * Helper functions to check eligibility for Candy Machine guards
 */

export const addressGateChecker = (wallet, address) => {
  return wallet === address;
};

export const allocationChecker = async (umi, candyMachine, guard) => {
  const allocation =
    guard.guards.allocation.__option === "Some"
      ? guard.guards.allocation.value
      : null;
  if (!allocation) return 0;

  try {
    const { safeFetchAllocationTrackerFromSeeds } = await import(
      "@metaplex-foundation/mpl-candy-machine"
    );
    const mintCounter = await safeFetchAllocationTrackerFromSeeds(umi, {
      id: allocation.id,
      candyMachine: candyMachine.publicKey,
      candyGuard: candyMachine.mintAuthority,
    });

    if (mintCounter) {
      return allocation.limit - mintCounter.count;
    } else {
      // No allocation mint Counter found - not created yet
      console.warn("Allocation Guard not Initialized! Minting may fail.");
      return allocation.limit;
    }
  } catch (error) {
    console.error(`AllocationChecker: ${error}`);
    return 0;
  }
};

export const solBalanceChecker = (solBalance, solAmount) => {
  return solAmount <= solBalance;
};

export const tokenBalanceChecker = async (umi, tokenAmount, tokenMint) => {
  const ata = findAssociatedTokenPda(umi, {
    mint: tokenMint,
    owner: umi.identity.publicKey,
  });

  try {
    const balance = await fetchToken(umi, ata);
    return Number(balance.amount) >= Number(tokenAmount);
  } catch (error) {
    console.error("Error checking token balance:", error);
    return false;
  }
};

export const mintLimitChecker = async (umi, candyMachine, guard) => {
  const mintLimit =
    guard.guards.mintLimit.__option === "Some"
      ? guard.guards.mintLimit.value
      : null;
  if (!mintLimit) return 0;

  try {
    const { safeFetchMintCounterFromSeeds } = await import(
      "@metaplex-foundation/mpl-candy-machine"
    );
    const mintCounter = await safeFetchMintCounterFromSeeds(umi, {
      id: mintLimit.id,
      user: umi.identity.publicKey,
      candyMachine: candyMachine.publicKey,
      candyGuard: candyMachine.mintAuthority,
    });

    if (mintCounter) {
      return mintLimit.limit - mintCounter.count;
    } else {
      // No mintlimit counter found. Possibly the first mint
      return mintLimit.limit;
    }
  } catch (error) {
    console.error(`mintLimitChecker: ${error}`);
    return 0;
  }
};

export const ownedNftChecker = (ownedNfts, requiredCollection) => {
  if (!ownedNfts) return 0;

  const count = ownedNfts.filter(
    (el) =>
      el.metadata.collection.__option === "Some" &&
      el.metadata.collection.value.key === requiredCollection
  ).length;

  return count;
};

export const allowlistChecker = (allowLists, umi, guardLabel) => {
  if (!allowLists || !allowLists.has(guardLabel)) {
    console.error(`Guard ${guardLabel}; allowlist missing from allowlist.js`);
    return false;
  }

  return allowLists.get(guardLabel)?.includes(umi.identity.publicKey) || false;
};

export const calculateMintable = (mintableAmount, newAmount) => {
  if (mintableAmount > newAmount) {
    mintableAmount = newAmount;
  }

  if (!process.env.NEXT_PUBLIC_MAXMINTAMOUNT) return mintableAmount;

  let maxMintAmount = 0;
  try {
    maxMintAmount = Number(process.env.NEXT_PUBLIC_MAXMINTAMOUNT);
  } catch (e) {
    console.error("process.env.NEXT_PUBLIC_MAXMINTAMOUNT is not a number!", e);
    return mintableAmount;
  }

  if (mintableAmount > maxMintAmount) {
    mintableAmount = maxMintAmount;
  }

  return mintableAmount;
};

export const checkSolBalanceRequired = (guards) => {
  let solBalanceRequired = false;
  guards.forEach((guard) => {
    if (
      guard.guards.freezeSolPayment.__option === "Some" ||
      guard.guards.solPayment.__option === "Some"
    ) {
      solBalanceRequired = true;
    }
  });

  return solBalanceRequired;
};

export const checkTokensRequired = (guards) => {
  let nftBalanceRequired = false;
  guards.forEach((guard) => {
    if (
      guard.guards.nftBurn.__option === "Some" ||
      guard.guards.nftGate.__option === "Some" ||
      guard.guards.nftPayment.__option === "Some"
    ) {
      nftBalanceRequired = true;
    }
  });

  return nftBalanceRequired;
};
