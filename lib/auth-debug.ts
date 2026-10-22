// TEMPORARY DIAGNOSTIC -- delete this file and its single call site in
// lib/authz.ts once the 401 is explained.
//
// Records what the mobile client actually sends to /api/*, so a 401 can be
// told apart into its three real causes:
//   1. no Authorization header at all      (client never attached a token)
//   2. header present but unparseable      (wrong prefix / truncated string)
//   3. a well-formed JWT Clerk won't accept (expired, wrong issuer/azp/aud)
//
// Writes to the OS temp dir because the route runs in the Node runtime while
// middleware.ts runs on Edge, where fs is unavailable.
import { appendFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const LOG_FILE = join(tmpdir(), 'aurasutra-auth-debug.log');

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function logAuthDebug(stage: 'before' | 'after', header: string | null, userId: string | null) {
  let line: string;

  if (stage === 'before') {
    const parts: string[] = [`[auth-debug] Authorization header: ${header ? `present (${header.length} chars)` : 'ABSENT'}`];

    if (header) {
      const [scheme, ...rest] = header.split(' ');
      const token = rest.join(' ');
      parts.push(`  scheme="${scheme}" tokenLen=${token.length}`);
      parts.push(`  head="${token.slice(0, 24)}..."`);

      if (/^Bearer$/i.test(scheme) && token.split('.').length === 3) {
        const claims = decodeJwtPayload(token);
        if (claims) {
          const now = Math.floor(Date.now() / 1000);
          const exp = typeof claims.exp === 'number' ? claims.exp : null;
          parts.push(`  iss=${String(claims.iss)}`);
          parts.push(`  azp=${String(claims.azp)}`);
          parts.push(`  aud=${JSON.stringify(claims.aud)}`);
          parts.push(`  sub=${String(claims.sub)}`);
          parts.push(`  sid=${String(claims.sid)}`);
          parts.push(`  iat=${String(claims.iat)} nbf=${String(claims.nbf)}`);
          parts.push(`  exp=${String(exp)} (${exp === null ? 'no exp' : exp <= now ? `EXPIRED ${now - exp}s ago` : `valid for ${exp - now}s`})`);
        } else {
          parts.push('  payload: undecodable');
        }
      } else {
        parts.push('  not a well-formed "Bearer <jwt>" value');
      }
    }

    line = parts.join('\n');
  } else {
    line = `[auth-debug] auth() userId=${userId ?? 'null'}`;
  }

  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()}\n${line}\n\n`, 'utf8');
  } catch {
    // Diagnostics must never break the request.
  }
}
