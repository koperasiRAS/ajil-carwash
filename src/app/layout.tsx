import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "CarWash Manager",
  description: "Sistem Manajemen Cuci Mobil & Motor",
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen`}>
        {children}
        <Toaster
          position="top-center"
          richColors
        />
      </body>
    </html>
  );
}