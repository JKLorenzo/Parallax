declare module 'g-i-s' {
  export default function gis(
    query: string,
    callback: (
      error: Error,
      results: {
        url: string;
        width: number;
        height: number;
      }[],
    ) => void,
  ): void;
}

declare module 'node-google-tts-api' {
  export default class googleTTS {
    constructor();
    get(options: { text: string; lang: 'en'; limit_bypass: boolean }): Promise<Buffer>;
  }
}
