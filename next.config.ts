import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};
export default withWorkflow(nextConfig);
