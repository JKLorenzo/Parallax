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
