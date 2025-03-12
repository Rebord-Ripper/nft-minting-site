import { fetchAllDigitalAssetWithTokenByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey, sol } from "@metaplex-foundation/umi";
import {
  addressGateChecker,
  allowlistChecker,
  checkTokensRequired,
  checkSolBalanceRequired,
  mintLimitChecker,
  ownedNftChecker,
  allocationChecker,
  calculateMintable,
} from "./checkerHelper";

// Default empty allowLists - you would replace this with your actual allowLists
const allowLists = new Map();

export const guardChecker = async (
  umi,
  candyGuard,
  candyMachine,
  solanaTime
) => {
  let guardReturn = [];
  let ownedTokens = [];

  if (!candyGuard) {
    return { guardReturn, ownedTokens };
  }

  let guardsToCheck = [...candyGuard.groups];
  guardsToCheck.push({ label: "default", guards: candyGuard.guards });

  // No wallet connected - return dummies
  const dummyPublicKey = publicKey("11111111111111111111111111111111");
  if (
    umi.identity.publicKey === dummyPublicKey ||
    Number(candyMachine.data.itemsAvailable) -
      Number(candyMachine.itemsRedeemed) ===
      0
  ) {
    for (const eachGuard of guardsToCheck) {
      guardReturn.push({
        label: eachGuard.label,
        allowed: false,
        reason: "Please connect your wallet to mint",
        maxAmount: 0,
      });
    }
    return { guardReturn, ownedTokens };
  }

  let solBalance = sol(0);
  if (checkSolBalanceRequired(guardsToCheck)) {
    try {
      const account = await umi.rpc.getAccount(umi.identity.publicKey);
      if (account) {
        solBalance = account.lamports;
      }
    } catch (e) {
      for (const eachGuard of guardsToCheck) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Wallet does not exist. Do you have SOL?",
          maxAmount: 0,
        });
      }
      return { guardReturn, ownedTokens };
    }
  }

  if (checkTokensRequired(guardsToCheck)) {
    try {
      ownedTokens = await fetchAllDigitalAssetWithTokenByOwner(
        umi,
        umi.identity.publicKey
      );
    } catch (error) {
      console.error("Error fetching owned tokens:", error);
    }
  }

  for (const eachGuard of guardsToCheck) {
    const singleGuard = eachGuard.guards;
    let mintableAmount =
      Number(candyMachine.data.itemsAvailable) -
      Number(candyMachine.itemsRedeemed);

    // Address Gate
    if (singleGuard.addressGate.__option === "Some") {
      const addressGate = singleGuard.addressGate.value;
      if (
        !addressGateChecker(
          umi.identity.publicKey,
          publicKey(addressGate.address)
        )
      ) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "AddressGate: Wrong Address",
          maxAmount: 0,
        });
        continue;
      }
    }

    // Allocation
    if (singleGuard.allocation.__option === "Some") {
      const allocatedAmount = await allocationChecker(
        umi,
        candyMachine,
        eachGuard
      );
      mintableAmount = calculateMintable(mintableAmount, allocatedAmount);

      if (allocatedAmount < 1) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Allocation of this guard reached",
          maxAmount: 0,
        });
        console.info(`Guard ${eachGuard.label}; allocation reached`);
        continue;
      }
    }

    // Allowlist
    if (singleGuard.allowList.__option === "Some") {
      if (!allowlistChecker(allowLists, umi, eachGuard.label)) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Wallet not allowed",
          maxAmount: 0,
        });
        console.info(`Guard ${eachGuard.label} wallet not allowed!`);
        continue;
      }
    }

    // End Date
    if (singleGuard.endDate.__option === "Some") {
      const endDate = singleGuard.endDate.value;
      if (solanaTime > endDate.date) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Mint time is over!",
          maxAmount: 0,
        });
        console.info(`Guard ${eachGuard.label}; endDate reached!`);
        continue;
      }
    }

    // Freeze SOL Payment
    if (singleGuard.freezeSolPayment.__option === "Some") {
      const freezeSolPayment = singleGuard.freezeSolPayment.value;
      const payableAmount =
        solBalance.basisPoints / freezeSolPayment.lamports.basisPoints;
      mintableAmount = calculateMintable(mintableAmount, Number(payableAmount));

      if (freezeSolPayment.lamports.basisPoints > solBalance.basisPoints) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Not enough SOL",
          maxAmount: 0,
        });
        console.info(
          `Guard ${eachGuard.label}; freezeSolPayment: not enough SOL`
        );
        continue;
      }
    }

    // Mint Limit
    if (singleGuard.mintLimit.__option === "Some") {
      const amount = await mintLimitChecker(umi, candyMachine, eachGuard);
      mintableAmount = calculateMintable(mintableAmount, amount);
      if (amount < 1) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Mint limit of this wallet reached",
          maxAmount: 0,
        });
        console.info(`Guard ${eachGuard.label}; mintLimit reached`);
        continue;
      }
    }

    // SOL Payment
    if (singleGuard.solPayment.__option === "Some") {
      const solPayment = singleGuard.solPayment.value;
      let payableAmount = 0;
      if (solPayment.lamports.basisPoints !== BigInt(0)) {
        payableAmount =
          Number(solBalance.basisPoints) /
          Number(solPayment.lamports.basisPoints);
      }
      mintableAmount = calculateMintable(mintableAmount, Number(payableAmount));

      if (solPayment.lamports.basisPoints > solBalance.basisPoints) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Not enough SOL!",
          maxAmount: 0,
        });
        console.info(`${eachGuard.label} SolPayment not enough SOL!`);
        continue;
      }
    }

    // Start Date
    if (singleGuard.startDate.__option === "Some") {
      const startDate = singleGuard.startDate.value;
      if (solanaTime < startDate.date) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "StartDate not reached!",
          maxAmount: 0,
        });
        console.info(`${eachGuard.label} StartDate not reached!`);
        continue;
      }
    }

    // If we made it here, the guard is allowed
    guardReturn.push({
      label: eachGuard.label,
      allowed: true,
      maxAmount: mintableAmount,
    });
  }

  return { guardReturn, ownedTokens };
};
