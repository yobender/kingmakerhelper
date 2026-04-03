const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const electronBinary = require("electron");

const projectRoot = path.resolve(__dirname, "..");
const viteCli = require.resolve("vite/bin/vite.js");
const devServerUrl = "http://127.0.0.1:5173";
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const viteProcess = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "5173"], {
  cwd: projectRoot,
  stdio: "inherit",
  env,
  shell: false,
});

let electronProcess = null;
let shuttingDown = false;

viteProcess.on("exit", (code) => {
  if (!shuttingDown) {
    process.exit(code ?? 0);
  }
});

waitForServer(devServerUrl, 30000)
  .then(() => {
    if (shuttingDown) return;
    electronProcess = spawn(electronBinary, ["."], {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...env,
        VITE_DEV_SERVER_URL: devServerUrl,
      },
      shell: false,
    });

    electronProcess.on("exit", (code) => {
      shutdown(code ?? 0);
    });
  })
  .catch((error) => {
    console.error("Failed to start the Vite dev server:", error);
    shutdown(1);
  });

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    shutdown(0);
  });
});

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  if (!viteProcess.killed) {
    viteProcess.kill();
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 120);
}

function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}
