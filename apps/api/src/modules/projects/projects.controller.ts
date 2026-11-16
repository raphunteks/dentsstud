import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Operation } from '@dentweb/motion-schema';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser } from '../../common/auth-context.js';
import { ProjectsService } from './projects.service.js';

const CreateInput = z.object({ name: z.string().trim().min(1).max(255), format: z.enum(['9:16', '16:9', '1:1']), document: z.unknown().optional() });
const PatchInput = z.object({ name: z.string().trim().min(1).max(255) });
const DocInput = z.object({ document: z.unknown(), baseRevision: z.number().int().min(1) });
const OpsInput = z.object({ operationId: z.uuid(), baseRevision: z.number().int().min(1), ops: z.array(Operation).min(1).max(500) });

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  list(@CurrentUser() me: SessionUser, @Query('trash') trash?: string) {
    return this.svc.list(me.id, trash === '1');
  }

  @Get('conflicts')
  conflicts(@CurrentUser() me: SessionUser) {
    return this.svc.conflicts(me.id);
  }

  @Post()
  @ApiZodBody(CreateInput)
  create(@CurrentUser() me: SessionUser, @ZBody(CreateInput) b: z.infer<typeof CreateInput>) {
    return this.svc.create(me.id, b);
  }

  @Get(':id')
  get(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.own(me.id, id);
  }

  @Patch(':id')
  @ApiZodBody(PatchInput)
  patch(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(PatchInput) b: { name: string }) {
    return this.svc.update(me.id, id, b);
  }

  @Delete(':id')
  remove(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.trash(me.id, id);
  }

  @HttpCode(200)
  @Post(':id/restore')
  restore(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restore(me.id, id);
  }

  @Get(':id/document')
  document(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.document(me.id, id);
  }

  @Put(':id/document')
  @ApiZodBody(DocInput)
  put(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(DocInput) b: z.infer<typeof DocInput>) {
    return this.svc.putDocument(me.id, id, b.document, b.baseRevision);
  }

  @HttpCode(200)
  @Post(':id/operations')
  @ApiZodBody(OpsInput)
  ops(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(OpsInput) b: z.infer<typeof OpsInput>) {
    return this.svc.applyOps(me.id, id, b);
  }

  @Get(':id/versions')
  versions(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.versions(me.id, id);
  }

  @HttpCode(201)
  @Post(':id/versions')
  snapshot(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.snapshot(me.id, id).then(({ document: _d, ...v }) => v);
  }
}
