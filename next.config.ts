import type { NextConfig } from "next";

const resolveBackendApiUrl = () => {
  const configured = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787/api").trim();
  return configured.replace(/\/+$/, "");
};

const BACKEND_API_URL = resolveBackendApiUrl();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/admin/:path*",
        destination: `${BACKEND_API_URL}/admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
