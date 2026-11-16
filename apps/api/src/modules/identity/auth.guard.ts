import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@dentweb/shared-types';
import { IS_PUBLIC, ROLES_KEY, type AuthedRequest } from '../../common/auth-context.js';
import { Errors } from '../../infra/errors.js';
import { SessionService } from './session.service.js';

export const SESSION_COOKIE = 'dw_sid';
export const REFRESH_COOKIE = 'dw_rt';

export function extractAccessToken(req: AuthedRequest): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7).trim() || null;
  const c = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  return c || null;
}

/** Global: every route requires a valid session unless marked @Public(). Then enforces @Roles(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = extractAccessToken(req);
    if (token) {
      const resolved = await this.sessions.resolve(token);
      if (resolved) {
        req.user = resolved.user;
        req.sessionId = resolved.sessionId;
        req.deviceId = resolved.deviceId;
      }
    }
    if (isPublic) return true;
    if (!req.user) throw Errors.unauthorized();
    if (req.user.status !== 'ACTIVE') throw Errors.forbidden('Akun tidak aktif');
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(req.user.role)) throw Errors.forbidden();
    return true;
  }
}
