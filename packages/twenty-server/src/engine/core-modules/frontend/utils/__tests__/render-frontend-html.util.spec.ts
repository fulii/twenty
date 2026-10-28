import { type ClientConfig } from 'src/engine/core-modules/client-config/client-config.entity';
import { renderFrontendHtml } from 'src/engine/core-modules/frontend/utils/render-frontend-html.util';

const TEMPLATE = `<html><head>
<link rel="icon" href="./images/icons/favicon.png" />
<link rel="manifest" href="./manifest.json" />
<!-- BEGIN: Twenty Config -->
<script id="twenty-env-config">window._env_ = {};</script>
<!-- END: Twenty Config -->
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<a href="https://twenty.com">Twenty</a>
</head><body></body></html>`;

const CLIENT_CONFIG = { appVersion: '1.0.0' } as unknown as ClientConfig;

describe('renderFrontendHtml', () => {
  it('serves the front from the root of the domain by default', () => {
    const html = renderFrontendHtml(TEMPLATE, CLIENT_CONFIG);

    expect(html).toContain('href="/images/icons/favicon.png"');
    expect(html).toContain('href="/manifest.json"');
    expect(html).toContain('src="/assets/index-abc.js"');
    expect(html).toContain('window._env_ = {};');
  });

  it('serves the front and tells it about its base path under a sub-path', () => {
    const html = renderFrontendHtml(TEMPLATE, CLIENT_CONFIG, '/crm');

    expect(html).toContain('href="/crm/images/icons/favicon.png"');
    expect(html).toContain('href="/crm/manifest.json"');
    expect(html).toContain('src="/crm/assets/index-abc.js"');
    expect(html).toContain('window._env_ = {"REACT_APP_BASE_PATH":"/crm"};');
  });

  it('leaves absolute links alone and embeds the client config', () => {
    const html = renderFrontendHtml(TEMPLATE, CLIENT_CONFIG, '/crm');

    expect(html).toContain('href="https://twenty.com"');
    expect(html).toContain('"appVersion":"1.0.0"');
  });
});
