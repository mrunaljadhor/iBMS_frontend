/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Suppress hydration warnings
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  
  // Optimize images
  images: {
    unoptimized: true,
  },
  
  // Rewrites for API
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    // Skip proxy rewrite when no backend URL is configured.
    if (!apiUrl) {
      return [];
    }

    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
