import fs from 'fs';
import path from 'path';
import util from 'util';
import humanizeDuration from 'humanize-duration';
import _ from 'lodash';

export default abstract class Utils {
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  static getFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).reduce<string[]>((list, file) => {
      const name = path.join(dir, file);
      const isDir = fs.statSync(name).isDirectory();
      return list.concat(isDir ? this.getFiles(name) : [name]);
    }, []);
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

  static hasAny(base: string, part: string | string[]): boolean {
    const parts = Array.isArray(part) ? part : [part];
    for (const this_part of parts) {
      if (base.indexOf(this_part) !== -1) return true;
    }
    return false;
  }

  static asAll(base: string, parts: string[]): boolean {
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

  static parseMention(mention: string) {
    return String(mention).replace(/\W/g, '');
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
    let name;

    if (typeof obj === 'object') {
      name = obj?.constructor.name;
      if (name) return name;
    } else if (typeof obj === 'function') {
      const strObj = String(obj);
      name = strObj.substring(0, strObj.indexOf('(')).split(' ');
      name = name.at(name.length - 1);
      if (name) return name;
    }

    return `TypeOf ${typeof obj}`;
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
}
