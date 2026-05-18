/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Full cross-origin isolation → multi-threaded Stockfish WASM works.
          // Firebase auth uses signInWithRedirect (not popup) so isolation is fine.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // `credentialless` still enables crossOriginIsolated (→ SAB + multi-thread SF)
          // but lets Firebase auth iframes (accounts.google.com) load without needing
          // CORP headers we can't set on Google's origin.
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
      {
        source: '/sf/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/cg/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;
