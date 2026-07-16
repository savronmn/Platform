"use client";

import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import { cn } from '@/lib/utils';

type GestureOrientation = 'vertical' | 'horizontal' | 'both';

interface CalendarScrollAreaProps {
    children: ReactNode;
    className?: string;
    /** Tailwind max-height class for the scroll viewport */
    maxHeightClass?: string;
    /** Fill remaining flex space instead of a fixed max-height */
    fill?: boolean;
    gestureOrientation?: GestureOrientation;
}

/**
 * Scroll container for admin calendar panels.
 * Uses Lenis on desktop; native touch scrolling on mobile for reliability.
 */
export default function CalendarScrollArea({
    children,
    className,
    maxHeightClass = 'max-h-[min(72vh,920px)]',
    fill = false,
    gestureOrientation = 'both',
}: CalendarScrollAreaProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        const content = contentRef.current;
        if (!wrapper || !content) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (window.matchMedia('(pointer: coarse)').matches) return;

        const lenis = new Lenis({
            wrapper,
            content,
            duration: 1.85,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: gestureOrientation === 'horizontal' ? 'horizontal' : 'vertical',
            gestureOrientation,
            smoothWheel: true,
            wheelMultiplier: 0.5,
            touchMultiplier: 0.9,
            autoRaf: true,
        });

        return () => {
            lenis.destroy();
        };
    }, [gestureOrientation]);

    return (
        <div
            ref={wrapperRef}
            className={cn(
                'overflow-x-auto overflow-y-auto calendar-scroll-area',
                fill ? 'flex-1 min-h-0' : maxHeightClass,
                className,
            )}
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
            <div ref={contentRef}>{children}</div>
        </div>
    );
}
