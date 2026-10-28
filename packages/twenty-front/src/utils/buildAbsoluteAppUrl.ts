import { joinUrlPathname } from 'twenty-shared/utils';

import { BASE_PATH } from '~/config';

export const buildAbsoluteAppUrl = (appPath: string): URL =>
  new URL(joinUrlPathname(BASE_PATH, appPath), window.location.origin);
