import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

/** Comma-separated CORS_ORIGIN values, plus local mobile/dev defaults. */
export function corsOrigins(): string[] {
  const fromEnv = config.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...fromEnv, 'http://localhost:5173', 'http://localhost:8081', 'http://localhost:19006'])];
}
