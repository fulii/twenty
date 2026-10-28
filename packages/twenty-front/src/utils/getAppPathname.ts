import { BASE_PATH } from '~/config';

// The browser's pathname without the sub-path the app is served under, so it
// compares with AppPath like the router's location does
export const getAppPathname = (): string => {
  const { pathname } = window.location;

  return pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length) || '/'
    : pathname;
};
