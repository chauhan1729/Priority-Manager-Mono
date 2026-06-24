import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes the site installable as a PWA.
 * Next serves this at /manifest.webmanifest and auto-links it from <head>.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Priority Manager",
    short_name: "Priority",
    description: "Your personal connected planner — daily plan, activities, projects, and more.",
    start_url: "/daily-plan",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
