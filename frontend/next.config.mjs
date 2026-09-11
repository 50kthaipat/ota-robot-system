/** @type {import('next').NextConfig} */
const apiHost = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "https://ota-api-omxf.onrender.com" : "http://localhost:8000");

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
