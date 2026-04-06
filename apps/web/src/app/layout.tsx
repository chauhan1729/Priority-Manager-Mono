import type { Metadata } from "next";

import { AuthProvider } from "@/components/providers/AuthProvider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Priority Manager",
    template: "%s | Priority Manager",
  },
  description: "Your personal connected planner",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
