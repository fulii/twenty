import { returnToPathState } from '@/auth/states/returnToPathState';
import { isNonEmptyString } from '@sniptt/guards';
import { useStore } from 'jotai';
import { useEffect } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const LAST_ATTEMPT_STORAGE_KEY = 'trustedProxySignInAttemptedAt';

// Behind a trusted gateway the person is already known (AUTH_TRUSTED_PROXY_SECRET):
// sign in through it, at most once a minute so a failure shows the form instead of looping
export const SignInUpTrustedProxyEffect = () => {
  const store = useStore();

  useEffect(() => {
    if (
      window._env_?.REACT_APP_TRUSTED_PROXY_AUTH !== 'true' ||
      window.location.hash.includes('ssoExchangeToken')
    ) {
      return;
    }

    const lastAttempt = Number(
      sessionStorage.getItem(LAST_ATTEMPT_STORAGE_KEY) ?? 0,
    );

    if (Date.now() - lastAttempt < 60_000) {
      return;
    }

    sessionStorage.setItem(LAST_ATTEMPT_STORAGE_KEY, String(Date.now()));

    const url = new URL(`${REACT_APP_SERVER_BASE_URL}/auth/trusted-proxy`);
    const returnToPath = store.get(returnToPathState.atom);

    if (isNonEmptyString(returnToPath)) {
      url.searchParams.set('returnToPath', returnToPath);
    }

    window.location.replace(url.toString());
  }, [store]);

  return <></>;
};
