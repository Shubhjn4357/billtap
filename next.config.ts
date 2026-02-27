import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/((?!auth).*)",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787"}/:path*`,
      },
      {
        source: "/admin/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787"}/admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
