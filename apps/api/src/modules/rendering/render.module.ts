import { Module } from '@nestjs/common';
import { LicensesModule } from '../licenses/licenses.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { StylesModule } from '../styles/styles.module.js';
import { AdminRenderController, InternalRenderController, RenderController, WorkerGuard } from './render.controller.js';
import { RenderService } from './render.service.js';

@Module({
  imports: [LicensesModule, ProjectsModule, StylesModule],
  controllers: [RenderController, InternalRenderController, AdminRenderController],
  providers: [RenderService, WorkerGuard],
  exports: [RenderService],
})
export class RenderModule {}
