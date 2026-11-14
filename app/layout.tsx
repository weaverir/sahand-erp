import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: "Sahand ERP | سیستم مدیریت یکپارچه",
  description: "سامانه مدیریت یکپارچه سهند",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}

          <Toaster
            position="top-center"
            dir="rtl"
            richColors
            closeButton
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}