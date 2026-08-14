/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.vercel-storage.com' },
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  webpack: (config) => {
    // @vladmandic/face-api uses a dynamic require() that webpack can't statically
    // analyze. It's harmless (face compute runs in the browser from /public/models),
    // but it spams "Critical dependency: require function is used..." on every
    // compile. Silence just that warning so the dev console stays readable.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@vladmandic[\\/]face-api/ },
    ]
    return config
  },
}
module.exports = nextConfig
