import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { ZBody, ZQuery } from '../../common/zod.js';
import { SOCIAL_PLATFORM_CODES, type SocialPlatformCode } from './social-platforms.js';
import { SocialService } from './social.service.js';

const PlatformEnum = z.enum(SOCIAL_PLATFORM_CODES);
const PostStatusEnum = z.enum(['IDEA', 'DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED']);

const ConnectAccountInput = z.object({
  platform: PlatformEnum,
  handle: z.string().trim().min(1).max(160),
  displayName: z.string().trim().max(160).optional(),
  accessToken: z.string().trim().min(1).max(4000),
  externalId: z.string().trim().max(200).optional(),
  instanceUrl: z.string().trim().max(300).optional(),
  boardId: z.string().trim().max(200).optional(),
});

const PostsQuery = z.object({
  status: PostStatusEnum.optional(),
  platform: PlatformEnum.optional(),
});

const CreatePostInput = z.object({
  platform: PlatformEnum,
  accountId: z.string().uuid().nullable().optional(),
  resultId: z.string().uuid().nullable().optional(),
  status: z.enum(['IDEA', 'DRAFT', 'SCHEDULED']).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  caption: z.string().max(64000).optional(),
  hashtags: z.array(z.string().max(80)).max(50).optional(),
  firstComment: z.string().max(4000).nullable().optional(),
  mediaUrl: z.string().url().max(2000).nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const PatchPostInput = z.object({
  platform: PlatformEnum.optional(),
  accountId: z.string().uuid().nullable().optional(),
  status: z.enum(['IDEA', 'DRAFT', 'SCHEDULED']).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  caption: z.string().max(64000).optional(),
  hashtags: z.array(z.string().max(80)).max(50).optional(),
  firstComment: z.string().max(4000).nullable().optional(),
  mediaUrl: z.string().url().max(2000).nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const PlatformConfigPatch = z.object({
  enabled: z.boolean().optional(),
  clientId: z.string().max(400).optional(),
  clientSecret: z.string().max(1000).optional(),
  redirectUri: z.string().max(500).optional(),
  dailyLimitPerMember: z.number().int().min(1).max(200).optional(),
});

const AdminSocialConfigPatch = z.object({
  autoPublishEnabled: z.boolean().optional(),
  platforms: z.record(z.string(), PlatformConfigPatch).optional(),
});

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('platforms')
  platforms() {
    return this.social.listPlatforms();
  }

  @Get('accounts')
  accounts(@CurrentUser() user: SessionUser) {
    return this.social.listAccounts(user.id);
  }

  @Post('accounts/connect')
  connectAccount(@CurrentUser() user: SessionUser, @ZBody(ConnectAccountInput) body: z.infer<typeof ConnectAccountInput>) {
    return this.social.connectAccount(user.id, body);
  }

  @Delete('accounts/:id')
  disconnectAccount(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.disconnectAccount(user.id, id);
  }

  @Get('posts')
  posts(@CurrentUser() user: SessionUser, @ZQuery(PostsQuery) query: z.infer<typeof PostsQuery>) {
    return this.social.listPosts(user.id, query);
  }

  @Post('posts')
  createPost(@CurrentUser() user: SessionUser, @ZBody(CreatePostInput) body: z.infer<typeof CreatePostInput>) {
    return this.social.createPost(user.id, body);
  }

  @Patch('posts/:id')
  updatePost(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(PatchPostInput) body: z.infer<typeof PatchPostInput>,
  ) {
    return this.social.updatePost(user.id, id, body);
  }

  @Post('posts/:id/publish')
  @HttpCode(200)
  publishPost(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.publishPost(user.id, id);
  }

  @Delete('posts/:id')
  deletePost(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.social.deletePost(user.id, id);
  }
}

@ApiTags('admin-social')
@Roles('SUPERADMIN')
@Controller('admin/social')
export class AdminSocialController {
  constructor(private readonly social: SocialService) {}

  @Get('config')
  getConfig() {
    return this.social.getAdminConfig();
  }

  @Patch('config')
  patchConfig(@CurrentUser() admin: SessionUser, @ZBody(AdminSocialConfigPatch) body: z.infer<typeof AdminSocialConfigPatch>) {
    return this.social.patchAdminConfig(admin.id, {
      autoPublishEnabled: body.autoPublishEnabled,
      platforms: body.platforms as Partial<Record<SocialPlatformCode, z.infer<typeof PlatformConfigPatch>>> | undefined,
    });
  }

  @Get('overview')
  overview() {
    return this.social.adminOverview();
  }
}
