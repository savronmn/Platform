import EmbeddedBookingSection from '@/components/booking/EmbeddedBookingSection';

export default function EPassLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-screen bg-savron-black overflow-hidden flex flex-col">
            <div
                className="pointer-events-none absolute inset-0 savron-grid-bg opacity-40"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute top-[-20%] left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-savron-blue/20 blur-[120px] animate-epass-glow"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[280px] w-[280px] rounded-full bg-savron-cream/5 blur-[100px]"
                aria-hidden
            />

            <div className="relative z-10 w-full flex flex-col flex-1">
                <div className="flex justify-center px-4 py-12">
                    {children}
                </div>
                <EmbeddedBookingSection />
            </div>
        </div>
    );
}
