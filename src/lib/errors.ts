export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'error',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, 'bad_request', details);
export const Unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'unauthorized');
export const Forbidden = (msg = 'Forbidden') => new AppError(403, msg, 'forbidden');
export const NotFound = (msg = 'Not found') => new AppError(404, msg, 'not_found');
export const Conflict = (msg: string) => new AppError(409, msg, 'conflict');
export const Internal = (msg = 'Internal server error') => new AppError(500, msg, 'internal');
