import type { NextConfig } from "next";

// Set as early as possible so every Date local-time call in the server
// process uses the athlete's timezone (Vercel reserves `TZ`, defaults to UTC).
process.env.TZ = process.env.APP_TIMEZONE || "America/New_York";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "fit-file-parser"],
};

export default nextConfig;
