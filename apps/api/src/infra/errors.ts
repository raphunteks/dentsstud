import { HttpException, HttpStatus } from '@nestjs/common';

/** Typed API error → { error: { code, message, details } } */
export class AppError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ error: { code, message, details } }, status);
  }
}

export const Errors = {
  unauthorized: (msg = 'Sesi tidak valid atau kedaluwarsa') => new AppError('UNAUTHORIZED', msg, HttpStatus.UNAUTHORIZED),
  forbidden: (msg = 'Anda tidak memiliki akses') => new AppError('FORBIDDEN', msg, HttpStatus.FORBIDDEN),
  notFound: (what = 'Data') => new AppError('NOT_FOUND', `${what} tidak ditemukan`, HttpStatus.NOT_FOUND),
  conflict: (code: string, msg: string) => new AppError(code, msg, HttpStatus.CONFLICT),
  invalid: (code: string, msg: string, details?: unknown) => new AppError(code, msg, HttpStatus.UNPROCESSABLE_ENTITY, details),
  tooMany: (msg = 'Terlalu banyak percobaan, coba lagi nanti') => new AppError('RATE_LIMITED', msg, HttpStatus.TOO_MANY_REQUESTS),
  unavailable: (code: string, msg: string) => new AppError(code, msg, HttpStatus.SERVICE_UNAVAILABLE),
};
