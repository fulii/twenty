import { CLIENT_CONFIG_BOOTSTRAP_ELEMENT_ID } from 'twenty-shared/constants';

import { type ClientConfig } from 'src/engine/core-modules/client-config/client-config.entity';

const serializeForScript = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

// The front is built with a relative base, so its own references are put
// under the path the server is deployed under (getUrlBasePath of SERVER_URL)
export const renderFrontendHtml = (
  template: string,
  clientConfig: ClientConfig,
  basePath = '',
): string => {
  const serializedConfig = serializeForScript(clientConfig);
  const env = basePath === '' ? {} : { REACT_APP_BASE_PATH: basePath };

  return template
    .replace(
      /(src|href)="\.\//g,
      (_match, attribute) => `${attribute}="${basePath}/`,
    )
    .replace(
      /<!-- BEGIN: Twenty Config -->[\s\S]*?<!-- END: Twenty Config -->/,
      () =>
        `<script id="twenty-env-config">window._env_ = ${serializeForScript(env)};</script>`,
    )
    .replace(
      '</head>',
      () =>
        `<script id="${CLIENT_CONFIG_BOOTSTRAP_ELEMENT_ID}" type="application/json">${serializedConfig}</script></head>`,
    );
};
