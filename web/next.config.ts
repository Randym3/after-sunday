import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output lets the production container run `next start`
  // without shipping node_modules (see web/Dockerfile).
  output: "standalone",
};

export default nextConfig;
