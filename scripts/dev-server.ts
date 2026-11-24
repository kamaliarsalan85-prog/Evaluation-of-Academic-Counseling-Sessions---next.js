import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORT = 54329;
const HOST = '127.0.0.1';

function runAsync(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  const env = { ...process.env };
  let socketServer: PGLiteSocketServer | null = null;
  let pgDb: PGlite | null = null;

  const hasExternalDb = Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0);

  if (!hasExternalDb && env.ALLOW_EMBEDDED_DEV_POSTGRES !== 'false') {
    const dataDir = path.resolve(process.cwd(), '.dev-pgdata');
    fs.mkdirSync(dataDir, { recursive: true });

    console.log('[dev-server] No external DATABASE_URL detected. Starting isolated embedded PostgreSQL (PGlite) for local development...');
    pgDb = new PGlite(dataDir);
    await pgDb.waitReady;

    socketServer = new PGLiteSocketServer({
      db: pgDb,
      port: PORT,
      host: HOST,
      maxConnections: 15,
    });
    await socketServer.start();

    const localUrl = `postgresql://postgres:postgres@${HOST}:${PORT}/postgres?sslmode=disable&connection_limit=5`;
    env.DATABASE_URL = localUrl;
    env.DIRECT_URL = localUrl;
    env.DEV_EMBEDDED_POSTGRES = 'true';

    console.log(`[dev-server] Embedded PostgreSQL listening at ${HOST}:${PORT}. Applying Prisma migrations...`);
    const prismaBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
    await runAsync(prismaBin, ['migrate', 'deploy'], env);
  } else if (hasExternalDb) {
    const dbUrl = env.DATABASE_URL || '';
    if (dbUrl.includes('[YOUR-DATABASE-PASSWORD]') || dbUrl.includes('YOUR_PASSWORD')) {
      console.warn(
        '[dev-server] WARNING: DATABASE_URL still contains a placeholder password ([YOUR-DATABASE-PASSWORD]). Replace it with your actual PostgreSQL password.'
      );
    } else {
      console.log('[dev-server] Using configured external PostgreSQL DATABASE_URL. Ensuring Prisma migrations are applied...');
      const prismaBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
      await runAsync(prismaBin, ['migrate', 'deploy'], env).catch((err) => {
        console.warn('[dev-server] Warning: prisma migrate deploy failed for external DB:', err instanceof Error ? err.message : err);
      });
    }
  } else {
    console.warn('[dev-server] WARNING: DATABASE_URL is not set and ALLOW_EMBEDDED_DEV_POSTGRES is false.');
  }

  const nextBin = path.resolve(process.cwd(), 'node_modules/.bin/next');
  const nextProc: ChildProcess = spawn(nextBin, ['dev', '-p', '3000', '-H', '0.0.0.0'], {
    stdio: 'inherit',
    env,
  });

  const shutdown = async () => {
    if (!nextProc.killed) {
      nextProc.kill('SIGTERM');
    }
    if (socketServer) {
      await socketServer.stop().catch(() => {});
    }
    if (pgDb) {
      await pgDb.close().catch(() => {});
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  nextProc.on('exit', async (code) => {
    if (socketServer) await socketServer.stop().catch(() => {});
    if (pgDb) await pgDb.close().catch(() => {});
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('[dev-server] Fatal error:', err);
  process.exit(1);
});
