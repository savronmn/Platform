"use client";

import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';

/** Gentle smooth scroll for admin dashboard routes (page-level). */
export default function AdminSmoothScroll({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        if (isTouchDevice) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const lenis = new Lenis({
            duration: 1.6,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.65,
            autoRaf: true,
        });

        return () => {
            lenis.destroy();
        };
    }, []);

    return <>{children}</>;
}
