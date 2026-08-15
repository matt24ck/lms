import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Team crests referenced by football-data.org fixtures.
      { protocol: "https", hostname: "crests.football-data.org" },
      // Discord avatars.
      { protocol: "https", hostname: "cdn.discordapp.com" },
    ],
  },
};

export default nextConfig;
