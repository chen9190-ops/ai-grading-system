import path from "node:path";
import type { NextConfig } from "next";

const deploymentId = process.env.NEXT_DEPLOYMENT_ID;

const nextConfig: NextConfig = {
  ...(deploymentId
    ? {
        deploymentId,
        generateBuildId: async () => deploymentId,
      }
    : {}),
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
