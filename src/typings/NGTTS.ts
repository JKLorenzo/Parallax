/* eslint-disable no-unused-vars */

declare module 'node-google-tts-api' {
  export default class googleTTS {
    constructor();

    get(options: { text: string; lang: 'en'; limit_bypass: boolean }): Promise<Buffer>;
  }
}
