import { equals, and } from "arql-ops";
import Transaction from "arweave/node/lib/transaction";
import fetch from "node-fetch";
import Arweave from "arweave/node";
import Community from "community-js";

export const pstContract = "j8W245BKgr1_k-lB0NjZ0W5m2z6Ibz1vwn7PuoHOBCI";
export const pstTipAmount = 0.01;

/**
 * Credit to Anish Agnihotri's 'Weve' for the following code
 * https://github.com/Anish-Agnihotri/weve/blob/master/src/utils/pst.js
 */

/**
 * Returns the wallet address of the user to send the tip to
 */
export const pstAllocation = async (arweaveInit: Arweave) => {
  let community = new Community(arweaveInit);
  await community.setCommunityTx(pstContract);
  return await community.selectWeightedHolder();
};

/**
   * Returns the wallet list of PST holders
   */
export const getWalletList = async (arweaveInit: Arweave) => {
  let community = new Community(arweaveInit);
  community.setCommunityTx(pstContract);
  try {
    let state = await community.getState();
    console.log(state.balances);
    return state.balances;
  } catch (err) {
    throw err;
  }
};

/**
   * Calculates the recepient of the PST fee based on weighted randoms
   * @param stakeholders The list of PST stakeholders
   * @param maxPST The maximum amount of the PST
   */
export const calculateFeeRecipient = (stakeholders: any, maxPST: number) => {
  let weightedStakeholders = {};
  for (const i of stakeholders) {
    weightedStakeholders[i] = {
      address: stakeholders,
      weight: stakeholders[i] / maxPST
    };
  }  // None of this is used anymore

  return weightedStakeholders[weightedRandom(weightedStakeholders)];
};

/**
   * @param probability The probability of the stakeholders receiving the tip
   */
export const weightedRandom = (probability: object) => {
  let i, sum = 0, r = Math.random();

  for (i in probability) {
    sum += probability[i];
    if (r <= sum) return i;
  }
};

/**
   * Helper functions from SmartWeave
   */

/**
   * Returns information about a PST smart contract
   * @param contractID The ID of a given PST smart contract
   */
export const getContract = async (arweaveInit: Arweave, contractID: string) => {
  const contractTX = await arweaveInit.transactions.get(contractID);
  const contractSrcTXID = await getTag(contractTX, "Contract-Src");
  const minDiff = await getTag(contractTX, "Min-Diff");
  const contractSrcTX = await arweaveInit.transactions.get(contractSrcTXID);
  const contractSrc = await contractSrcTX.get(
    "data",
    { decode: true, string: true },
  );
  const state = await contractTX.get("data", { decode: true, string: true });

  return {
    id: contractID,
    contractSrc: contractSrc,
    initState: state,
    minDiff: minDiff,
    contractTX: contractTX,
  };
};

/**
   * Finds the next transaction
   */
export const findNextTX = async (
  arweaveInit: Arweave,
  contract,
  state,
  currentTX: Transaction,
) => {
  // Create an ARQL query
  let successorsQuery = and(
    equals("App-Name", "nest.land"),
    equals("Previous-TX", currentTX.id),
  );
  const successors = await arweaveInit.arql(successorsQuery);

  for (const successor of successors) {
    let TX = await arweaveInit.transactions.get(successor);
    if (validateNextTX(arweaveInit, contract, state, TX)) {
      return TX;
    }
  }

  return false;
};

/**
   * Returns the state of a given transaction
   * @param TX A transaction ID
   */
export const getTXState = async (TX: Transaction) => {
  if (!TX) return false;
  if (await getTag(TX, "Type") == "contract") {
    return TX.get("data", { decode: true, string: true });
  } else {
    return JSON.parse(
      TX.get("data", { decode: true, string: true }),
    )["newState"];
  }
};

/**
   * Returns a boolean signifying whether a transaction has tag 'name'
   * @param TX The transaction ID
   * @param name The name of a desired tag
   */
export const getTag = async (TX: any, name: string) => {
  let tags = TX.get("tags");
  for (let i = 0; i < tags.length; i++) {
    if (tags[i].get("name", { decode: true, string: true }) == name) {
      return tags[i].get("value", { decode: true, string: true });
    }
  }

  return false;
};

/**
   * Returns data about validating the next transaction
   */
export const validateNextTX = async (
  arweaveInit: Arweave,
  contract,
  state,
  nextTX: Transaction,
) => {
  let struct = JSON.parse(nextTX.get("data", { decode: true, string: true }));
  return (
    contract.contractSrc,
    struct.input,
    state,
    await arweaveInit.wallets.ownerToAddress(nextTX.owner)
  );
};

/**
   * Credit to Sergej Müller's 'chaiku' for the following code
   * https://github.com/sergejmueller/chaiku/blob/master/js/main.js
   */

/**
   * Returns the fee to upload x bytes to y target
   */
export const getWinston = async (bytes?: number, target?: string) => {
  bytes = bytes || 0;
  target = target || "";

  const response = await fetch(`https://arweave.net/price/${bytes}/${target}`);

  return response.ok ? response.text() : null;
};
