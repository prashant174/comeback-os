import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { startReminderJob } from './jobs/reminders.job.js';

async function main() {
  await connectDB();
  startReminderJob();
  const server = createApp().listen(env.PORT, () =>
    logger.info(`Comeback OS API on http://localhost:${env.PORT}  (docs: /api/docs)`),
  );
  const shutdown = async (sig: string) => {
    logger.info(`${sig} received, shutting down`);
    server.close(async () => { await disconnectDB(); process.exit(0); });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error('Failed to start', { error: e?.message });
  process.exit(1);
});
