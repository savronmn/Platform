"use client";

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BarberChooser from '@/components/booking/BarberChooser';
import { bookingStepPath, buildBookingStepQuery } from '@/lib/booking-step-urls';
import { gtagEvent } from '@/lib/gtag';

function BookingPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const preselectedService = searchParams.get('service');

    useEffect(() => {
        if (searchParams.get('step') === 'barber') return;
        const query = buildBookingStepQuery(searchParams, { step: 'barber' });
        router.replace(bookingStepPath(pathname, query), { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        gtagEvent('booking_step_view', { step: 'barber', flow: 'barber' });
    }, []);

    return (
        <main className="min-h-screen bg-savron-black pt-20 pb-12">
            <div className="max-w-4xl w-full mx-auto px-4 sm:px-6">
                <div className="text-center mb-8">
                    <h1 className="font-heading uppercase tracking-widest text-white text-3xl md:text-5xl mb-3">
                        Book Your Appointment
                    </h1>
                    <p className="text-savron-silver uppercase tracking-wider text-sm">
                        {preselectedService
                            ? 'Choose your barber'
                            : 'Select a barber to view their services and book'}
                    </p>
                </div>

                <BarberChooser preselectedServiceName={preselectedService} />
            </div>
        </main>
    );
}

export default function BookingPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-savron-black pt-20 pb-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </main>
        }>
            <BookingPageContent />
        </Suspense>
    );
}
