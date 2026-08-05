import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The SDK ships as TypeScript source consumed directly from the workspace,
  // so Next must transpile it rather than expecting a prebuilt dist.
  transpilePackages: ['@charter/sdk'],
  // The SDK's ESM barrel imports with explicit `.js` specifiers (the NodeNext
  // convention) that resolve to `.ts` source on disk. Turbopack maps these
  // automatically; the webpack production build does not, so teach its resolver
  // to try TypeScript extensions when a `.js`/`.mjs` specifier has no match.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
