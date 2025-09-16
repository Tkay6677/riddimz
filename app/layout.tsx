import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import AppShell from '@/components/layout/app-shell';
import { AppProvider } from '@/providers/AppProvider';
import { WalletContextProvider } from '@/components/providers/wallet-provider';
import SupabaseProvider from '@/lib/supabase-context';
import { GlobalMusicPlayer } from '@/components/GlobalMusicPlayer';

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
            <AppShell>
              {children}
            </AppShell>
            <GlobalMusicPlayer />
            <Toaster />
          </WalletContextProvider>
            </AppProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}