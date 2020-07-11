import fs from "fs";
import path from "path";

export function init(time = 60, age = 1800) {
  if (!fs.existsSync("../../api-next/.tmp")) fs.mkdirSync("../../api-next/.tmp");

  const _interval = () => {
    fs.readdirSync("../../api-next/.tmp").map(el => {
      let f = path.join("../../api-next/.tmp", el);
      let stats = fs.statSync(f);

      if (Date.now() - stats.mtimeMs > age * 1000) return fs.unlinkSync(f);
    });
  };

  setInterval(_interval, time * 1000);
  _interval();
}

export function save(id: string, data: Buffer) {
  fs.writeFileSync(path.join("../../api-next/.tmp", id), data);
}

export function get(id: string) {
  let f = path.join("../../api-next/.tmp", id);
  if (fs.existsSync(f)) {
    return fs.readFileSync(f);
  } else return null;
}

export function has(id: string) {
  let f = path.join("../../api-next/.tmp", id);
  return fs.existsSync(f);
}
