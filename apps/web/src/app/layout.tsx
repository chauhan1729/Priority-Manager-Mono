import type { Metadata, Viewport } from "next";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { ServiceWorkerRegister } from "@/components/providers/ServiceWorkerRegister";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Priority Manager",
    template: "%s | Priority Manager",
  },
  description: "Your personal connected planner",
  applicationName: "Priority Manager",
  appleWebApp: {
    capable: true,
    title: "Priority Manager",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
