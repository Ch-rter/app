import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The SDK ships as TypeScript source consumed directly from the workspace,
  // so Next must transpile it rather than expecting a prebuilt dist.
  transpilePackages: ['@charter/sdk'],
};

export default nextConfig;
