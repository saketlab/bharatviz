module.exports = {
  apps: [{
    name: 'bharatviz-api',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',

    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      ALLOWED_ORIGINS: '*',
      NODE_OPTIONS: '--max-old-space-size=1200 --optimize-for-size'
    },

    max_memory_restart: '700M',
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,

    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    time: true,
    watch: false,

    kill_timeout: 30000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
