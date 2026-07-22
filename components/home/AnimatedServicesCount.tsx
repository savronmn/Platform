'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { formatServicesPerformedCount, SERVICES_PERFORMED_BASE } from '@/lib/services-performed';

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

type AnimatedServicesCountProps = {
    value: number;
    loading: boolean;
};

/** Count-up stat: creeps upward while loading, then settles on the live total. */
export default function AnimatedServicesCount({ value, loading }: AnimatedServicesCountProps) {
    const [display, setDisplay] = useState(SERVICES_PERFORMED_BASE);
    const displayRef = useRef(SERVICES_PERFORMED_BASE);
    const rafRef = useRef<number>();
    const creepRef = useRef<ReturnType<typeof setInterval>>();

    useEffect(() => {
        displayRef.current = display;
    }, [display]);

    useEffect(() => {
        if (loading) {
            let current = displayRef.current;
            creepRef.current = setInterval(() => {
                current += Math.floor(Math.random() * 2) + 1;
                displayRef.current = current;
                setDisplay(current);
            }, 90);

            return () => {
                if (creepRef.current) clearInterval(creepRef.current);
            };
        }

        if (creepRef.current) clearInterval(creepRef.current);

        const from = displayRef.current;
        const to = value;
        const duration = 1400;
        const startTime = performance.now();

        cancelAnimationFrame(rafRef.current!);

        function tick(now: number) {
            const t = Math.min(1, (now - startTime) / duration);
            const next = Math.round(from + (to - from) * easeOutCubic(t));
            displayRef.current = next;
            setDisplay(next);
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            }
        }

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current!);
        };
    }, [value, loading]);

    return (
        <motion.span
            key={loading ? 'loading' : value}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 1, scale: loading ? 1 : [1, 1.04, 1] }}
            transition={{ duration: loading ? 0.3 : 0.45 }}
            style={{ fontVariantNumeric: 'tabular-nums', display: 'inline-block' }}
        >
            {formatServicesPerformedCount(display)}
        </motion.span>
    );
}
