import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Montserrat, Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import LayoutShell from '@/components/layout/LayoutShell';
import CookieConsentBanner from '@/components/layout/CookieConsentBanner';
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';

const GA_ID = 'G-HL5DCE0PK8';

const googleTagInitScript = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${GA_ID}');
`;

const montserrat = Montserrat({
    subsets: ['latin'],
    variable: '--font-montserrat',
    display: 'swap',
});

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: 'SAVRON | Luxury Barbershop Minneapolis',
        template: '%s | SAVRON',
    },
    description:
        'SAVRON is Minneapolis\'s premier luxury barbershop — precision haircuts, beard shaping, and scalp treatments for the modern gentleman. Walk-ins welcome. Book your appointment.',
    keywords: [
        'luxury barbershop Minneapolis',
        'best barber Minneapolis',
        'mens haircut Minneapolis',
        'beard trim Minneapolis',
        'skin fade Minneapolis',
        'barbershop near me Minneapolis',
        'mens grooming Minneapolis MN',
        'SAVRON barbershop',
    ],
    icons: {
        icon: [
            { url: '/icon.png', type: 'image/png' },
        ],
        apple: [
            { url: '/icon.png', type: 'image/png' },
        ],
        shortcut: '/icon.png',
    },
    openGraph: {
        title: 'SAVRON | Luxury Barbershop Minneapolis',
        description:
            'Precision cuts, beard shaping, and scalp treatments — by appointment or walk-in. Minneapolis\'s most refined barbershop experience.',
        type: 'website',
        url: 'https://savron.com',
        siteName: 'SAVRON Barbershop',
        locale: 'en_US',
        images: [
            {
                url: '/savron.png',
                width: 1200,
                height: 630,
                alt: 'SAVRON Barbershop Minneapolis',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'SAVRON | Luxury Barbershop Minneapolis',
        description:
            'Precision cuts, beard shaping, and scalp treatments — by appointment or walk-in. Minneapolis\'s most refined barbershop experience.',
        images: ['/savron.png'],
    },
    metadataBase: new URL('https://savron.com'),
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    alternates: {
        canonical: 'https://savron.com',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="scroll-smooth">
            <head>
                {/* Google tag (gtag.js) */}
                <script
                    async
                    src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                />
                <script dangerouslySetInnerHTML={{ __html: googleTagInitScript }} />
            </head>
            <body className={`${montserrat.variable} ${inter.variable} ${playfair.variable} font-sans bg-savron-black text-white antialiased`}>
                <Suspense fallback={null}>
                    <GoogleAnalytics />
                </Suspense>
                <LayoutShell>
                    {children}
                </LayoutShell>
                <CookieConsentBanner />
            </body>
        </html>
    );
}
