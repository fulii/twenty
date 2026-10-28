// '' at the root of the domain, '/crm' when the server is under a sub-path
export const BASE_PATH = (window._env_?.REACT_APP_BASE_PATH ?? '').replace(
  /\/+$/,
  '',
);

export const REACT_APP_SERVER_BASE_URL =
  window._env_?.REACT_APP_SERVER_BASE_URL ||
  `${window.location.origin}${BASE_PATH}`;
