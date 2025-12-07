import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGateClient from "./AuthGateClient";

// Font
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: "Raport Siswa",
  description: "Aplikasi input raport sederhana dengan Next.js + Firebase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthGateClient />
        {children}
      </body>
    </html>
  );
}
