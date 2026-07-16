import path from "node:path";
import type { NextConfig } from "next";

const deploymentId = process.env.NEXT_DEPLOYMENT_ID;
const basePath = process.env.NODE_ENV === "production"
  ? process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/ai_grading_hust_course"
  : "";

const nextConfig: NextConfig = {
  basePath,
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
