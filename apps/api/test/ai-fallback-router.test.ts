import { describe, expect, it, vi } from 'vitest';
import { AiConnectionsService, isRateLimitError } from '../src/modules/ai-connections/ai-connections.service.js';

describe('AiConnectionsService Auto-Fallback Router', () => {
  it('detects 429 and quota/rate-limit error strings', () => {
    expect(isRateLimitError(429, 'Too many requests')).toBe(true);
    expect(isRateLimitError(500, 'rate_limit_exceeded')).toBe(true);
    expect(isRateLimitError(400, 'RESOURCE_EXHAUSTED')).toBe(true);
    expect(isRateLimitError(400, 'invalid json')).toBe(false);
  });

  it('orders connections by priority, sets 10m cooldown on 429, notifies user, and fails over to Gemini', async () => {
    const updateSetSpy = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const fakeDb = {
      update: vi.fn().mockReturnValue({ set: updateSetSpy }),
      insert: vi.fn().mockReturnValue({ values: insertValuesSpy }),
    } as any;

    const fakeAnthropic = {
      messages: vi.fn().mockResolvedValue({ ok: false, status: 429, error: 'Rate limit reached', errorType: 'rate_limit_error' }),
      pickModel: vi.fn().mockReturnValue('claude-3-7-sonnet-20250219'),
    } as any;

    const fakeMulti = {
      messages: vi.fn().mockResolvedValue({ ok: true, text: '{"ok":true}', sources: [], usage: {}, stopReason: 'STOP', model: 'gemini-2.5-flash' }),
      pickModel: vi.fn().mockReturnValue('gemini-2.5-flash'),
    } as any;

    const fakeNotifications = { notify: vi.fn().mockResolvedValue({}) } as any;

    const svc = new AiConnectionsService(
      fakeDb,
      {} as any,
      fakeAnthropic,
      fakeMulti,
      {} as any,
      { log: vi.fn() } as any,
      {} as any,
      fakeNotifications,
    );

    const claudeConn = {
      id: 'conn-claude',
      userId: 'u-1',
      provider: 'anthropic',
      method: 'API_KEY',
      status: 'CONNECTED',
      credentialRef: 'sec-1',
      capabilities: { priority: 1, active: true, defaultModel: 'claude-sonnet-4-5-20250929', label: 'Claude Utama' },
    } as any;
    const geminiConn = {
      id: 'conn-gemini',
      userId: 'u-1',
      provider: 'gemini',
      method: 'API_KEY',
      status: 'CONNECTED',
      credentialRef: 'sec-2',
      capabilities: { priority: 2, active: true, defaultModel: 'gemini-2.5-flash', label: 'Gemini Cadangan' },
    } as any;

    vi.spyOn(svc, 'resolveOrderedConnections').mockResolvedValue([claudeConn, geminiConn]);
    vi.spyOn(svc as any, 'decryptFor').mockImplementation(async (_u: unknown, c: any) => (c.id === 'conn-claude' ? 'sk-ant-key' : 'AIza-key'));

    const res = await svc.completeWithFallback('u-1', {
      system: 'test',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 100,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provider).toBe('gemini');
      expect(res.text).toBe('{"ok":true}');
    }
    expect(fakeAnthropic.messages).toHaveBeenCalledTimes(1);
    expect(fakeMulti.messages).toHaveBeenCalledTimes(1);
    // Cooldown persisted on Claude connection
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: expect.objectContaining({ cooldownUntil: expect.any(String) }),
      }),
    );
    // Real-time notification emitted
    expect(fakeNotifications.notify).toHaveBeenCalledWith(
      'u-1',
      'ai.provider_switched',
      expect.objectContaining({ fromProvider: 'Claude Utama', toProvider: 'Gemini Cadangan' }),
    );
  });

  it('skips connections currently in cooldown and uses next available priority directly', async () => {
    const fakeAnthropic = { messages: vi.fn() } as any;
    const fakeMulti = {
      messages: vi.fn().mockResolvedValue({ ok: true, text: 'from-openai', sources: [], model: 'gpt-4o-mini' }),
      pickModel: vi.fn().mockReturnValue('gpt-4o-mini'),
    } as any;

    const svc = new AiConnectionsService({} as any, {} as any, fakeAnthropic, fakeMulti, {} as any, {} as any, {} as any, { notify: vi.fn() } as any);

    const cooledClaude = {
      id: 'c1',
      userId: 'u-1',
      provider: 'anthropic',
      method: 'API_KEY',
      status: 'CONNECTED',
      credentialRef: 's1',
      capabilities: { priority: 1, active: true, cooldownUntil: new Date(Date.now() + 300_000).toISOString() },
    } as any;
    const openAi = {
      id: 'c2',
      userId: 'u-1',
      provider: 'openai',
      method: 'API_KEY',
      status: 'CONNECTED',
      credentialRef: 's2',
      capabilities: { priority: 2, active: true, defaultModel: 'gpt-4o-mini' },
    } as any;

    vi.spyOn(svc, 'resolveOrderedConnections').mockResolvedValue([cooledClaude, openAi]);
    vi.spyOn(svc as any, 'decryptFor').mockResolvedValue('sk-openai-key');

    const res = await svc.completeWithFallback('u-1', {
      system: 'sys',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 50,
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.provider).toBe('openai');
    expect(fakeAnthropic.messages).not.toHaveBeenCalled();
    expect(fakeMulti.messages).toHaveBeenCalledTimes(1);
  });
});
