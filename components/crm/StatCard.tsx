"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
    label: string;
    value: string | number;
    change?: string;
    icon?: React.ReactNode;
    sub?: React.ReactNode;
    alert?: boolean;
    className?: string;
    onClick?: () => void;
}

const motionProps = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 },
};

export default function StatCard({ label, value, change, icon, sub, alert, className, onClick }: StatCardProps) {
    const content = (
        <>
            <div className="flex items-center justify-between">
                <span className="text-savron-silver/70 text-[11px] uppercase tracking-widest font-medium">{label}</span>
                {icon && <span className={cn("text-savron-silver/70", alert && "text-red-400/80")}>{icon}</span>}
            </div>
            <div className="flex items-end gap-3">
                <span className={cn("text-4xl font-heading tracking-wider", alert && value !== 0 ? "text-red-400" : "text-white")}>{value}</span>
                {change && (
                    <span className={cn(
                        "text-xs uppercase tracking-wider mb-1.5",
                        change.startsWith('+') ? "text-savron-blue-light" : "text-red-400"
                    )}>
                        {change}
                    </span>
                )}
            </div>
            {sub && <div className="text-savron-silver/60 text-[11px] uppercase tracking-wider -mt-1 leading-relaxed">{sub}</div>}
            {onClick && (
                <span className="text-[10px] uppercase tracking-widest text-savron-silver/40 group-hover:text-accent-blue transition-colors">
                    View details →
                </span>
            )}
        </>
    );

    const classNames = cn(
        "card-savron flex flex-col gap-4 text-left w-full",
        alert && "border-red-500/20 bg-red-500/5",
        onClick && "cursor-pointer hover:border-savron-green/25 hover:bg-white/[0.04] transition-all group",
        className
    );

    if (onClick) {
        return (
            <motion.button
                type="button"
                onClick={onClick}
                {...motionProps}
                className={classNames}
            >
                {content}
            </motion.button>
        );
    }

    return (
        <motion.div {...motionProps} className={classNames}>
            {content}
        </motion.div>
    );
}
