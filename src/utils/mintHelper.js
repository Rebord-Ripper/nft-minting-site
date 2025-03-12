import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { some, transactionBuilder, none } from "@metaplex-foundation/umi";

/**
 * Choose which guard to use for minting
 */
export const chooseGuardToUse = (guard, candyGuard) => {
  let guardGroup = candyGuard?.groups.find(
    (item) => item.label === guard.label
  );

  if (guardGroup) {
    return guardGroup;
  }

  if (candyGuard != null) {
    return {
      label: "default",
      guards: candyGuard.guards,
    };
  }

  console.error("No guards defined! No minting possible.");
  return {
    label: "default",
    guards: undefined,
  };
};

/**
 * Build mint arguments based on the guard type
 */
export const mintArgsBuilder = (
  candyMachine,
  guardToUse,
  ownedTokens,
  allowLists
) => {
  if (!guardToUse.guards) {
    console.error("No guards defined for mint args builder");
    return {};
  }

  const guards = guardToUse.guards;
  let ruleset = undefined;

  if (candyMachine.ruleSet.__option === "Some") {
    ruleset = candyMachine.ruleSet.value;
  }

  let mintArgs = {};

  // Allocation
  if (guards.allocation.__option === "Some") {
    mintArgs.allocation = some({ id: guards.allocation.value.id });
  }

  // Allowlist
  if (guards.allowList.__option === "Some") {
    // Import function only when needed to avoid circular dependencies
    const { getMerkleRoot } = require("@metaplex-foundation/mpl-candy-machine");
    const allowlist = allowLists && allowLists.get(guardToUse.label);

    if (!allowlist) {
      console.error(`Allowlist for guard ${guardToUse.label} not found!`);
    } else {
      mintArgs.allowList = some({ merkleRoot: getMerkleRoot(allowlist) });
    }
  }

  // FreezeSolPayment
  if (guards.freezeSolPayment.__option === "Some") {
    mintArgs.freezeSolPayment = some({
      destination: guards.freezeSolPayment.value.destination,
    });
  }

  // MintLimit
  if (guards.mintLimit.__option === "Some") {
    mintArgs.mintLimit = some({ id: guards.mintLimit.value.id });
  }

  // SolPayment
  if (guards.solPayment.__option === "Some") {
    mintArgs.solPayment = some({
      destination: guards.solPayment.value.destination,
    });
  }

  // TokenPayment
  if (guards.tokenPayment.__option === "Some") {
    mintArgs.tokenPayment = some({
      destinationAta: guards.tokenPayment.value.destinationAta,
      mint: guards.tokenPayment.value.mint,
    });
  }

  return mintArgs;
};

/**
 * Build route instruction for allowlist guard
 */
export const routeBuilder = async (
  umi,
  guardToUse,
  candyMachine,
  allowLists
) => {
  let tx = transactionBuilder();

  if (guardToUse.guards.allowList.__option === "Some") {
    const {
      route,
      getMerkleRoot,
      getMerkleProof,
      safeFetchAllowListProofFromSeeds,
    } = await import("@metaplex-foundation/mpl-candy-machine");

    const allowlist = allowLists && allowLists.get(guardToUse.label);
    if (!allowlist) {
      console.error("Allowlist not found!");
      return transactionBuilder();
    }

    const allowListProof = await safeFetchAllowListProofFromSeeds(umi, {
      candyGuard: candyMachine.mintAuthority,
      candyMachine: candyMachine.publicKey,
      merkleRoot: getMerkleRoot(allowlist),
      user: umi.identity.publicKey,
    });

    if (allowListProof === null) {
      tx = tx.add(
        route(umi, {
          guard: "allowList",
          candyMachine: candyMachine.publicKey,
          candyGuard: candyMachine.mintAuthority,
          group:
            guardToUse.label === "default" ? none() : some(guardToUse.label),
          routeArgs: {
            path: "proof",
            merkleRoot: getMerkleRoot(allowlist),
            merkleProof: getMerkleProof(allowlist, umi.identity.publicKey),
          },
        })
      );
    }

    return tx;
  }

  return null;
};

/**
 * Verify transaction status
 */
export const verifyTx = async (umi, signatures, actualTotal) => {
  const { base58 } = await import("@metaplex-foundation/umi/serializers");

  const verifySignature = async (signature) => {
    console.log(base58.deserialize(signature));
    let transaction;

    for (let i = 0; i < 30; i++) {
      transaction = await umi.rpc.getTransaction(signature);
      if (transaction) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (!transaction) {
      return { success: false, reason: "No TX found" };
    }

    // Check for bot tax in logs
    if (transaction.meta.logs.find((l) => l.includes("Candy Guard Botting"))) {
      return { success: false, reason: "Bot Tax detected!" };
    }

    return { success: true, mint: transaction.message.accounts[1] };
  };

  const results = await Promise.all(signatures.map(verifySignature));
  let successful = [];
  let failed = [];

  results.forEach((status) => {
    if (status.success === true) {
      successful.push(status.mint);
    } else {
      failed.push(status.reason);
    }
  });

  if (failed.length > 0) {
    console.error(`${failed.length} Mints failed!`);
    failed.forEach((reason) => console.error(reason));
  }

  if (successful.length > 0) {
    console.log(`${actualTotal || successful.length} Mints successful!`);
  }

  return successful;
};
