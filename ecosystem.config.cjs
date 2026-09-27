module.exports = {
  apps: [
    {
      name: 'neuroncast',
      script: 'src/server/index.js',
      // Execute with standard node
      exec_mode: 'fork',
      instances: 1,
      // Restart configurations
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 2000,
      max_restarts: 10,
      // Production variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 31982,
        HOST: '127.0.0.1'
      },
      // Logs mapping
      error_file: 'logs/production-err.log',
      out_file: 'logs/production-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Windows-friendly notes:
      // When running on Windows, PM2 might spawn node in standard command windows.
      // Make sure PM2 is installed globally: npm install pm2 -g
      // And optionally run under pm2-windows-service to persist on reboot.
    }
  ]
};
