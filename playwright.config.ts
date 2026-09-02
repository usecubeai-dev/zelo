import { defineConfig, devices } from "@playwright/test";

/**
 * E2E da Fase 19 (Core Financeiro) — fluxos críticos do produto contra o
 * dev server local. Precisa do dev server já rodando em :3210 (o mesmo
 * usado por toda a sessão de QA manual) — não sobe um novo, porque um
 * `next dev` adicional colidiria com o preview já ativo.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  // Server Action + redirect sob dev server (Turbopack, sem build de
  // produção) mais WebKit mais devagar que Chromium podem passar dos
  // 5s padrão do `expect()` — achado real rodando o projeto `mobile`
  // (iPhone 13/WebKit), nunca em `desktop`/`tablet` (Chromium).
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3210",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
