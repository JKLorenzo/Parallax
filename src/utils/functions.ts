import fs from 'fs';
import path from 'path';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).reduce<string[]>((list, file) => {
    const name = path.join(dir, file);
    const isDir = fs.statSync(name).isDirectory();
    return list.concat(isDir ? getFiles(name) : [name]);
  }, []);
}
