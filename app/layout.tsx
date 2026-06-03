import type { Metadata } from 'next';
import { Montserrat, Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import LayoutShell from '@/components/layout/LayoutShell';

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
    openGraph: {
        title: 'SAVRON | Luxury Barbershop Minneapolis',
        description:
            'Precision cuts, beard shaping, and scalp treatments — by appointment or walk-in. Minneapolis\'s most refined barbershop experience.',
        type: 'website',
        url: 'https://savron.com',
        siteName: 'SAVRON Barbershop',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'SAVRON | Luxury Barbershop Minneapolis',
        description:
            'Precision cuts, beard shaping, and scalp treatments — by appointment or walk-in. Minneapolis\'s most refined barbershop experience.',
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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="scroll-smooth">
            <body className={`${montserrat.variable} ${inter.variable} ${playfair.variable} font-sans bg-savron-black text-white antialiased`}>
                <LayoutShell>
                    {children}
                </LayoutShell>
            </body>
        </html>
    );
}
