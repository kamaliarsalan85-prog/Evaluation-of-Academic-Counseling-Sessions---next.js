import type { Metadata, Viewport } from 'next';
import { Vazirmatn } from 'next/font/google';
import './globals.css';
import { PwaSupport } from '@/components/pwa/PwaSupport';
import { ToastProvider } from '@/components/ui/ToastProvider';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-vazirmatn',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#142B4A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

function resolveMetadataBase(): URL {
  const raw = process.env.APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // fall through to localhost
    }
  }
  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'ارزیابی جلسات مشاوره تحصیلی',
  description: 'سامانه جامع ارزیابی جلسات مشاوره حضوری و پنل مدیریت',
  openGraph: {
    title: 'ارزیابی جلسات مشاوره تحصیلی',
    description: 'سامانه جامع ارزیابی جلسات مشاوره حضوری و پنل مدیریت',
    type: 'website',
    locale: 'fa_IR',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ارزیابی مشاوره',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={vazirmatn.variable}
    >
      <body className="min-h-screen bg-[#F2F7FC] text-[#1E293B] antialiased">
        <ToastProvider>
          <PwaSupport />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
