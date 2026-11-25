import { Module } from '@nestjs/common';
import { AiConnectionsController } from './ai-connections.controller.js';
import { AiConnectionsService } from './ai-connections.service.js';
import { AnthropicAdapter } from './anthropic.adapter.js';
import { MultiProviderAdapter } from './multi-provider.adapter.js';
import { OAuthPkceService } from './oauth-pkce.service.js';

@Module({
  controllers: [AiConnectionsController],
  providers: [AiConnectionsService, AnthropicAdapter, MultiProviderAdapter, OAuthPkceService],
  exports: [AiConnectionsService, AnthropicAdapter, MultiProviderAdapter],
})
export class AiConnectionsModule {}
