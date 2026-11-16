import { Module } from '@nestjs/common';
import { AdminStylesController, StylesController } from './styles.controller.js';
import { StylesService } from './styles.service.js';

@Module({ controllers: [StylesController, AdminStylesController], providers: [StylesService], exports: [StylesService] })
export class StylesModule {}
