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
}

export default function StatCard({ label, value, change, icon, sub, alert, className }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
                "card-savron flex flex-col gap-4",
                alert && "border-red-500/20 bg-red-500/5",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-savron-silver/70 text-[11px] uppercase tracking-widest font-medium">{label}</span>
                {icon && <span className={cn("text-savron-silver/70", alert && "text-red-400/80")}>{icon}</span>}
            </div>
            <div className="flex items-end gap-3">
                <span className={cn("text-4xl font-heading tracking-wider", alert && value !== 0 ? "text-red-400" : "text-white")}>{value}</span>
                {change && (
                    <span className={cn(
                        "text-xs uppercase tracking-wider mb-1.5",
                        change.startsWith('+') ? "text-green-400" : "text-red-400"
                    )}>
                        {change}
                    </span>
                )}
            </div>
            {sub && <p className="text-savron-silver/60 text-[11px] uppercase tracking-wider -mt-1 leading-relaxed">{sub}</p>}
        </motion.div>
    );
}
