import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
  serverExternalPackages: ['@lucid-evolution/lucid', '@anastasia-labs/cardano-multiplatform-lib-nodejs'],
};

export default nextConfig;