/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
    }
    return config
  },
  // Custom property for allowed development origins
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev'],
}

export default nextConfig
