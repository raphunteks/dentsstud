import { Module } from '@nestjs/common';
import { AdminVoicesController, VoiceAccountsController, VoicesController } from './voices.controller.js';
import { VoicesService } from './voices.service.js';
import { ElevenLabsTts, FallbackTts, GeminiTts } from './tts.adapters.js';

@Module({
  controllers: [VoicesController, VoiceAccountsController, AdminVoicesController],
  providers: [VoicesService, GeminiTts, ElevenLabsTts, FallbackTts],
  exports: [VoicesService],
})
export class VoicesModule {}
