import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { LicenseGrantInput, MemberStatusInput, PageQuery, SettingPatchInput, type SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod.js';
import { CurrentUser, Roles, type AuthedRequest } from '../../common/auth-context.js';
import { loadEnv } from '../../config/env.js';
import { LicenseService } from '../licenses/license.service.js';
import { AdminService } from './admin.service.js';

const skillTmpDir = () => {
  const d = resolve(loadEnv().STORAGE_DIR, '_scratch', 'skill-zips');
  mkdirSync(d, { recursive: true });
  return d;
};

const MembersQuery = PageQuery.extend({ status: z.string().max(24).optional(), role: z.enum(['SUPERADMIN', 'MEMBER']).optional() });
const LicensesQuery = PageQuery.extend({ status: z.string().max(24).optional() });
const AuditQuery = PageQuery.extend({ action: z.string().max(120).optional(), actorId: z.uuid().optional() });
const FlagInput = z.object({ enabled: z.boolean() });
const IncidentCreateInput = z.object({
  title: z.string().trim().min(3).max(255),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  affectedServices: z.array(z.string().max(60)).max(20).optional(),
  rootCause: z.string().max(4000).optional(),
  recoverySteps: z.string().max(4000).optional(),
  preventive: z.string().max(4000).optional(),
});
const IncidentPatchInput = IncidentCreateInput.partial().extend({
  status: z.enum(['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED']).optional(),
});
const SkillCreateInput = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10).max(500000),
  active: z.boolean().optional(),
});
const SkillPatchInput = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10).max(500000).optional(),
  active: z.boolean().optional(),
});
const SkillFolderInput = z.object({
  folderName: z.string().trim().max(150).optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(400),
        content: z.string().max(2_000_000).optional(),
        base64: z.string().max(20_000_000).optional(),
      }),
    )
    .min(1)
    .max(500),
});
const OAuthClientEntry = z.object({
  clientId: z.string().trim().max(300).optional(),
  clientSecret: z.string().trim().max(300).optional(),
  redirectUri: z.string().trim().max(500).optional(),
});
const OAuthClientsPatchInput = z.object({
  gemini: OAuthClientEntry.optional(),
  openai: OAuthClientEntry.optional(),
});

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

  @Get('incidents')
  incidents() {
    return this.admin.listIncidents();
  }

  @Post('incidents')
  @ApiZodBody(IncidentCreateInput)
  createIncident(@CurrentUser() me: SessionUser, @ZBody(IncidentCreateInput) body: z.infer<typeof IncidentCreateInput>) {
    return this.admin.createIncident(me.id, body);
  }

  @Patch('incidents/:id')
  @ApiZodBody(IncidentPatchInput)
  patchIncident(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(IncidentPatchInput) body: z.infer<typeof IncidentPatchInput>) {
    return this.admin.patchIncident(me.id, id, body);
  }

  @Get('skills')
  skills() {
    return this.admin.listSkills();
  }

  @Post('skills')
  @ApiZodBody(SkillCreateInput)
  addSkill(@CurrentUser() me: SessionUser, @ZBody(SkillCreateInput) body: z.infer<typeof SkillCreateInput>) {
    return this.admin.addSkill(me.id, body);
  }

  @Patch('skills/:id')
  @ApiZodBody(SkillPatchInput)
  patchSkill(@CurrentUser() me: SessionUser, @Param('id') id: string, @ZBody(SkillPatchInput) body: z.infer<typeof SkillPatchInput>) {
    return this.admin.patchSkill(me.id, id, body);
  }

  @Post('skills/upload-zip')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_r, _f, cb) => cb(null, skillTmpDir()),
        filename: (_r, _f, cb) => cb(null, `${randomUUID()}.zip`),
      }),
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  uploadSkillZip(@CurrentUser() me: SessionUser, @UploadedFile() file: Express.Multer.File) {
    return this.admin.uploadSkillZip(me.id, file);
  }

  @Post('skills/upload-folder')
  @ApiZodBody(SkillFolderInput)
  uploadSkillFolder(@CurrentUser() me: SessionUser, @ZBody(SkillFolderInput) body: z.infer<typeof SkillFolderInput>) {
    return this.admin.uploadSkillFolder(me.id, body);
  }

  @Delete('skills/:id')
  deleteSkill(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    return this.admin.deleteSkill(me.id, id);
  }

  @Get('ai/oauth-clients')
  oauthClients() {
    return this.admin.getOAuthClients();
  }

  @Patch('ai/oauth-clients')
  @ApiZodBody(OAuthClientsPatchInput)
  patchOAuthClients(@CurrentUser() me: SessionUser, @ZBody(OAuthClientsPatchInput) body: z.infer<typeof OAuthClientsPatchInput>) {
    return this.admin.patchOAuthClients(me.id, body);
  }
}
