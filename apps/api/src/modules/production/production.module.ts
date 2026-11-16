import { Module } from '@nestjs/common';
import { LicensesModule } from '../licenses/licenses.module.js';
import { AiConnectionsModule } from '../ai-connections/ai-connections.module.js';
import { VoicesModule } from '../voices/voices.module.js';
import { MediaModule } from '../media/media.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { RenderModule } from '../rendering/render.module.js';
import { ProductionEngine } from './engine.js';
import { ProductionService } from './production.service.js';
import { ResultsService } from './results.service.js';
import { AgentsAdminService } from './agents-admin.service.js';
import { ProductionWorker } from './production.worker.js';
import { AdminProductionController, ProductionController, ResultsController } from './production.controller.js';

@Module({
  imports: [LicensesModule, AiConnectionsModule, VoicesModule, MediaModule, ProjectsModule, RenderModule],
  controllers: [ProductionController, ResultsController, AdminProductionController],
  providers: [ProductionEngine, ProductionService, ResultsService, AgentsAdminService, ProductionWorker],
  exports: [ProductionService, ResultsService],
})
export class ProductionModule {}
