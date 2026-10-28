import { type Request, type Response } from 'express';

import { createBasePathMiddleware } from 'src/utils/create-base-path-middleware.util';

const handle = (basePath: string, url: string) => {
  const request = { url } as Request;
  const setLocation = jest.fn();
  const response = { location: setLocation } as unknown as Response;
  const next = jest.fn();

  createBasePathMiddleware(basePath)(request, response, next);
  expect(next).toHaveBeenCalledTimes(1);

  return { request, response, setLocation };
};

describe('createBasePathMiddleware', () => {
  it('takes the base path off a request under it', () => {
    expect(handle('/crm', '/crm/graphql').request.url).toBe('/graphql');
    expect(handle('/crm', '/crm/objects/people?view=1').request.url).toBe(
      '/objects/people?view=1',
    );
    expect(handle('/crm', '/crm').request.url).toBe('/');
    expect(handle('/crm', '/crm/').request.url).toBe('/');
    expect(handle('/crm', '/crm?token=1').request.url).toBe('/?token=1');
  });

  it('leaves a request outside the base path as it is', () => {
    expect(handle('/crm', '/graphql').request.url).toBe('/graphql');
    expect(handle('/crm', '/crmx/graphql').request.url).toBe('/crmx/graphql');
  });

  it('puts the base path back onto a redirect to a path of this server', () => {
    const { response, setLocation } = handle('/crm', '/crm/auth/microsoft');

    response.location('/auth/microsoft?oauthRetryCount=1');
    response.location('https://login.microsoftonline.com/');
    response.location('//elsewhere.example/');

    expect(setLocation.mock.calls).toEqual([
      ['/crm/auth/microsoft?oauthRetryCount=1'],
      ['https://login.microsoftonline.com/'],
      ['//elsewhere.example/'],
    ]);
  });
});
