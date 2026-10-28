import { ApiPath } from 'twenty-shared/types';
import { joinUrlPathname } from 'twenty-shared/utils';

// Workspace-agnostic by design: the workspace identity travels in the
// signed `state` parameter, so a single redirect URL configured at the
// OAuth provider serves every workspace.
export const buildAppOAuthCallbackUrl = (serverUrl: string): string =>
  new URL(
    joinUrlPathname(
      new URL(serverUrl).pathname,
      `${ApiPath.Auth}/apps/callback`,
    ),
    serverUrl,
  ).toString();
