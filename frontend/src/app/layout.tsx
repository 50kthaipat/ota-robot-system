import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Cloud OTA Robot Fleet Management",
  description: "Enterprise Over-The-Air firmware deployment control plane for robotics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-ink min-h-screen flex antialiased selection:bg-primary selection:text-white">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
