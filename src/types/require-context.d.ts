// Extend NodeRequire to include context for Metro/Webpack
interface NodeRequire {
  context: (
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp,
    mode?: 'sync' | 'eager' | 'weak' | 'lazy' | 'lazy-once'
  ) => {
    (id: string): any;
    keys: () => string[];
    resolve: (id: string) => string;
    id: string;
  };
}
