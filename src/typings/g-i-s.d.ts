interface Result {
  url: string;
  height: number;
  width: number;
  color: [number, number, number];
}

interface Options {
  query?: object;
  userAgent?: string;
}

declare module 'async-g-i-s' {
  function gis(searchTerm: string, options?: Options): Promise<Result[]>;
  export default gis;
}
