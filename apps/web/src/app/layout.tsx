import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wealth Checker",
  description: "Lacak kekayaan bersih dan level kebebasan finansial Anda",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e40af",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
