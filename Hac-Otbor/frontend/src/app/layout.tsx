import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from './providers';
import Navigation from '@/components/Navigation';

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAZUM 2.0 | Rating & Activity",
  description: "Youth Activity Rating Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={spaceGrotesk.className} suppressHydrationWarning>
        <AuthProvider>
          <div className="min-h-screen border-8 border-black p-4 bg-zinc-50">
            <Navigation />
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
