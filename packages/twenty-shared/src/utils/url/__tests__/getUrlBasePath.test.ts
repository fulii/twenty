import { getUrlBasePath } from '@/utils/url/getUrlBasePath';

describe('getUrlBasePath', () => {
  it('is empty at the root of a domain', () => {
    expect(getUrlBasePath('https://crm.example.com')).toBe('');
    expect(getUrlBasePath('https://crm.example.com/')).toBe('');
    expect(getUrlBasePath('http://localhost:3000')).toBe('');
  });

  it('is the path without its trailing slash under a sub-path', () => {
    expect(getUrlBasePath('https://example.com/crm')).toBe('/crm');
    expect(getUrlBasePath('https://example.com/crm/')).toBe('/crm');
    expect(getUrlBasePath(new URL('https://example.com/apps/crm/'))).toBe(
      '/apps/crm',
    );
  });
});
