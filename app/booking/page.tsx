"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AsapBookingFlow from '@/components/booking/AsapBookingFlow';
// import BarberChooser from '@/components/booking/BarberChooser';
// ↑ Re-enable when adding the "choose your barber" step back to /booking

function BookingPageContent() {
    const searchParams = useSearchParams();
    const preselectedService = searchParams.get('service');

    return (
        <main className="min-h-screen bg-savron-black pt-20 pb-12">
            <div className="max-w-4xl w-full mx-auto px-4 sm:px-6">
                <div className="text-center mb-8">
                    <h1 className="font-heading uppercase tracking-widest text-white text-3xl md:text-5xl mb-3">
                        Book Your Appointment
                    </h1>
                    <p className="text-savron-silver uppercase tracking-wider text-sm">
                        {preselectedService
                            ? 'Pick a time — we’ll match you with the first available barber'
                            : 'Select a service and time — we’ll find the first available barber'}
                    </p>
                </div>

                <AsapBookingFlow preselectedServiceName={preselectedService} />

                {/*
                  ── Barber chooser step (disabled — restore when ready) ──
                  <BarberChooser preselectedServiceName={preselectedService} />
                */}
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
