import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 1. Strict Mode (Recommended for catching bugs)
  reactStrictMode: true,

  // 2. Standalone output for Docker deployments
  // Creates a self-contained Node.js server in .next/standalone
  output: "standalone",

  // 3. Image Optimization Domains
  // Allows Next/Image to load profile pics from external providers
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google Auth Profile Pics
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // GitHub Profile Pics
      },
      {
        protocol: "https",
        hostname: "media.licdn.com", // LinkedIn Profile Pics
      },
    ],
  },

  // 4. Development Proxy (Rewrites)
  // This directs any call starting with /api/python/ to your FastAPI server
  // Usage in frontend: fetch('/api/python/resume/rewrite') -> goes to localhost:8000
  // NOTE: WebSocket connections (ws://) bypass rewrites — the frontend connects directly
  //       to the FastAPI WS server using NEXT_PUBLIC_WS_URL env variable.
  //
  // In Docker Compose, BACKEND_INTERNAL_URL is set to http://backend:8000
  // In local dev, it defaults to http://127.0.0.1:8000
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/python/:path*",
        destination: `${backendUrl}/api/v1/:path*`, // Proxy to FastAPI
      },
    ];
  },
};

export default nextConfig;