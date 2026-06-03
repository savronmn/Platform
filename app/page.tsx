import Hero from '@/components/home/Hero';
import About from '@/components/home/About';
import Services from '@/components/home/Services';
import LeadGen from '@/components/home/LeadGen';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col bg-savron-black">
            <Hero />
            <About />
            <Services />
            <LeadGen />
        </main>
    );
}
