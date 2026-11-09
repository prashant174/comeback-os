import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      MONGO_URI: process.env.MONGO_URI_TEST ?? 'mongodb://127.0.0.1:27017/comeback_os_test',
      JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0123',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-0123',
      ALLOW_REGISTRATION: 'true',
    },
  },
});
