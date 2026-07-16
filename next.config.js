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
};

module.exports = nextConfig;
