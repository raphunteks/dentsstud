import { Module } from '@nestjs/common';
import { AiConnectionsController } from './ai-connections.controller.js';
import { AiConnectionsService } from './ai-connections.service.js';
import { AnthropicAdapter } from './anthropic.adapter.js';
import { OAuthPkceService } from './oauth-pkce.service.js';

@Module({
  controllers: [AiConnectionsController],
  providers: [AiConnectionsService, AnthropicAdapter, OAuthPkceService],
  exports: [AiConnectionsService, AnthropicAdapter],
})
export class AiConnectionsModule {}
