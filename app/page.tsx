import Hero from '@/components/home/Hero';
import InteriorPhoto from '@/components/home/InteriorPhoto';
import About from '@/components/home/About';
import Services from '@/components/home/Services';
import LeadGen from '@/components/home/LeadGen';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col bg-savron-black">
            <Hero />
            <InteriorPhoto />
            <About />
            <Services />
            <LeadGen />
        </main>
    );
}
