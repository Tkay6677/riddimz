import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { AppProvider } from '@/providers/AppProvider';
import { WalletContextProvider } from '@/components/providers/wallet-provider';
import SupabaseProvider from '@/lib/supabase-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Riddimz - Web3 Karaoke Platform',
  description: 'A decentralized karaoke platform powered by blockchain technology',
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('RootLayout rendered');
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SupabaseProvider>
            <AppProvider>
          <WalletContextProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              <Sidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto py-2">
                  {children}
                </main>
              </div>
            </div>
            <Toaster />
          </WalletContextProvider>
            </AppProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}