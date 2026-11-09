import { createHash } from 'node:crypto';

export const PRODUCTION_ORIGIN = 'https://www.chesscito.com';
export const WORKER_NAME = 'chesscito-www-vinext-poc';
export const PUBLIC_DEFAULTS = Object.freeze({
  NEXT_PUBLIC_APP_URL: PRODUCTION_ORIGIN,
  NEXT_PUBLIC_LEARN_URL: 'https://learn.chesscito.com',
  NEXT_PUBLIC_PLAY_URL: 'https://play.chesscito.com',
  NEXT_PUBLIC_LEGAL_URL: 'https://learn.chesscito.com',
  NEXT_PUBLIC_SUPPORT_EMAIL: '',
  NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED: '',
});

export function publicInputs(source = process.env) {
  const result = Object.fromEntries(Object.entries(PUBLIC_DEFAULTS).map(([key, fallback]) => [key, source[key] ?? fallback]));
  if (result.NEXT_PUBLIC_APP_URL !== PRODUCTION_ORIGIN) throw new Error('NEXT_PUBLIC_APP_URL must equal the approved production origin');
  for (const key of ['NEXT_PUBLIC_LEARN_URL', 'NEXT_PUBLIC_PLAY_URL', 'NEXT_PUBLIC_LEGAL_URL']) {
    let url;
    try { url = new URL(result[key]); } catch { throw new Error(`${key} must be an HTTPS origin`); }
    if (url.protocol !== 'https:' || url.origin !== result[key] || url.username || url.password) throw new Error(`${key} must be an HTTPS origin without a path`);
  }
  if (!['', 'true', 'false'].includes(result.NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED)) throw new Error('NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED must be empty, true or false');
  const email = result.NEXT_PUBLIC_SUPPORT_EMAIL;
  if (email && !/^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/.test(email)) throw new Error('NEXT_PUBLIC_SUPPORT_EMAIL must be a plain email address');
  return result;
}

export function buildEnvironment(source = process.env) {
  // Infrastructure needed by Node/native tools only. No credentials, runtime app
  // bindings, arbitrary NEXT_PUBLIC_*, NODE_OPTIONS, proxy credentials or dotenv.
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'CI']) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  return { ...env, ...publicInputs(source), NODE_ENV: 'production' };
}

export function publicInputDigest(source = process.env) {
  return createHash('sha256').update(JSON.stringify(publicInputs(source))).digest('hex');
}
