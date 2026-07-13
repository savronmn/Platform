import Hero from '@/components/home/Hero';
import About from '@/components/home/About';
import Services from '@/components/home/Services';
import LeadGen from '@/components/home/LeadGen';
import {
    SHOP_CONTACT_EMAIL,
    SHOP_MAPS_URL,
    SHOP_NAME,
    SHOP_SOCIAL_LINKS,
} from '@/lib/shop';

const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BarberShop',
    name: SHOP_NAME,
    url: 'https://savronmn.com',
    email: SHOP_CONTACT_EMAIL,
    address: {
        '@type': 'PostalAddress',
        streetAddress: '250 N Third Avenue',
        addressLocality: 'Minneapolis',
        addressRegion: 'MN',
        postalCode: '55401',
        addressCountry: 'US',
    },
    sameAs: [
        SHOP_SOCIAL_LINKS.instagram,
        SHOP_SOCIAL_LINKS.facebook,
        SHOP_SOCIAL_LINKS.tiktok,
    ],
    hasMap: SHOP_MAPS_URL,
};

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col bg-savron-black">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
            />
            <Hero />
            <About />
            <Services />
            <LeadGen />
        </main>
    );
}
