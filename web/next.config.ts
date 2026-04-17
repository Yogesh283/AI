import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Hide bottom-left Next.js dev tools (N) button in development */
  devIndicators: false,
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // /neo-api → FastAPI is handled by app/neo-api/[[...path]]/route.ts (server proxy; avoids bad redirects to 127.0.0.1 in the browser)
};

export default nextConfig;
