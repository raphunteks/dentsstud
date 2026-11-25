import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AiConnectionPatchInput, AiConnectionStartInput, AiTestInput, type SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser, type AuthedRequest } from '../../common/auth-context.js';
import { AiConnectionsService } from './ai-connections.service.js';

const SetModelInput = z.object({ model: z.string().min(2).max(160).regex(/^[a-z0-9._:/-]+$/i, 'Format nama model tidak valid') });

@ApiTags('ai')
@Controller('ai')
export class AiConnectionsController {
  constructor(private readonly svc: AiConnectionsService) {}

  @Get('providers')
  providers() {
    return this.svc.providers();
  }

  @Get('models')
  async models(@CurrentUser() user: SessionUser) {
    const s = await this.svc.status(user.id);
    const caps = (s.connection?.capabilities ?? {}) as { models?: string[]; defaultModel?: string };
    return { status: s.status, models: caps.models ?? [], defaultModel: caps.defaultModel ?? null };
  }

  @Get('capabilities')
  capabilities(@CurrentUser() user: SessionUser) {
    return this.svc.status(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('connections/start')
  @ApiZodBody(AiConnectionStartInput)
  start(@CurrentUser() user: SessionUser, @ZBody(AiConnectionStartInput) body: AiConnectionStartInput, @Req() req: AuthedRequest) {
    return this.svc.start(user.id, body, { deviceId: req.deviceId, ip: req.ip });
  }

  @Get('connections/callback')
  callback(@CurrentUser() user: SessionUser, @Query() q: { state?: string; code?: string; error?: string }) {
    return this.svc.callback(user.id, q);
  }

  @Get('connections')
  list(@CurrentUser() user: SessionUser) {
    return this.svc.list(user.id);
  }

  @HttpCode(200)
  @Post('connections/:id/check')
  check(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.check(user.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('connections/:id/test')
  @ApiZodBody(AiTestInput)
  test(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(AiTestInput) body: { prompt: string }) {
    return this.svc.test(user.id, id, body.prompt);
  }

  @HttpCode(200)
  @Post('connections/:id/model')
  @ApiZodBody(SetModelInput)
  setModel(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(SetModelInput) body: { model: string },
  ) {
    return this.svc.setDefaultModel(user.id, id, body.model);
  }

  @Patch('connections/:id')
  @ApiZodBody(AiConnectionPatchInput)
  patch(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(AiConnectionPatchInput) body: AiConnectionPatchInput,
  ) {
    return this.svc.patchConnection(user.id, id, body);
  }

  @Delete('connections/:id')
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user.id, id);
  }
}
