"use client";

import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SmoothScroll from '@/components/layout/SmoothScroll';
import FloatingBookButton from '@/components/layout/FloatingBookButton';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Hide Header/Footer on dashboard routes (they have their own sidebar layouts)
    const hideShell =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/barber') ||
        pathname.startsWith('/membership') ||
        pathname.startsWith('/host');

    const isEpass = pathname.startsWith('/epass');

    if (hideShell) {
        return <>{children}</>;
    }

    if (isEpass) {
        return (
            <>
                {children}
                <Footer />
            </>
        );
    }

    return (
        <SmoothScroll>
            <Header />
            {children}
            <Footer />
            <FloatingBookButton />
        </SmoothScroll>
    );
}
