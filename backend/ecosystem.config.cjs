// PM2 config for Linux VPS / Windows VM deployments without Docker.
// Usage: npm run build && pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'comeback-os-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
    },
  ],
};
