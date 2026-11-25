import { describe, expect, it } from 'vitest';
import {
  composeCaption,
  getPlatformSpec,
  publishToPlatform,
  SOCIAL_PLATFORM_CODES,
  SOCIAL_PLATFORMS,
  validatePostForPlatform,
} from '../src/modules/social/social-platforms.js';

describe('TryPost-style Social Platforms Abstraction (10 platforms)', () => {
  it('registers all 10 required platforms with valid specs', () => {
    expect(SOCIAL_PLATFORM_CODES).toEqual([
      'tiktok',
      'instagram',
      'youtube',
      'facebook',
      'x',
      'linkedin',
      'threads',
      'pinterest',
      'bluesky',
      'mastodon',
    ]);
    for (const code of SOCIAL_PLATFORM_CODES) {
      const spec = getPlatformSpec(code);
      expect(spec).toBeTruthy();
      expect(spec?.name.length).toBeGreaterThan(0);
      expect(spec?.maxChars).toBeGreaterThanOrEqual(280);
      expect(spec?.videoSupported).toBe(true);
      expect(spec?.scopes.length).toBeGreaterThan(0);
    }
    expect(getPlatformSpec('unknown')).toBeNull();
  });

  it('composes captions with normalized hashtags and enforces per-platform char limits', () => {
    const composed = composeCaption('Edukasi kesehatan gigi harian', ['edukasigigi', '#dentsweb']);
    expect(composed).toBe('Edukasi kesehatan gigi harian\n\n#edukasigigi #dentsweb');

    expect(validatePostForPlatform('x', 'a'.repeat(280), false)).toEqual({ ok: true });
    const overX = validatePostForPlatform('x', 'a'.repeat(281), false);
    expect(overX.ok).toBe(false);

    expect(validatePostForPlatform('bluesky', 'a'.repeat(301), false).ok).toBe(false);
    expect(validatePostForPlatform('threads', 'a'.repeat(501), false).ok).toBe(false);
    expect(validatePostForPlatform('tiktok', 'Short dental reel', false).ok).toBe(false);
    expect(validatePostForPlatform('tiktok', 'Short dental reel', true)).toEqual({ ok: true });
    expect(validatePostForPlatform('instagram', 'Dental reel', true)).toEqual({ ok: true });
    expect(validatePostForPlatform('youtube', 'Dental short', true)).toEqual({ ok: true });
  });

  it('rejects publish calls cleanly when credentials or required metadata are missing', async () => {
    await expect(
      publishToPlatform({
        platform: 'x',
        caption: 'Halo DENTSWEB',
        hashtags: [],
        credentials: { accessToken: '' },
      }),
    ).rejects.toThrow(/Kredensial/i);

    await expect(
      publishToPlatform({
        platform: 'bluesky',
        caption: 'Halo Bluesky',
        hashtags: [],
        credentials: { accessToken: 'app-pass-only' },
      }),
    ).rejects.toThrow(/handle/i);

    await expect(
      publishToPlatform({
        platform: 'mastodon',
        caption: 'Halo Mastodon',
        hashtags: [],
        credentials: { accessToken: 'tok', instanceUrl: 'http://insecure.local' },
      }),
    ).rejects.toThrow(/https/i);

    expect(SOCIAL_PLATFORMS.facebook.maxChars).toBe(63206);
  });
});
