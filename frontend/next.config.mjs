/** @type {import('next').NextConfig} */
const apiHost = process.env.API_INTERNAL_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/health',
        destination: `${apiHost}/health`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiHost}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
