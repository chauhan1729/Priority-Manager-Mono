import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pm/ui", "@pm/domain", "@pm/types", "@pm/api", "@pm/db"],
  serverExternalPackages: ["@supabase/supabase-js"],
};

export default nextConfig;
