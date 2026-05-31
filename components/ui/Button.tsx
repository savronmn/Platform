import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none disabled:opacity-40 disabled:pointer-events-none uppercase tracking-[0.18em] font-heading rounded-savron relative overflow-hidden";

        const variants = {
            primary: "bg-savron-green/90 backdrop-blur-md text-white hover:bg-savron-green-light shadow-[0_8px_30px_rgba(18,84,112,0.35)] hover:shadow-[0_12px_40px_rgba(26,106,138,0.45)] active:scale-[0.98] border border-savron-green-light/20",
            secondary: "bg-white/95 backdrop-blur-md text-savron-black hover:bg-white shadow-[0_8px_30px_rgba(255,255,255,0.08)] active:scale-[0.98]",
            outline: "border border-white/25 text-white hover:border-white/60 hover:bg-white/[0.04] backdrop-blur-md active:scale-[0.98]",
            ghost: "text-savron-silver hover:text-white hover:bg-white/5 active:scale-[0.98]",
        };

        // Larger, tactile sizing — luxury feel
        const sizes = {
            sm: "h-11 px-7 text-[11px]",
            md: "h-14 px-10 text-xs",
            lg: "h-16 px-14 text-sm",
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";

export { Button };
