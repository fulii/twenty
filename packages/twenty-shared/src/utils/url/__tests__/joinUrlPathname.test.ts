import { joinUrlPathname } from '@/utils/url/joinUrlPathname';

describe('joinUrlPathname', () => {
  it('leaves a path unchanged at the root', () => {
    expect(joinUrlPathname('', '/verify')).toBe('/verify');
    expect(joinUrlPathname('/', '/verify')).toBe('/verify');
  });

  it('puts a path under the base path, with exactly one slash between', () => {
    expect(joinUrlPathname('/crm', '/verify')).toBe('/crm/verify');
    expect(joinUrlPathname('/crm/', 'verify')).toBe('/crm/verify');
    expect(joinUrlPathname('/crm', '/')).toBe('/crm/');
  });
});
