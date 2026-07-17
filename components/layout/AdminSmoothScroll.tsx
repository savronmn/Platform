"use client";

import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';

/** Gentle smooth scroll for admin dashboard routes (page-level). */
export default function AdminSmoothScroll({ children }: { children: ReactNode }) {
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

        const html = document.documentElement;
        html.classList.add('lenis', 'lenis-smooth');

        const pauseScroll = () => lenis.stop();
        const resumeScroll = () => lenis.start();

        document.addEventListener('dragstart', pauseScroll, true);
        document.addEventListener('dragend', resumeScroll, true);
        document.addEventListener('drop', resumeScroll, true);

        return () => {
            document.removeEventListener('dragstart', pauseScroll, true);
            document.removeEventListener('dragend', resumeScroll, true);
            document.removeEventListener('drop', resumeScroll, true);
            html.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
            lenis.destroy();
        };
    }, []);

    return <>{children}</>;
}
