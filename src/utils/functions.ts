import fs from 'fs';
import path from 'path';
import { Snowflake } from 'discord.js';
import gis from 'g-i-s';
import probe from 'probe-image-size';
import { getImage, updateImage } from '../modules/database.js';
import { ImageData, ImageOptions } from '../utils/types.js';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).reduce<string[]>((list, file) => {
    const name = path.join(dir, file);
    const isDir = fs.statSync(name).isDirectory();
    return list.concat(isDir ? getFiles(name) : [name]);
  }, []);
}

export function utfToHex(utf: string): string {
  return Buffer.from(utf, 'utf8').toString('hex');
}

export function hexToUtf(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

export function hasAny(base: string, part: string | string[]): boolean {
  const parts = Array.isArray(part) ? part : [part];
  for (const this_part of parts) {
    if (base.indexOf(this_part) !== -1) return true;
  }
  return false;
}

export function hasAll(base: string, parts: string[]): boolean {
  for (const this_part of parts) {
    if (!hasAny(base, this_part)) return false;
  }
  return true;
}

export function parseMention(mention: string): Snowflake {
  return String(mention).replace(/\W/g, '');
}

export function parseHTML(html: string): string {
  return html
    .replace(/&quot;|&quot/g, '"')
    .replace(/&apos;|&apos/g, "'")
    .replace(/&lt;|&lt/g, '<')
    .replace(/&gt;|&gt/g, '>')
    .replace(/&amp;|&amp/g, '&');
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
    if (data.bannerUrl || data.iconUrl) await updateImage(data);
  } else if (!data.iconUrl) {
    data.iconUrl = await searchImage(`${name} game logo`, {
      ratio: 1,
      minWidth: 100,
      minHeight: 100,
    });
    if (data.iconUrl) await updateImage({ name: data.name, iconUrl: data.iconUrl });
  } else if (!data.bannerUrl) {
    data.bannerUrl = await searchImage(`${name} game background`, {
      ratio: 1.7,
      minWidth: 1000,
      minHeight: 1000,
    });
    if (data.bannerUrl) await updateImage({ name: data.name, bannerUrl: data.bannerUrl });
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

export function getStringSimilarity(str1: string, str2: string): number {
  let longer = str1;
  let shorter = str2;

  if (str1.length < str2.length) {
    longer = str2;
    shorter = str1;
  }

  if (longer.length === 0 || shorter.length === 0) return 0;

  const temp = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        temp[j] = j;
      } else if (j > 0) {
        let newValue = temp[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), temp[j]) + 1;
        }
        temp[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) temp[shorter.length] = lastValue;
  }

  return 100 * ((longer.length - temp[shorter.length]) / longer.length);
}
