import { createHash, timingSafeEqual } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

const digest = (value: string) => createHash('sha256').update(value).digest();

// The email a trusted gateway vouches for, or null when the request does not
// carry the gateway's secret
export const getTrustedProxyEmail = (
  request: { header(name: string): string | undefined },
  secret: string | undefined,
): string | null => {
  const key = request.header('x-famiglia-key');
  const email = request.header('x-famiglia-user')?.trim().toLowerCase();

  if (
    !isNonEmptyString(secret) ||
    !isNonEmptyString(key) ||
    !isNonEmptyString(email) ||
    !timingSafeEqual(digest(key), digest(secret))
  ) {
    return null;
  }

  return email;
};
