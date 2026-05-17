import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const port = process.env.SMOKE_TEST_PORT ?? String(3900 + (process.pid % 1000));
const baseUrl = `http://127.0.0.1:${port}`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = isWindows
      ? spawn([command, ...args].join(" "), { stdio: "inherit", shell: true })
      : spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitFor(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function failIfExited(server) {
  if (server.exitCode !== null) {
    throw new Error(`Next server exited before smoke test completed with ${server.exitCode}`);
  }
}

function stopServer(server) {
  if (server.exitCode !== null) return;
  if (isWindows) {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }
  server.kill("SIGTERM");
}

async function main() {
  console.log("Smoke: lint");
  await run(npmCmd, ["run", "lint"]);
  console.log("Smoke: typecheck");
  await run(npxCmd, ["tsc", "--noEmit", "--incremental", "false"]);
  console.log("Smoke: build");
  await run(npmCmd, ["run", "build"]);

  console.log(`Smoke: start ${baseUrl}`);
  const server = isWindows
    ? spawn(`${npmCmd} start -- -p ${port}`, { stdio: "inherit", shell: true })
    : spawn(npmCmd, ["start", "--", "-p", port], {
        stdio: "inherit",
        shell: false,
      });

  try {
    server.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`Next server exited with ${code}`);
      }
    });

    console.log("Smoke: GET /");
    const home = await waitFor(`${baseUrl}/`);
    failIfExited(server);
    const homeText = await home.text();
    if (!homeText.includes("Focus Feed")) {
      throw new Error("Home page did not include expected Focus Feed marker");
    }

    console.log("Smoke: GET /api/usage");
    const usage = await waitFor(`${baseUrl}/api/usage`);
    failIfExited(server);
    const usageJson = await usage.json();
    if (!Object.prototype.hasOwnProperty.call(usageJson, "plan")) {
      throw new Error("/api/usage response did not include plan");
    }

    console.log("Smoke: GET /api/ops/status");
    const ops = await fetch(`${baseUrl}/api/ops/status`, { cache: "no-store" });
    failIfExited(server);
    if (ops.status === 404) {
      console.log("Smoke: /api/ops/status protected");
      console.log("Smoke test passed");
      return;
    }
    if (!ops.ok) {
      throw new Error(`/api/ops/status returned ${ops.status}`);
    }
    const opsJson = await ops.json();
    if (typeof opsJson.ok !== "boolean") {
      throw new Error("/api/ops/status response did not include ok boolean");
    }

    console.log("Smoke test passed");
  } finally {
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
