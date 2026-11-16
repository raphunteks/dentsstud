import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DeviceActivateInput, type SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser, Public, type AuthedRequest } from '../../common/auth-context.js';
import { SessionService } from '../identity/session.service.js';
import { LicenseService } from './license.service.js';

@ApiTags('licenses')
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licenses: LicenseService) {}

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return this.licenses.summary(user.id);
  }

  @Get('entitlements')
  async entitlements(@CurrentUser() user: SessionUser) {
    return (await this.licenses.summary(user.id)).entitlements;
  }

  @HttpCode(200)
  @Post('offline-proof')
  offlineProof(@CurrentUser() user: SessionUser, @Req() req: AuthedRequest) {
    return this.licenses.offlineProof(user.id, req.deviceId);
  }

  @Public()
  @Get('public-key')
  publicKey() {
    return { alg: 'EdDSA', pem: this.licenses.publicKeyPem };
  }
}

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly licenses: LicenseService,
    private readonly sessions: SessionService,
  ) {}

  @HttpCode(200)
  @Post('activate')
  @ApiZodBody(DeviceActivateInput)
  async activate(@CurrentUser() user: SessionUser, @ZBody(DeviceActivateInput) body: DeviceActivateInput, @Req() req: AuthedRequest) {
    const r = await this.licenses.activateDevice(user.id, body, req.ip);
    if (req.sessionId) await this.sessions.bindDevice(req.sessionId, r.device.id);
    return { deviceId: r.device.id, licenseId: r.licenseId };
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.licenses.listDevices(user.id);
  }

  @Delete(':id')
  release(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.licenses.releaseDevice(user.id, user.id, id, req.ip);
  }
}
