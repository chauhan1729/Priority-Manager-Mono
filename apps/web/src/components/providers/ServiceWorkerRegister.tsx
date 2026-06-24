"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) in production only.
 * Skipped in development to avoid stale-asset caching while iterating.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[pwa] Service worker registration failed:", err);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
