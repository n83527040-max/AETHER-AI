import { generateKeyPairSync } from "node:crypto";

import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// A throwaway RSA key so the Worker can validate its configuration in tests.
// It exists only in the test process and is never used to contact GitHub.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

export default defineWorkersConfig({
  test: {
    include: ["test/worker/**/*.spec.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        // WebSocket and alarm state cannot be stacked between suites; each test
        // uses unique ticket ids, so a shared store is deterministic.
        isolatedStorage: false,
        miniflare: {
          bindings: {
            AETHER_GITHUB_CLIENT_SECRET: "test-client-secret",
            AETHER_GITHUB_APP_PRIVATE_KEY: privateKey,
          },
        },
      },
    },
  },
});
