import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { LicenseGrantInput, MemberStatusInput, PageQuery, SettingPatchInput, type SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod.js';
import { CurrentUser, Roles, type AuthedRequest } from '../../common/auth-context.js';
import { LicenseService } from '../licenses/license.service.js';
import { AdminService } from './admin.service.js';

const MembersQuery = PageQuery.extend({ status: z.string().max(24).optional(), role: z.enum(['SUPERADMIN', 'MEMBER']).optional() });
const LicensesQuery = PageQuery.extend({ status: z.string().max(24).optional() });
const AuditQuery = PageQuery.extend({ action: z.string().max(120).optional(), actorId: z.uuid().optional() });
const FlagInput = z.object({ enabled: z.boolean() });

@ApiTags('admin')
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly licenses: LicenseService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }

  @Get('members')
  members(@ZQuery(MembersQuery) q: z.infer<typeof MembersQuery>) {
    return this.admin.members(q);
  }

  @Get('members/:id')
  member(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.member(id);
  }

  @Patch('members/:id/status')
  @ApiZodBody(MemberStatusInput)
  status(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(MemberStatusInput) body: z.infer<typeof MemberStatusInput>, @Req() req: AuthedRequest) {
    return this.admin.setStatus(me.id, id, body.status, body.reason, req.ip);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeSession(me.id, id);
  }

  @Get('licenses')
  allLicenses(@ZQuery(LicensesQuery) q: z.infer<typeof LicensesQuery>) {
    return this.admin.allLicenses(q);
  }

  @Post('licenses/grant')
  @ApiZodBody(LicenseGrantInput)
  grant(@CurrentUser() me: SessionUser, @ZBody(LicenseGrantInput) body: LicenseGrantInput, @Req() req: AuthedRequest) {
    return this.licenses.grant(me.id, body, req.ip);
  }

  @HttpCode(200)
  @Post('licenses/:id/revoke')
  revoke(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.licenses.revoke(me.id, id, req.ip);
  }

  @Get('devices')
  devices(@ZQuery(PageQuery) q: PageQuery) {
    return this.admin.allDevices(q);
  }

  @Delete('devices/:id')
  revokeDevice(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.admin.revokeDevice(me.id, id, req.ip);
  }

  @Get('audit-logs')
  audit(@ZQuery(AuditQuery) q: z.infer<typeof AuditQuery>) {
    return this.admin.auditLogs(q);
  }

  @Get('settings')
  settings() {
    return this.admin.listSettings();
  }

  @Patch('settings/:key')
  @ApiZodBody(SettingPatchInput)
  patchSetting(@CurrentUser() me: SessionUser, @Param('key') key: string, @Body() body: { value: unknown }) {
    return this.admin.patchSetting(me.id, key, SettingPatchInput.parse(body).value);
  }

  @Get('feature-flags')
  flags() {
    return this.admin.listFlags();
  }

  @Patch('feature-flags/:key')
  @ApiZodBody(FlagInput)
  patchFlag(@CurrentUser() me: SessionUser, @Param('key') key: string, @ZBody(FlagInput) body: { enabled: boolean }) {
    return this.admin.patchFlag(me.id, key, body.enabled);
  }

  @Get('workers')
  workers() {
    return this.admin.workers();
  }
}
