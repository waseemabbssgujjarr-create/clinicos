/**
 * ecosystem.config.js — PM2 config (optional, for reference / local PM2 use)
 *
 * On cPanel, Phusion Passenger manages the process and injects PORT via the
 * environment — do NOT hardcode PORT here or Passenger's socket will be ignored.
 *
 * Local dev usage (optional):
 *   cd apps/api && npx pm2 start ecosystem.config.js --env development
 */
module.exports = {
  apps: [{
    name: 'clinicos-api',
    script: './dist/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001,   // only used when running under PM2 locally, NOT on cPanel
    },
    env_production: {
      NODE_ENV: 'production',
      // PORT is intentionally omitted here.
      // On cPanel, Phusion Passenger sets PORT to a Unix socket path.
      // app.ts reads process.env.PORT and handles both numeric and socket paths.
    },
    error_file: './logs/pm2-error.log',
    out_file:   './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
