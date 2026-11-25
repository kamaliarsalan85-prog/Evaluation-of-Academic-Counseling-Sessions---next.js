import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function hasValidDatabaseUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return false;
  if (trimmed.includes('[YOUR-DATABASE-PASSWORD]') || trimmed.includes('YOUR_PASSWORD')) {
    return false;
  }
  return true;
}

async function main() {
  const env = { ...process.env };
  const cwd = process.cwd();

  if (env.DATABASE_URL && !env.DIRECT_URL) {
    env.DIRECT_URL = env.DATABASE_URL;
  }

  const binDir = path.resolve(cwd, 'node_modules/.bin');
  const prismaBin = path.join(binDir, process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  const nextBin = path.join(binDir, process.platform === 'win32' ? 'next.cmd' : 'next');

  if (env.SKIP_DB_MIGRATIONS !== 'true' && hasValidDatabaseUrl(env.DATABASE_URL)) {
    if (fs.existsSync(prismaBin)) {
      console.log('[start-production] Applying Prisma database migrations...');
      try {
        await runCommand(prismaBin, ['migrate', 'deploy'], env);
      } catch (err) {
        console.error(
          '[start-production] Failed to apply database migrations:',
          err instanceof Error ? err.message : err
        );
        if (env.ALLOW_BOOT_WITHOUT_DB !== 'true') {
          process.exit(1);
        }
      }
    }
  } else {
    console.warn(
      '[start-production] Skipping automatic migrations (DATABASE_URL not configured or SKIP_DB_MIGRATIONS=true).'
    );
  }

  const port = env.PORT && String(env.PORT).trim() ? String(env.PORT).trim() : '3000';
  const host = env.HOSTNAME && String(env.HOSTNAME).trim() ? String(env.HOSTNAME).trim() : '0.0.0.0';

  console.log(`[start-production] Starting Next.js server on http://${host}:${port}`);
  const nextProc = spawn(nextBin, ['start', '-H', host, '-p', port], {
    stdio: 'inherit',
    env,
  });

  const shutdown = (signal) => {
    if (!nextProc.killed) {
      nextProc.kill(signal);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  nextProc.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('[start-production] Fatal startup error:', err);
  process.exit(1);
});
