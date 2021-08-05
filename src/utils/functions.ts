import fs from 'fs';
import path from 'path';
import gis from 'g-i-s';
import probe from 'probe-image-size';
import { getImage, updateImage } from '../modules/database.js';
import { ImageData, ImageOptions } from '../utils/types.js';

export function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).reduce<string[]>((list, file) => {
    const name = path.join(dir, file);
    const isDir = fs.statSync(name).isDirectory();
    return list.concat(isDir ? getFiles(name) : [name]);
  }, []);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function utfToHex(utf: string): string {
  return Buffer.from(utf, 'utf8').toString('hex');
}

export async function fetchImage(name: string): Promise<ImageData | undefined> {
  let data = await getImage(name);
  if (!data) {
    data = { name: name };
    const results = await Promise.all([
      searchImage(`${name} game logo`, {
        ratio: 1,
        minWidth: 100,
        minHeight: 100,
      }),
      searchImage(`${name} game background`, {
        ratio: 1.7,
        minWidth: 1000,
        minHeight: 1000,
      }),
    ]);
    data.iconUrl = results[0];
    data.bannerUrl = results[1];
    if (data.bannerUrl || data.iconUrl) await updateImage(name, data);
  } else if (!data.iconUrl) {
    data.iconUrl = await searchImage(`${name} game logo`, {
      ratio: 1,
      minWidth: 100,
      minHeight: 100,
    });
    if (data.iconUrl) await updateImage(name, { iconUrl: data.iconUrl });
  } else if (!data.bannerUrl) {
    data.bannerUrl = await searchImage(`${name} game background`, {
      ratio: 1.7,
      minWidth: 1000,
      minHeight: 1000,
    });
    if (data.bannerUrl) await updateImage(name, { bannerUrl: data.bannerUrl });
  }
  return data;
}

export function searchImage(name: string, options: ImageOptions): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    gis(name, async (error, results) => {
      if (error) reject(error);
      if (!Array.isArray(results) || results.length === 0) resolve(undefined);
      for (const result of results) {
        if (!result || !result.url) continue;
        const probe_result = await probe(result.url, {
          timeout: 10000,
          retries: 3,
          // eslint-disable-next-line @typescript-eslint/no-empty-function
        }).catch(() => {});
        if (!probe_result) continue;
        const width = probe_result.width;
        if (options.minWidth && width < options.minWidth) continue;
        const height = probe_result.height;
        if (options.minHeight && height < options.minHeight) continue;
        const ratio = width / height;
        if (options.ratio && (ratio > options.ratio + 0.2 || ratio < options.ratio - 0.2)) {
          continue;
        }
        resolve(result.url);
      }
      resolve(undefined);
    });
  });
}
