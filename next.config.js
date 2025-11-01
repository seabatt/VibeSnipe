/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Optimize bundle size
  swcMinify: true,
  
  // Image optimization (if using next/image)
  images: {
    domains: [],
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'plotly.js', 'react-plotly.js'],
  },
  
  // Webpack configuration for Plotly.js
  webpack: (config, { isServer }) => {
    // Optimize Plotly.js (it's a large library)
    // Note: We're using plotly.js from package.json, not plotly.js-dist-min
    // The bundle size optimization is handled by tree-shaking
    return config;
  },
};

module.exports = nextConfig;
