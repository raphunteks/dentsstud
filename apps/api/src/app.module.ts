import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/exception.filter.js';
import { InfraModule } from './infra/infra.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { LicensesModule } from './modules/licenses/licenses.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AiConnectionsModule } from './modules/ai-connections/ai-connections.module.js';
import { HealthModule } from './modules/health/health.controller.js';
import { OpsModule } from './modules/ops/ops.module.js';
import { CatalogModule } from './modules/catalog/catalog.controller.js';
import { MediaModule } from './modules/media/media.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { StylesModule } from './modules/styles/styles.module.js';
import { HooksModule } from './modules/hooks/hooks.module.js';
import { VoicesModule } from './modules/voices/voices.module.js';
import { MemberSettingsModule } from './modules/member-settings/member-settings.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { RenderModule } from './modules/rendering/render.module.js';
import { ProductionModule } from './modules/production/production.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }], skipIf: () => process.env.NODE_ENV === 'test' && process.env.THROTTLE_IN_TEST !== '1' }),
    InfraModule,
    IdentityModule,
    LicensesModule,
    AdminModule,
    AiConnectionsModule,
    CatalogModule,
    MediaModule,
    ImportsModule,
    StylesModule,
    HooksModule,
    VoicesModule,
    MemberSettingsModule,
    ProjectsModule,
    RenderModule,
    ProductionModule,
    HealthModule,
    OpsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
