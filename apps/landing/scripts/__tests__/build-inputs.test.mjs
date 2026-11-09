import { describe, expect, it } from 'vitest';
import { buildEnvironment, publicInputs, publicInputDigest, PUBLIC_DEFAULTS } from '../build-inputs.mjs';

describe('production build input boundary', () => {
  it('drops runtime credentials and unknown public variables before child imports', () => {
    const env = buildEnvironment({ PATH: '/tools', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-fixture', UPSTASH_REDIS_REST_TOKEN: 'synthetic-fixture', CLOUDFLARE_API_TOKEN: 'synthetic-fixture', NEXT_PUBLIC_UNKNOWN: 'synthetic-fixture', NODE_OPTIONS: '--require=unsafe', NEXT_PUBLIC_SUPPORT_EMAIL: 'contact@example.invalid' });
    expect(Object.keys(env).sort()).toEqual(['PATH', 'NODE_ENV', ...Object.keys(PUBLIC_DEFAULTS)].sort());
    expect(env.NEXT_PUBLIC_SUPPORT_EMAIL).toBe('contact@example.invalid');
  });
  it.each(['https://chesscito.com', 'https://www.chesscito.com/', 'https://candidate.workers.dev', ''])('rejects a noncanonical production origin', (value) => {
    expect(() => publicInputs({ NEXT_PUBLIC_APP_URL: value })).toThrow('approved production origin');
  });
  it.each(['http://learn.example', 'https://learn.example/hub', 'https://user:password@learn.example', ''])('rejects malformed product origins without logging their contents', (value) => {
    expect(() => publicInputs({ NEXT_PUBLIC_LEARN_URL: value })).toThrow(/NEXT_PUBLIC_LEARN_URL must be an HTTPS origin/);
  });
  it('defaults to approved product origins and paused sales', () => {
    expect(publicInputs({})).toEqual(PUBLIC_DEFAULTS);
  });
  it('fingerprints public changes without storing contact values', () => {
    expect(publicInputDigest({ NEXT_PUBLIC_SUPPORT_EMAIL: 'contact@example.invalid' })).not.toEqual(publicInputDigest({}));
  });
});
