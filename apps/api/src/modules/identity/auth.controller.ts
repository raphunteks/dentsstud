import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, CookieOptions } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { type Database, users } from '@dentweb/database';
import { LoginInput, OtpResendInput, OtpVerifyInput, RegisterInput, UpdateMeInput, type SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser, Public, type AuthedRequest } from '../../common/auth-context.js';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { AuditService } from '../../infra/infra.module.js';
import { Errors } from '../../infra/errors.js';
import { AuthService, type ClientMeta } from './auth.service.js';
import { SessionService, type IssuedSession } from './session.service.js';
import { REFRESH_COOKIE, SESSION_COOKIE } from './auth.guard.js';

const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private meta(req: AuthedRequest, client: 'web' | 'desktop' = 'web'): ClientMeta {
    return { ip: req.ip, userAgent: req.headers['user-agent'], client };
  }

  private cookieBase(): CookieOptions {
    const secure = this.env.COOKIE_SECURE ?? this.env.NODE_ENV === 'production';
    return { httpOnly: true, secure, sameSite: 'lax' };
  }

  private applySession(res: Response, s: IssuedSession, client: 'web' | 'desktop') {
    if (client === 'desktop') {
      return { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt, refreshExpiresAt: s.refreshExpiresAt };
    }
    res.cookie(SESSION_COOKIE, s.accessToken, { ...this.cookieBase(), path: '/', expires: s.expiresAt });
    res.cookie(REFRESH_COOKIE, s.refreshToken, { ...this.cookieBase(), path: '/api/v1/auth', expires: s.refreshExpiresAt });
    // Non-secret hint for the web edge proxy (refresh cookie is path-scoped to /api/v1/auth).
    res.cookie('dw_auth', '1', { ...this.cookieBase(), httpOnly: false, path: '/', expires: s.refreshExpiresAt });
    return { expiresAt: s.expiresAt };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  @ApiZodBody(RegisterInput)
  register(@ZBody(RegisterInput) body: RegisterInput, @Req() req: AuthedRequest) {
    return this.auth.register(body, this.meta(req));
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('login')
  @ApiZodBody(LoginInput)
  login(@ZBody(LoginInput) body: LoginInput, @Req() req: AuthedRequest) {
    return this.auth.login(body, this.meta(req));
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('otp/verify')
  @ApiZodBody(OtpVerifyInput)
  async verify(@ZBody(OtpVerifyInput) body: OtpVerifyInput, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const { user, session } = await this.auth.verifyOtp(body.challengeId, body.code, this.meta(req, body.client));
    return { user, session: this.applySession(res, session, body.client) };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/resend')
  @ApiZodBody(OtpResendInput)
  resend(@ZBody(OtpResendInput) body: { challengeId: string }) {
    return this.auth.resend(body.challengeId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: AuthedRequest, @Body() body: { refreshToken?: string } | undefined, @Res({ passthrough: true }) res: Response) {
    const fromBody = typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;
    const token = fromBody ?? (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw Errors.unauthorized('Refresh token tidak ada');
    const s = await this.sessions.rotate(token);
    return { session: this.applySession(res, s, fromBody ? 'desktop' : 'web') };
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.sessions.revoke(req.sessionId);
    await this.audit.log({ actorId: req.user!.id, action: 'auth.logout', targetType: 'session', targetId: req.sessionId, ip: req.ip });
    res.clearCookie(SESSION_COOKIE, { ...this.cookieBase(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieBase(), path: '/api/v1/auth' });
    res.clearCookie('dw_auth', { ...this.cookieBase(), httpOnly: false, path: '/' });
    return { ok: true };
  }

  @Get('session')
  session(@CurrentUser() user: SessionUser, @Req() req: AuthedRequest) {
    return { user, sessionId: req.sessionId, deviceId: req.deviceId ?? null };
  }
}

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  @Get()
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  @Patch()
  @ApiZodBody(UpdateMeInput)
  async update(@CurrentUser() user: SessionUser, @ZBody(UpdateMeInput) body: { displayName: string }) {
    const [u] = await this.db
      .update(users)
      .set({ displayName: body.displayName })
      .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
      .returning({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, status: users.status });
    await this.audit.log({ actorId: user.id, action: 'me.update', targetType: 'user', targetId: user.id });
    return u;
  }
}
