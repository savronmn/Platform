"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Calendar, LogOut, Link2, Menu, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BarberSlugLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const slug = params.slug as string;
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const isAdminPreview = searchParams.get('adminPreview') === '1';

    if (pathname.endsWith('/login')) {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push(`/barber/${slug}/login`);
        router.refresh();
    };

    const navItems = [
        { label: 'My Calendar', href: `/barber/${slug}/calendar`, icon: Calendar },
    ];

    return (
        <div className="min-h-screen bg-savron-black flex flex-col lg:flex-row">
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-savron-grey border-b border-white/5 flex items-center justify-between px-6 z-30">
                <Link href={`/barber/${slug}/calendar`} className="relative w-24 h-6 block">
                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                </Link>
                <button
                    onClick={() => setIsDrawerOpen(true)}
                    className="p-2 text-savron-silver hover:text-white transition-colors"
                    aria-label="Open Menu"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </header>

            <aside className="hidden lg:flex w-56 bg-savron-grey border-r border-white/5 flex-col fixed h-full z-40">
                <div className="p-6 border-b border-white/5">
                    <Link href={`/barber/${slug}/calendar`} className="relative w-28 h-7 block">
                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                    </Link>
                    <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest mt-2">Barber Calendar</p>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1">
                    {navItems.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider transition-all",
                                    isActive
                                        ? "bg-savron-green border border-savron-green-light/20 text-white"
                                        : "text-savron-silver hover:text-white hover:bg-white/5 border border-transparent",
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                    <a
                        href={`/book/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-white hover:bg-white/5 border border-transparent transition-all"
                    >
                        <Link2 className="w-4 h-4" />
                        Booking Page
                    </a>
                </nav>

                <div className="p-3 border-t border-white/5">
                    {!isAdminPreview && (
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    )}
                </div>
            </aside>

            <AnimatePresence>
                {isDrawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDrawerOpen(false)}
                            className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'tween', duration: 0.25 }}
                            className="lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-savron-grey border-r border-white/5 z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <Link href={`/barber/${slug}/calendar`} onClick={() => setIsDrawerOpen(false)} className="relative w-24 h-6 block">
                                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" />
                                </Link>
                                <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-savron-silver hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <nav className="flex-1 py-6 px-3 space-y-1">
                                {navItems.map(item => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsDrawerOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider transition-all",
                                            pathname === item.href
                                                ? "bg-savron-green border border-savron-green-light/20 text-white"
                                                : "text-savron-silver hover:text-white hover:bg-white/5",
                                        )}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                            <div className="p-3 border-t border-white/5">
                                {!isAdminPreview && (
                                    <button
                                        onClick={() => { setIsDrawerOpen(false); handleLogout(); }}
                                        className="flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-red-400 w-full"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sign Out
                                    </button>
                                )}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 lg:ml-56 pt-20 lg:pt-8 p-4 sm:p-6 lg:p-8">
                <div className="w-full max-w-6xl mx-auto space-y-4">
                    {isAdminPreview && (
                        <div className="rounded-savron border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                            <Eye className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-amber-100 text-sm font-medium">Admin preview</p>
                                <p className="text-amber-100/70 text-xs">View-only mode. Booking actions are disabled.</p>
                            </div>
                        </div>
                    )}
                    {children}
                </div>
            </main>
        </div>
    );
}
