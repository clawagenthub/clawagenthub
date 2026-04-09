/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentationHook is deprecated - instrumentation.js is available by default
  experimental: {
     instrumentationHook: true,

    vite: {
      optimizeDeps: {
        // Exclude native modules that may cause Vite dep optimizer issues
        exclude: [
          // snappy native bindings
          '@napi-rs/snappy',
          '@napi-rs/snappy-linux-x64-gnu',
        ],
      },
    },
  },
}

export default nextConfig
