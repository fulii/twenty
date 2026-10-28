import { getTrustedProxyEmail } from 'src/engine/core-modules/auth/utils/get-trusted-proxy-email.util';

const request = (headers: Record<string, string>) => ({
  header: (name: string) => headers[name.toLowerCase()],
});

describe('getTrustedProxyEmail', () => {
  it('returns the email the gateway sends with the right secret', () => {
    expect(
      getTrustedProxyEmail(
        request({
          'x-famiglia-key': 's3cret',
          'x-famiglia-user': ' Anna@Example.com ',
        }),
        's3cret',
      ),
    ).toBe('anna@example.com');
  });

  it('refuses a request without the secret, with a wrong one, or without an email', () => {
    const user = { 'x-famiglia-user': 'anna@example.com' };

    expect(getTrustedProxyEmail(request(user), 's3cret')).toBeNull();
    expect(
      getTrustedProxyEmail(
        request({ ...user, 'x-famiglia-key': 'guess' }),
        's3cret',
      ),
    ).toBeNull();
    expect(
      getTrustedProxyEmail(request({ 'x-famiglia-key': 's3cret' }), 's3cret'),
    ).toBeNull();
  });

  it('is off when no secret is configured', () => {
    expect(
      getTrustedProxyEmail(
        request({
          'x-famiglia-key': '',
          'x-famiglia-user': 'anna@example.com',
        }),
        undefined,
      ),
    ).toBeNull();
  });
});
