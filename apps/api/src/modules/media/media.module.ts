import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Global()
@Module({ controllers: [FilesController, MediaController], providers: [MediaService], exports: [MediaService] })
export class MediaModule {}
