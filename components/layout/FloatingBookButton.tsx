"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar } from 'lucide-react';

export default function FloatingBookButton() {
    const pathname = usePathname();

    // Hide on booking pages (would be redundant) and dashboard routes
    const hidden =
        pathname.startsWith('/booking') ||
        pathname.startsWith('/book/') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/barber') ||
        pathname.startsWith('/host') ||
        pathname.startsWith('/membership');

    if (hidden) return null;

    return (
        <Link
            href="/booking"
            aria-label="Book an appointment"
            className="fixed bottom-6 right-6 z-50 md:hidden flex items-center gap-2 px-5 py-4 rounded-full glass-panel-strong glow-green text-white font-heading uppercase tracking-[0.18em] text-[11px] active:scale-95 transition-transform"
        >
            <Calendar className="w-4 h-4" />
            Book
        </Link>
    );
}
