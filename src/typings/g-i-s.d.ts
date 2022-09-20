declare module 'g-i-s' {
  export default function gis(
    query:
      | string
      | {
          searchTerm: string;
          queryStringAddition?: string;
          filterOutDomains?: string[];
        },
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
