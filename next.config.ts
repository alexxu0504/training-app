import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "fit-file-parser"],
};

export default nextConfig;
