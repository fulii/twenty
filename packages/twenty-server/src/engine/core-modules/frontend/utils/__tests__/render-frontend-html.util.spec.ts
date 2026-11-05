import { renderFrontendHtml } from 'src/engine/core-modules/frontend/utils/render-frontend-html.util';

const TEMPLATE =
  '<html><head><!-- BEGIN: Twenty Config --><script>window._env_ = { stale: true };</script><!-- END: Twenty Config --></head><body></body></html>';

const SUB_PATH_TEMPLATE = `<html><head>
<link rel="icon" href="./images/icons/favicon.png" />
<link rel="manifest" href="./manifest.json" />
<!-- BEGIN: Twenty Config -->
<script id="twenty-env-config">window._env_ = {};</script>
<!-- END: Twenty Config -->
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<a href="https://twenty.com">Twenty</a>
</head><body></body></html>`;

const CLIENT_CONFIG = { appVersion: '1.0.0' };

const getBootstrapContent = ({
  html,
  elementId,
}: {
  html: string;
  elementId: string;
}) =>
  html.match(
    new RegExp(
      `<script id="${elementId}" type="application/json">(.*?)</script>`,
    ),
  )?.[1];

describe('renderFrontendHtml', () => {
  it('embeds the iframe media permissions used for the document policy', () => {
    const html = renderFrontendHtml({
      template: TEMPLATE,
      clientConfig: {},
      iframeMediaPermissions: [
        {
          origin: 'https://phone.example.com',
          microphone: true,
          camera: false,
        },
      ],
    });

    expect(
      JSON.parse(
        getBootstrapContent({
          html,
          elementId: 'twenty-iframe-media-permissions',
        }) ?? '',
      ),
    ).toEqual([
      { origin: 'https://phone.example.com', microphone: true, camera: false },
    ]);
    expect(html).toContain(
      '<script id="twenty-env-config">window._env_ = {};</script>',
    );
  });

  it('escapes markup characters in embedded values', () => {
    const html = renderFrontendHtml({
      template: TEMPLATE,
      clientConfig: {},
      iframeMediaPermissions: [
        {
          origin: '</script><script>alert(1)</script>',
          microphone: true,
          camera: true,
        },
      ],
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(
      getBootstrapContent({
        html,
        elementId: 'twenty-iframe-media-permissions',
      }),
    ).toContain('\\u003c/script\\u003e');
  });

  it('serves the front from the root of the domain by default', () => {
    const html = renderFrontendHtml({
      template: SUB_PATH_TEMPLATE,
      clientConfig: CLIENT_CONFIG,
      iframeMediaPermissions: [],
    });

    expect(html).toContain('href="/images/icons/favicon.png"');
    expect(html).toContain('href="/manifest.json"');
    expect(html).toContain('src="/assets/index-abc.js"');
    expect(html).toContain('window._env_ = {};');
  });

  it('serves the front and tells it about its base path under a sub-path', () => {
    const html = renderFrontendHtml({
      template: SUB_PATH_TEMPLATE,
      clientConfig: CLIENT_CONFIG,
      iframeMediaPermissions: [],
      basePath: '/crm',
    });

    expect(html).toContain('href="/crm/images/icons/favicon.png"');
    expect(html).toContain('href="/crm/manifest.json"');
    expect(html).toContain('src="/crm/assets/index-abc.js"');
    expect(html).toContain('window._env_ = {"REACT_APP_BASE_PATH":"/crm"};');
  });

  it('leaves absolute links alone and embeds the client config', () => {
    const html = renderFrontendHtml({
      template: SUB_PATH_TEMPLATE,
      clientConfig: CLIENT_CONFIG,
      iframeMediaPermissions: [],
      basePath: '/crm',
    });

    expect(html).toContain('href="https://twenty.com"');
    expect(html).toContain('"appVersion":"1.0.0"');
  });
});
