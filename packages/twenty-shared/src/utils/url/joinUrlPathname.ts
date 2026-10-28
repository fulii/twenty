export const joinUrlPathname = (basePath: string, pathname: string): string =>
  `${basePath.replace(/\/+$/, '')}/${pathname.replace(/^\/+/, '')}`;
