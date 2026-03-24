/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "**.mypinata.cloud",
      },
      {
        protocol: "https",
        hostname: "**.ipfs.dweb.link",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        "pino-pretty": false,
        "@react-native-async-storage/async-storage": false,
      };
    }

    if (isServer) {
      config.externals.push({
        "pino-pretty": "commonjs pino-pretty",
        lokijs: "commonjs lokijs",
        encoding: "commonjs encoding",
        "@telegram-apps/bridge": "commonjs @telegram-apps/bridge",
      });
    }

    return config;
  },
};

export default nextConfig;
