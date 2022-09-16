import fs from 'fs';
import path from 'path';
import util from 'util';
import _ from 'lodash';
import Constants from './constants.js';

export default class Utils {
  constants = new Constants();

  sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  getFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).reduce<string[]>((list, file) => {
      const name = path.join(dir, file);
      const isDir = fs.statSync(name).isDirectory();
      return list.concat(isDir ? this.getFiles(name) : [name]);
    }, []);
  }

  inspect(data: unknown): string {
    const nlPattern = new RegExp('!!NL!!', 'g');
    const sensitivePattern = new RegExp(_.escapeRegExp(process.env.BOT_TOKEN), 'gi');

    const inspected = util
      .inspect(data, { depth: 0 })
      .replace(nlPattern, '\n')
      .replace(sensitivePattern, '--snip--');

    return inspected;
  }

  splitString(
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

  hasAny(base: string, part: string | string[]): boolean {
    const parts = Array.isArray(part) ? part : [part];
    for (const this_part of parts) {
      if (base.indexOf(this_part) !== -1) return true;
    }
    return false;
  }

  hasAll(base: string, parts: string[]): boolean {
    for (const this_part of parts) {
      if (!this.hasAny(base, this_part)) return false;
    }
    return true;
  }
}
