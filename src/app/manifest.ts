import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'سامانه ارزیابی جلسات مشاوره تحصیلی',
    short_name: 'ارزیابی مشاوره',
    description: 'ارزیابی کیفیت جلسات مشاوره حضوری دانش‌آموزان و داوطلبان',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'fa',
    background_color: '#F2F7FC',
    theme_color: '#142B4A',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
