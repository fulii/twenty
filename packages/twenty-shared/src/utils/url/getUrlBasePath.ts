// The path a deployment is served under, taken from its public URL:
// '' at the root of its domain, '/crm' for https://example.com/crm/
export const getUrlBasePath = (url: string | URL): string =>
  new URL(url).pathname.replace(/\/+$/, '');
