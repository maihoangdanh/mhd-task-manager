import type { Metadata } from "next";
import { Geist, Geist_Mono, Patrick_Hand } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Nav from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Font viết tay cho ghi chú sticky-note (hỗ trợ dấu tiếng Việt).
const patrickHand = Patrick_Hand({
  weight: "400",
  variable: "--font-caveat",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Quản lý công việc và lịch trình cá nhân",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${patrickHand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Nav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
