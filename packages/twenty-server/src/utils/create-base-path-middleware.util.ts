import { type NextFunction, type Request, type Response } from 'express';

// A proxy in front of a sub-path deployment passes the path on whole: the base
// path comes off before routing, so every route matches as at the root, and
// goes back onto every redirect to a path of this server
export const createBasePathMiddleware =
  (basePath: string) =>
  (request: Request, response: Response, next: NextFunction) => {
    const rest = request.url.slice(basePath.length);

    if (
      request.url.startsWith(basePath) &&
      (rest === '' || rest.startsWith('/') || rest.startsWith('?'))
    ) {
      request.url = rest.startsWith('/') ? rest : `/${rest}`;

      const setLocation = response.location.bind(response);

      response.location = (url: string) =>
        setLocation(
          url.startsWith('/') && !url.startsWith('//') ? basePath + url : url,
        );
    }

    next();
  };
