import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role, SessionUser } from '@dentweb/shared-types';

export interface AuthedRequest extends Request {
  user?: SessionUser;
  sessionId?: string;
  deviceId?: string | null;
}

export const IS_PUBLIC = 'dw:public';
export const ROLES_KEY = 'dw:roles';

/** Route is reachable without session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Restrict route to roles (RBAC enforced server-side). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user!;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return (req.ip ?? '').slice(0, 64);
});
