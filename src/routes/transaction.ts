import { Router } from "express";
import { ArwConnection, save } from "../arweave";
import { getType } from "mime";
import { has } from "../fs";
import * as fs from "fs";
import * as path from "path";
import readDir, { FileData } from "../recursive_read";
import * as tar from "tar-fs";

export default (arweave: ArwConnection) => {
  const router = Router();
  router.post("/new", async (req, res, next) => {
    console.log(req.body);
    let tmpID = req.body.tmp_id;
    let indexFile = req.body.entry;
    if (!has(`${tmpID}.tar`)) return res.sendStatus(500);
    let txIds: { [x: string]: { inManifest: string, txId: string } } = {};
    // extracting a directory
    fs.mkdirSync(path.join(__dirname, `../../../api-next/tmp/ext_${tmpID}`));
    let tStream = tar.extract(path.join(__dirname, `../../../api-next/tmp/ext_${tmpID}`));
    let fsStream = await fs.createReadStream(path.join(__dirname, `../../../api-next/tmp/${tmpID}.tar`)).pipe(tStream);
    tStream.on('finish', async () => {
      const files: FileData[] = await readDir(path.join(__dirname, `../../../api-next/tmp/ext_${tmpID}`))
      console.log(files)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let relativePath = path.relative(path.join(__dirname, `../../../api-next/tmp/ext_${tmpID}`), file.fullpath);
        let fc = fs.readFileSync(file.fullpath);
        let txId = await save(arweave, {
          name: file.filename,
          type: getType(file.filename),
          data: fc,
        });
        txIds[file.filename] = {
          txId: txId,
          inManifest: relativePath
        };
      }
      let manifestId = await save(arweave, {
        name: "manifest.json",
        type: "application/x.arweave-manifest+json",
        data: Buffer.from(JSON.stringify({
          manifest: "arweave/paths",
          version: "0.1.0",
          index: {
            path: indexFile.replace(/^\//, ""),
          },
          paths: Object.entries(txIds).reduce((p, [ f, l ]) => {
            p[f.replace(/^\//, "")] = { id: l.txId };
            return p;
          }, {} as { [x: string]: { id: string } }),
        })),
      });
      res.send({
        files: txIds,
        prefix: `${arweave.api.config.protocol}://${arweave.api.config.host}/${manifestId}`
      });
    });

  });
  return router;
};
