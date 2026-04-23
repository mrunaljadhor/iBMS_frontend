module.exports = {
  apps: [
    {
      name: 'trinity-dashboard',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      env: {
        NODE_ENV: 'production',
        PORT: '3001'
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000
    }
  ]
};
