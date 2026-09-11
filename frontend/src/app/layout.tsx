import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

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
      <body className="bg-canvas text-ink h-screen overflow-hidden flex antialiased selection:bg-primary selection:text-white">
        <AuthProvider>
          <ToastProvider>
            <Sidebar />
            <main className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col">
              {children}
            </main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
