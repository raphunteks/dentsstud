import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { TTS_PROVIDERS, VoiceCapabilities } from '@dentweb/content-schema';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody, ZodPipe } from '../../common/zod.js';
import { CurrentUser, Public, Roles } from '../../common/auth-context.js';
import { VoicesService } from './voices.service.js';
import { assertSafeMemberBaseUrl } from './tts.adapters.js';

const slug = z.string().min(2).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Attrs = z.object({ gender: z.enum(['male', 'female', 'neutral']).optional(), age: z.string().max(20).optional(), tone: z.string().max(80).optional() });
const VoiceInput = z.object({
  provider: z.enum(TTS_PROVIDERS), providerVoiceId: z.string().min(1).max(255), slug, name: z.string().min(2).max(150), language: z.string().min(2).max(40),
  description: z.string().max(2000).optional(), voiceAttributes: Attrs.optional(), capabilities: VoiceCapabilities.optional(),
  sampleAssetId: z.uuid().nullish(),
  synthesisConfig: z.object({ model: z.string().max(120).optional(), stability: z.number().min(0).max(1).optional(), similarityBoost: z.number().min(0).max(1).optional() }).optional(),
});
const VoicePatch = VoiceInput.omit({ provider: true, slug: true }).partial();
const ProviderPatch = z.object({ isEnabled: z.boolean().optional(), apiKey: z.string().min(10).max(400).optional(), baseUrl: z.url().nullish(), model: z.string().max(120).nullish() });
const TestInput = z.object({ text: z.string().min(1).max(500).optional() });
const ListQuery = z.object({ provider: z.enum(TTS_PROVIDERS).optional(), gender: z.enum(['male', 'female', 'neutral']).optional(), status: z.string().max(24).optional() });
const DictSchema = z.record(z.string().min(1).max(80), z.string().min(1).max(160)).refine((d) => Object.keys(d).length <= 200, 'Maksimal 200 entri kamus pelafalan');
const PreviewInput = z.object({ text: z.string().min(1).max(500).optional(), emotion: z.string().max(50).nullish(), speed: z.number().min(0.5).max(2).default(1), pitch: z.number().min(-12).max(12).nullish(), instructions: z.string().max(500).nullish(), dictionary: DictSchema.optional() });
const PrefInput = z.object({ voiceId: z.uuid().nullable(), emotion: z.string().max(50).nullish(), speed: z.number().min(0.5).max(2).default(1), pitch: z.number().min(-12).max(12).nullish(), instructions: z.string().max(1000).nullish(), dictionary: DictSchema.optional() });
const AccountInput = z.object({ apiKey: z.string().min(10).max(400).optional(), baseUrl: z.url().optional() }).refine((v) => v.apiKey || v.baseUrl, 'Isi API key atau URL engine');
const Provider = new ZodPipe(z.enum(TTS_PROVIDERS));

@ApiTags('voices')
@Controller('voices')
export class VoicesController {
  constructor(private readonly svc: VoicesService) {}

  @Public()
  @Get('providers')
  providers(@CurrentUser() me: SessionUser | undefined) {
    return this.svc.providersPublic(me?.id);
  }

  @Get('preferences/me')
  pref(@CurrentUser() me: SessionUser) {
    return this.svc.getPreference(me.id);
  }

  @Put('preferences/me')
  @ApiZodBody(PrefInput)
  putPref(@CurrentUser() me: SessionUser, @ZBody(PrefInput) b: z.infer<typeof PrefInput>) {
    return this.svc.putPreference(me.id, b);
  }

  @Public()
  @Get()
  list(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.svc.list(q, true);
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(id, true);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':id/preview')
  @ApiZodBody(PreviewInput)
  preview(@CurrentUser() me: SessionUser | undefined, @Param('id', ParseUUIDPipe) id: string, @ZBody(PreviewInput) b: z.infer<typeof PreviewInput>) {
    return this.svc.memberPreview(me?.id, id, b, me?.role === 'SUPERADMIN');
  }
}

@ApiTags('settings')
@Controller('settings/voice-accounts')
export class VoiceAccountsController {
  constructor(private readonly svc: VoicesService) {}

  @Get()
  list(@CurrentUser() me: SessionUser) {
    return this.svc.memberAccounts(me.id);
  }

  @Put(':provider')
  @ApiZodBody(AccountInput)
  put(@CurrentUser() me: SessionUser, @Param('provider', Provider) p: string, @ZBody(AccountInput) b: z.infer<typeof AccountInput>) {
    if (b.baseUrl) assertSafeMemberBaseUrl(b.baseUrl);
    return this.svc.putMemberAccount(me.id, p, b);
  }

  @HttpCode(200)
  @Post(':provider/test')
  test(@CurrentUser() me: SessionUser, @Param('provider', Provider) p: string) {
    return this.svc.testMemberAccount(me.id, p);
  }

  @Delete(':provider')
  remove(@CurrentUser() me: SessionUser, @Param('provider', Provider) p: string) {
    return this.svc.deleteMemberAccount(me.id, p);
  }
}

@ApiTags('admin-voices')
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminVoicesController {
  constructor(private readonly svc: VoicesService) {}

  @Get('voices')
  list(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.svc.list(q, false);
  }

  @Post('voices')
  @ApiZodBody(VoiceInput)
  create(@CurrentUser() me: SessionUser, @ZBody(VoiceInput) b: z.infer<typeof VoiceInput>) {
    return this.svc.create(me.id, b);
  }

  @Patch('voices/:id')
  @ApiZodBody(VoicePatch)
  update(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(VoicePatch) b: z.infer<typeof VoicePatch>) {
    return this.svc.update(me.id, id, b);
  }

  @Delete('voices/:id')
  remove(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(me.id, id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('voices/:id/test')
  @ApiZodBody(TestInput)
  test(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(TestInput) b: { text?: string }) {
    return this.svc.adminTest(me.id, id, b.text);
  }

  @HttpCode(200)
  @Post('voices/:id/sample')
  @ApiZodBody(z.object({ assetId: z.uuid() }))
  setSample(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(z.object({ assetId: z.uuid() })) b: { assetId: string }) {
    return this.svc.setSample(me.id, id, b.assetId);
  }

  @HttpCode(200)
  @Post('voices/:id/sample-base64')
  @ApiZodBody(z.object({ filename: z.string().min(1).max(255), base64: z.string().min(1) }))
  setSampleBase64(
    @CurrentUser() me: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(z.object({ filename: z.string().min(1).max(255), base64: z.string().min(1) })) b: { filename: string; base64: string },
  ) {
    const buf = Buffer.from(b.base64, 'base64');
    return this.svc.setSampleBuffer(me.id, id, b.filename, buf);
  }

  @HttpCode(200)
  @Post('voices/:id/publish')
  publish(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(me.id, id, 'PUBLISHED');
  }

  @HttpCode(200)
  @Post('voices/:id/disable')
  disable(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(me.id, id, 'DISABLED');
  }

  @Get('voice-providers')
  providers() {
    return this.svc.providersAdmin();
  }

  @Patch('voice-providers/:provider')
  @ApiZodBody(ProviderPatch)
  patchProvider(@CurrentUser() me: SessionUser, @Param('provider', Provider) p: string, @ZBody(ProviderPatch) b: z.infer<typeof ProviderPatch>) {
    return this.svc.patchProvider(me.id, p, b);
  }
}
