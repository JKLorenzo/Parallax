import fs from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';
import util from 'util';
import humanizeDuration from 'humanize-duration';
import _ from 'lodash';
import url from 'url';

export default abstract class Utils {
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  static dirExists(dir: string): boolean {
    return fs.existsSync(dir);
  }

  static joinPaths(...paths: string[]) {
    return path.join(...paths);
  }

  static getFiles(dir: string): string[] {
    if (!this.dirExists(dir)) return [];
    return fs.readdirSync(dir).reduce<string[]>((list, file) => {
      const name = this.joinPaths(dir, file);
      const isDir = fs.statSync(name).isDirectory();
      return list.concat(isDir ? this.getFiles(name) : [name]);
    }, []);
  }

  static async getPaths(dir: string): Promise<string[]> {
    if (!this.dirExists(dir)) return [];
    const dirs = await readdir(dir, { withFileTypes: true });
    const dirNames = dirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => this.joinPaths(dirent.path, dirent.name));
    return dirNames;
  }

  static getPathURL(path: string): url.URL {
    return url.pathToFileURL(path);
  }

  static inspect(data: unknown): string {
    const nlPattern = new RegExp('!!NL!!', 'g');
    const sensitivePattern = new RegExp(_.escapeRegExp(process.env.BOT_TOKEN), 'gi');

    const inspected = util
      .inspect(data, { depth: 0 })
      .replace(nlPattern, '\n')
      .replace(sensitivePattern, '--snip--');

    return inspected;
  }

  static splitString(
    text: string,
    options?: {
      maxLength?: number;
      seperator?: string;
      append?: string;
      prepend?: string;
      header?: string;
      footer?: string;
    },
  ) {
    const maxLength = options?.maxLength ?? 2000;
    const seperator = options?.seperator ?? '\n';
    const append = options?.append ?? '';
    const prepend = options?.prepend ?? '';
    const header = options?.header ?? '';
    const footer = options?.footer ?? '';

    if ((header + text + footer).length <= maxLength) return [header + text + footer];

    const splitText = text.split(seperator);
    if (splitText.some(elem => elem.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');

    const messages = [];
    let msg = header;
    for (const chunk of splitText) {
      if ((msg + seperator + chunk + append + footer).length > maxLength) {
        messages.push(msg + append + footer);
        msg = header + prepend;
      }
      msg += (msg !== prepend ? seperator : '') + chunk;
    }

    return messages.concat(msg + footer);
  }

  static formatToJs(
    data: unknown,
    options = {
      header: '```js\n',
      footer: '\n```',
      maxLength: 4096,
    },
  ) {
    const inspected = Utils.inspect(data);
    const last = inspected.length - 1;
    const splitInspected = inspected.split('\n');

    const prependPart =
      inspected[0] !== '{' && inspected[0] !== '[' && inspected[0] !== "'"
        ? splitInspected[0]
        : inspected[0];

    const appendPart =
      inspected[last] !== '}' && inspected[last] !== ']' && inspected[last] !== "'"
        ? splitInspected[splitInspected.length - 1]
        : inspected[last];

    const result = Utils.splitString(inspected, {
      header: options.header,
      footer: options.footer,
      maxLength: options.maxLength,
      prepend: prependPart,
      append: appendPart,
    });

    return result;
  }

  static hasAny(base: string, part: string | string[]): boolean {
    const parts = Array.isArray(part) ? part : [part];
    for (const this_part of parts) {
      if (base.indexOf(this_part) !== -1) return true;
    }
    return false;
  }

  static hasAll(base: string, parts: string[]): boolean {
    for (const this_part of parts) {
      if (!this.hasAny(base, this_part)) return false;
    }
    return true;
  }

  static compareDate(date: Date) {
    const today = new Date();
    const diffMs = today.valueOf() - date.valueOf();

    return {
      days: Math.floor(diffMs / 86400000),
      hours: Math.floor((diffMs % 86400000) / 3600000),
      minutes: Math.round(((diffMs % 86400000) % 3600000) / 60000),
      totalMinutes: Math.round(diffMs / 60000),
      humanized: humanizeDuration(diffMs, { largest: 1, round: true }),
    };
  }

  static addToDate(date: Date, units: number, unit?: 'seconds' | 'minutes' | 'hours') {
    let ms;
    switch (unit) {
      case 'seconds':
        ms = units * 1000;
        break;
      case 'minutes':
        ms = units * 60000;
        break;
      case 'hours':
        ms = units * 600000;
        break;
      default:
        ms = units;
    }
    return new Date(date.getTime() + ms);
  }

  static parseMention(mention: string) {
    return String(mention).replace(/\W/g, '');
  }

  static mentionRoleById(roleId: string) {
    return `<@&${roleId}>`;
  }

  static mentionChannelById(channelId: string) {
    return `<#${channelId}>`;
  }

  static mentionUserById(userId: string) {
    return `<@${userId}>`;
  }

  static removeLeadingWord(str: string, separator = ' '): string {
    return str.trim().split(separator).slice(1).join(separator);
  }

  static toSelectiveUpper(
    str: string,
    options?: { word?: 'first' | 'all'; seperator?: string },
  ): string {
    switch (options?.word) {
      case 'all':
        return `${str.split(options.seperator ?? ' ')}`;
      default:
        return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
    }
  }

  static getObjName(obj: unknown) {
    let value;

    if (typeof obj === 'string') {
      value = obj;
    } else if (typeof obj === 'function') {
      value = String(obj);
      value = value.substring(0, value.indexOf('(')).split(' ');
      value = value.at(value.length - 1);
    } else if (typeof obj === 'object') {
      value = obj?.constructor.name;
    }

    if (typeof value !== 'string') {
      value = `${obj}_${typeof obj}`;
    }

    return value;
  }

  static makeId(
    length: number,
    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  ) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
  }

  static formatReqId(id: string) {
    return `Request ID: ${id}`;
  }

  static parseReqId(str: string) {
    return str.replace('Request ID:', '').trim();
  }

  static filterUnique<T>(value: T, index: number, array: T[]) {
    return array.indexOf(value) === index;
  }
}
