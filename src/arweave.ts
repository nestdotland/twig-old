import Arweave from "arweave/node";
import Credentials from "../arweave-keyfile.json";
import { arweave as ArConfig } from "../twig.json";
import { JWKInterface } from "arweave/node/lib/wallet";
import { pstTipAmount, pstAllocation, getWinston } from "./pst";
import Big from "big.js";

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
