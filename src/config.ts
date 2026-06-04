export interface Config {
  port: number;
  databaseUrl: string | undefined;
  dataDir: string;
  expirySweepMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL,
    dataDir: env.DATA_DIR ?? "/data",
    expirySweepMs: Number(env.EXPIRY_SWEEP_MS ?? 60_000),
  };
}
