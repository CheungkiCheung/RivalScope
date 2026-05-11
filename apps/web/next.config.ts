import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@rivalscope/agents",
    "@rivalscope/core",
    "@rivalscope/db"
  ]
};

export default nextConfig;
