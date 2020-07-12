import fs from "fs";
import path from "path";

export const tmpPath = "../../api-next/tmp";

export function init(time = 60, age = 1800) {
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

  const _interval = () => {
    fs.readdirSync(tmpPath).map(el => {
      let f = path.join(tmpPath, el);
      let stats = fs.statSync(f);

      if (Date.now() - stats.mtimeMs > age * 1000) return fs.unlinkSync(f);
    });
  };

  setInterval(_interval, time * 1000);
  _interval();
}

export function save(id: string, data: Buffer) {
  fs.writeFileSync(path.join(tmpPath, id), data);
}

export function get(id: string) {
  let f = path.join(tmpPath, id);
  if (fs.existsSync(f)) {
    return fs.readFileSync(f);
  } else return null;
}

export function has(id: string) {
  let f = path.join(__dirname, tmpPath, id);
  return fs.existsSync(f);
}
