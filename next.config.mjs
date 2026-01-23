/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL', // Allow iframe embedding from any origin
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *;", // Allow embedding from any origin
          },
        ],
      },
    ];
  },
};

export default nextConfig;
