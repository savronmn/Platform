"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scissors } from 'lucide-react';

export default function FloatingBookButton() {
    const pathname = usePathname();

    // Hide on booking pages (would be redundant) and dashboard routes
    const hidden =
        pathname.startsWith('/booking') ||
        pathname.startsWith('/book/') ||
        pathname.startsWith('/epass') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/barber') ||
        pathname.startsWith('/host') ||
        pathname.startsWith('/membership');

    if (hidden) return null;

    return (
        <Link
            href="/booking"
            aria-label="Book an appointment"
            className="fixed bottom-6 right-6 z-50 md:hidden flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/15 hover:border-white/35 active:scale-95 transition-all duration-200"
        >
            <Scissors className="w-5 h-5" />
        </Link>
    );
}
