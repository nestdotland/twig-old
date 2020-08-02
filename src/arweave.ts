import Arweave from "arweave/node";
import Credentials from "../arweave-keyfile.json";

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
    host: "arweave.net",
    port: 443,
    protocol: "https",
    timeout: 20000,
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
 * @param connection The arweave connection pool
 * @param data The file contents and details to be uploaded to Arweave.
 */
export async function save(
  connection: ArwConnection,
  data: ArwFile,
) {
  const transaction = await connection.createTransaction(
    { data: data.data, last_tx: connection.anchor },
    Credentials,
  );
  transaction.addTag("Content-Type", data.type);

  await connection.transactions.sign(transaction, Credentials);
  const res = await connection.transactions.post(transaction);

  if (res.status >= 300) throw new Error("Transaction failed!");

  return transaction.id;
}
