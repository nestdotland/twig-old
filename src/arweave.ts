import Arweave from "arweave/node";
import Credentials from "../arweave-keyfile.json";
import { arweave as ArConfig } from "../twig.json";
import { JWKInterface } from "arweave/node/lib/wallet";
import fetch from "node-fetch";
import Big from "big.js";
import { equals, and } from "arql-ops";
import Transaction from "arweave/node/lib/transaction";

const pstContract = "12345678910abcdefg";
const pstTipAmount = 0.01;

export const arweaveInit = Arweave.init({
  host: ArConfig.host,
  port: ArConfig.port,
  protocol: ArConfig.protocol,
  timeout: ArConfig.timeout,
  logging: process.env.NODE_ENV === "development",
  logger: (...e) => console.log(...e),
});

/**
 * Represents an transaction file.
 */
export interface ArwFile {
  name: string;
  type: string;
  data: Buffer;
}

/**
 * An arweave connection type
 */
export type ArwConnection = Arweave & { anchor: string };

/**
 * Create an arweave connection pool.
 */
export async function connect(): Promise<ArwConnection> {
  const arweave = Arweave.init({
    host: ArConfig.host,
    port: ArConfig.port,
    protocol: ArConfig.protocol,
    timeout: ArConfig.timeout,
    logging: process.env.NODE_ENV === "development",
    logger: (...e) => console.log(...e),
  });

  (arweave as any).anchor = (await arweave.api.get("tx_anchor")).data;

  return arweave as ArwConnection;
}

/**
 * Generate an new anchor for the arweave connection pool.
 * @param arweave The arweave connection pool
 */
export async function regenerateAnchor(arweave: ArwConnection) {
  (arweave as any).anchor = (await arweave.api.get("tx_anchor")).data;
  return arweave;
}

/**
 * Retrive a particular transaction from Arweave.
 * @param connection The arweave connection pool
 * @param id The transaction ID
 */
export async function get(
  connection: ArwConnection,
  id: string,
): Promise<Uint8Array | null> {
  try {
    let transaction = await connection.transactions.getData(id, {
      decode: true,
      string: false,
    });
    if (!transaction) return null;
    return Buffer.from(transaction);
  } catch (err) {
    return null;
  }
}

/**
 * Create an arweave transaction for the file.
 * @param connection The Arweave connection pool.
 * @param data The file contents and details to be uploaded to Arweave.
 * @param wallet The user's unique Areweave wallet details. [optional]
 */
export async function save(
  connection: ArwConnection,
  data: ArwFile,
  wallet?: JWKInterface,
) {
  const transaction = await connection.createTransaction(
    { data: data.data, last_tx: connection.anchor },
    wallet || Credentials,
  );
  transaction.addTag("Content-Type", data.type);

  await connection.transactions.sign(transaction, wallet || Credentials);

  const jwkWallet = await connection.wallets.jwkToAddress(
    wallet || Credentials,
  );
  let bal = await connection.wallets.getBalance(jwkWallet);
  let balAR = await connection.ar.winstonToAr(bal);
  let byteSize = data.data.byteLength;
  let winston = await getWinston(byteSize);
  let fee = await Big(winston);

  // TODO: Local testing
  if (wallet && balAR < fee + pstTipAmount || Credentials && balAR < fee) {
    // Uncomment this for testing.
    // throw new Error("Insufficient funds!");
  }

  if (wallet) {
    let pstRecipient = await pstAllocation();
    let pstTransaction = await connection.createTransaction({
      target: pstRecipient,
      quantity: connection.ar.arToWinston(pstTipAmount.toString()),
    }, wallet);
    await connection.transactions.sign(pstTransaction, wallet);
    let pstRes = await connection.transactions.post(pstTransaction);
    if (pstRes.status >= 300) {
      throw new Error("PST Tipping Transaction failed!");
    }
  }

  const res = await connection.transactions.post(transaction);

  if (res.status >= 300) {
    throw new Error("Transaction failed!");
  }

  return transaction.id;
}

/**
 * Credit to Anish Agnihotri's 'Weve' for the following code
 * https://github.com/Anish-Agnihotri/weve/blob/master/src/utils/pst.js
 */

/**
 * Returns the wallet address of the user to send the tip to
 */
export const pstAllocation = async () => {
  let maxPST = 1000000000000;
  return calculateFeeRecipient(await getWalletList(), maxPST);
};

/**
 * Returns the wallet list of PST holders
 */
export const getWalletList = async () => {
  let tipTX = await findContractTip(pstContract);
  return JSON.parse(await getTXState(tipTX)).walletList;
};

/**
 * Calculates the recepient of the PST fee based on weighted randoms
 * @param stakeholders The list of PST stakeholders
 * @param maxPST The maximum amount of the PST
 */
const calculateFeeRecipient = (stakeholders: any, maxPST: number) => {
  let weightedStakeholders = {};

  for (let i = 0; i < stakeholders.length; i++) {
    weightedStakeholders[stakeholders[i].addr] = stakeholders[i].balance /
      maxPST;
  }

  return weightedRandom(weightedStakeholders);
};

/**
 * @param probability The probability of the stakeholders receiving the tip
 */
const weightedRandom = (probability: object) => {
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
 * Finds the latest contract tip
 * @param contractID The ID of a given PST smart contract
 */
const findContractTip = async (contractID: string) => {
  const contract = await getContract(contractID);
  let current = contract.contractTX;
  let state = getTXState(current);
  let last;

  do {
    last = current;
    current = await findNextTX(contract, state, current) || current;
    state = getTXState(current);
  } while (current);

  return last;
};

/**
 * Returns information about a PST smart contract
 * @param contractID The ID of a given PST smart contract
 */
const getContract = async (contractID: string) => {
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
const findNextTX = async (contract, state, currentTX: Transaction) => {
  // Create an ARQL query
  let successorsQuery = and(
    equals("App-Name", "nest.land"),
    equals("Previous-TX", currentTX.id)
  );
  const successors = await arweaveInit.arql(successorsQuery);

  for (const successor of successors) {
    let TX = await arweaveInit.transactions.get(successor);
    if (validateNextTX(contract, state, TX)) {
      return TX;
    }
  }

  return false;
};

/**
 * Returns the state of a given transaction
 * @param TX A transaction ID
 */
const getTXState = async (TX: Transaction) => {
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
const getTag = async (TX: any, name: string) => {
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
const validateNextTX = async (contract, state, nextTX: Transaction) => {
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
const getWinston = async (bytes?: number, target?: string) => {
  bytes = bytes || 0;
  target = target || "";

  const response = await fetch(`https://arweave.net/price/${bytes}/${target}`);

  return response.ok ? response.text() : null;
};
