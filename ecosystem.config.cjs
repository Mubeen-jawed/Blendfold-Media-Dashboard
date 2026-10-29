// pm2 process file. deploy.sh writes the chosen port to APP_PORT in .env.
const fs = require("fs");
const path = require("path");

function envValue(key, fallback) {
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    const match = text.match(new RegExp(`^${key}="?([^"\\n]*)"?`, "m"));
    return match && match[1] ? match[1] : fallback;
  } catch {
    return fallback;
  }
}

const port = envValue("APP_PORT", "3000");

module.exports = {
  apps: [
    {
      name: process.env.APP_NAME || "blendfold",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${port} -H 127.0.0.1`,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      time: true,
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
