import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { ZodError } from 'zod';
import { redact } from '../infra/crypto.js';
import { ErrorReportsService } from '../infra/observability.js';
import type { AuthedRequest } from './auth-context.js';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  constructor(private readonly errors: ErrorReportsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof ThrottlerException) {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan, coba lagi nanti' } });
      return;
    }
    if (exception instanceof ZodError) {
      res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'Data tidak valid', details: exception.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })) } });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'error' in body) {
        res.status(status).json(body);
        return;
      }
      const message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message);
      res.status(status).json({ error: { code: HttpStatus[status] ?? 'ERROR', message: String(message) } });
      return;
    }
    const err = exception as Error;
    this.logger.error(redact(err?.stack ?? String(exception)));
    const req = host.switchToHttp().getRequest<Request & AuthedRequest>();
    void this.errors.record({ source: 'api', message: err?.message ?? String(exception), stack: err?.stack, userId: req.user?.id ?? null, context: { method: req.method, route: `${req.baseUrl ?? ''}${(req.route as { path?: string } | undefined)?.path ?? req.path}` } });
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan internal' } });
  }
}
