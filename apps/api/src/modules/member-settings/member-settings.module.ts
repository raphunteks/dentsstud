import { Controller, Get, Inject, Module, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, memberBrandProfiles, memberProductionSettings } from '@dentweb/database';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser } from '../../common/auth-context.js';
import { DB } from '../../infra/tokens.js';
import { Errors } from '../../infra/errors.js';
import { LicensesModule } from '../licenses/licenses.module.js';
import { LicenseService } from '../licenses/license.service.js';

/** Empty field = AI chooses automatically (v1.1 §2.13). */
const opt = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const BrandInput = z.object({
  name: z.string().trim().max(150).default(''),
  instagramUsername: opt(120).refine((v) => !v || /^@?[A-Za-z0-9._]{1,30}$/.test(v), 'Username Instagram tidak valid'),
  openingText: opt(500),
  closingText: opt(500),
  captionCta: opt(300),
  brandSettings: z.object({ colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(6).default([]), logoAssetId: z.uuid().nullish(), tone: opt(200) }).default({ colors: [], tone: null }),
});
const ProductionInput = z.object({
  videosPerDay: z.number().int().min(0).max(500),
  defaultWorkers: z.number().int().min(1).max(16),
  preferredFormat: z.enum(['9:16', '16:9', '1:1']),
  scheduleConfig: z.object({ enabled: z.boolean().default(false), times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(24).default([]), timezone: z.string().max(60).default('Asia/Makassar'), topics: z.array(z.string().max(200)).max(50).default([]), presetId: z.uuid().nullish(), hookMode: z.enum(['AUTO', 'NONE']).default('AUTO') }).default({ enabled: false, times: [], timezone: 'Asia/Makassar', topics: [], hookMode: 'AUTO' }),
});

@ApiTags('settings')
@Controller('settings')
class MemberSettingsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly licenses: LicenseService,
  ) {}

  @Get('brand')
  async brand(@CurrentUser() me: SessionUser) {
    const [b] = await this.db.select().from(memberBrandProfiles).where(eq(memberBrandProfiles.userId, me.id)).limit(1);
    return b ?? { name: '', instagramUsername: null, openingText: null, closingText: null, captionCta: null, brandSettings: { colors: [] } };
  }

  @Put('brand')
  @ApiZodBody(BrandInput)
  async putBrand(@CurrentUser() me: SessionUser, @ZBody(BrandInput) b: z.infer<typeof BrandInput>) {
    const [cur] = await this.db.select().from(memberBrandProfiles).where(eq(memberBrandProfiles.userId, me.id)).limit(1);
    const values = { ...b, instagramUsername: b.instagramUsername?.replace(/^@/, '') ?? null };
    const [row] = cur
      ? await this.db.update(memberBrandProfiles).set(values).where(eq(memberBrandProfiles.id, cur.id)).returning()
      : await this.db.insert(memberBrandProfiles).values({ userId: me.id, ...values }).returning();
    return row;
  }

  @Get('production')
  async production(@CurrentUser() me: SessionUser) {
    const [p] = await this.db.select().from(memberProductionSettings).where(eq(memberProductionSettings.userId, me.id));
    const ent = (await this.licenses.summary(me.id)).entitlements;
    return { settings: p ?? { videosPerDay: 0, defaultWorkers: 1, preferredFormat: '9:16', scheduleConfig: { enabled: false, times: [], timezone: 'Asia/Makassar', topics: [] } }, limits: ent };
  }

  @Put('production')
  @ApiZodBody(ProductionInput)
  async putProduction(@CurrentUser() me: SessionUser, @ZBody(ProductionInput) b: z.infer<typeof ProductionInput>) {
    const ent = (await this.licenses.summary(me.id)).entitlements;
    if (b.defaultWorkers > Math.max(1, ent.maxWorkers)) throw Errors.invalid('ENTITLEMENT_WORKERS', `Lisensi Anda mengizinkan maksimal ${ent.maxWorkers} worker`);
    if (b.videosPerDay > ent.maxVideosPerDay) throw Errors.invalid('ENTITLEMENT_VIDEOS', `Lisensi Anda mengizinkan maksimal ${ent.maxVideosPerDay} video per hari`);
    const [row] = await this.db.insert(memberProductionSettings).values({ userId: me.id, ...b }).onConflictDoUpdate({ target: memberProductionSettings.userId, set: b }).returning();
    return row;
  }
}

@Module({ imports: [LicensesModule], controllers: [MemberSettingsController] })
export class MemberSettingsModule {}
