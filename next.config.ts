import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Importante para este projeto em monorepo:
   * - Define explicitamente o root do Turbopack como `dashboard-analytics`
   *   para evitar ele usar o `package-lock.json` da pasta pai.
   */
  turbopack: {
    root: __dirname,
  },
  reactCompiler: true,
};

export default nextConfig;
