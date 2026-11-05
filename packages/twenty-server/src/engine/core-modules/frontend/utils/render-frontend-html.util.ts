import {
  CLIENT_CONFIG_BOOTSTRAP_ELEMENT_ID,
  IFRAME_MEDIA_PERMISSIONS_BOOTSTRAP_ELEMENT_ID,
} from 'twenty-shared/constants';
import { type IframeMediaPermission } from 'twenty-shared/types';

import { serializeJsonForHtmlScript } from 'src/engine/core-modules/frontend/utils/serialize-json-for-html-script.util';

// The front is built with a relative base, so its own references are put
// under the path the server is deployed under (getUrlBasePath of SERVER_URL)
export const renderFrontendHtml = ({
  template,
  clientConfig,
  iframeMediaPermissions,
  basePath = '',
  extraEnv = {},
}: {
  template: string;
  clientConfig: object;
  iframeMediaPermissions: IframeMediaPermission[];
  basePath?: string;
  extraEnv?: Record<string, string>;
}): string => {
  const env = {
    ...(basePath === '' ? {} : { REACT_APP_BASE_PATH: basePath }),
    ...extraEnv,
  };

  return template
    .replace(
      /(src|href)="\.\//g,
      (_match, attribute) => `${attribute}="${basePath}/`,
    )
    .replace(
      /<!-- BEGIN: Twenty Config -->[\s\S]*?<!-- END: Twenty Config -->/,
      () =>
        `<script id="twenty-env-config">window._env_ = ${serializeJsonForHtmlScript(env)};</script>`,
    )
    .replace(
      '</head>',
      () =>
        `<script id="${CLIENT_CONFIG_BOOTSTRAP_ELEMENT_ID}" type="application/json">${serializeJsonForHtmlScript(clientConfig)}</script>` +
        `<script id="${IFRAME_MEDIA_PERMISSIONS_BOOTSTRAP_ELEMENT_ID}" type="application/json">${serializeJsonForHtmlScript(iframeMediaPermissions)}</script></head>`,
    );
};
