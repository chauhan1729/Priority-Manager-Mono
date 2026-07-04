import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pm/ui", "@pm/domain", "@pm/types", "@pm/api", "@pm/db"],
  serverExternalPackages: ["@supabase/supabase-js"],
  webpack: (config) => {
    // Import *.md files as raw strings (used to render the in-app readings).
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
