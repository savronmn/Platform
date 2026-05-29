"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Calendar, LayoutDashboard, LogOut, Link2, UserCircle, Send, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
    { label: 'My Schedule', href: '/barber', icon: LayoutDashboard },
    { label: 'Calendar', href: '/barber/calendar', icon: Calendar },
    { label: 'My Profile', href: '/barber/profile', icon: UserCircle },
    { label: 'Request Change', href: '/barber/requests', icon: Send },
    { label: 'My Page', href: '/barber/share', icon: Link2 },
];

export default function BarberLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    if (pathname === '/barber/login') {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/barber/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-savron-black flex flex-col lg:flex-row">
            {/* Mobile Top Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-savron-grey border-b border-white/5 flex items-center justify-between px-6 z-30">
                <Link href="/barber" className="relative w-24 h-6 block">
                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                </Link>
                <div className="flex items-center gap-3">
                    <span className="text-savron-green/70 text-[9px] uppercase tracking-widest font-medium">Barber OS</span>
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="p-2 text-savron-silver hover:text-white transition-colors focus:outline-none"
                        aria-label="Open Menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 bg-savron-grey border-r border-white/5 flex-col fixed h-full z-40">
                <div className="p-6 border-b border-white/5">
                    <Link href="/barber" className="relative w-28 h-7 block">
                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                    </Link>
                    <p className="text-savron-green/70 text-[10px] uppercase tracking-widest mt-2">Barber Dashboard</p>
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
                                        ? "bg-savron-green/15 text-savron-green border border-savron-green/20"
                                        : "text-savron-silver hover:text-white hover:bg-white/5 border border-transparent"
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-red-400 hover:bg-red-500/5 transition-all w-full border border-transparent"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Drawer Sidebar */}
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
                                <div>
                                    <Link href="/barber" onClick={() => setIsDrawerOpen(false)} className="relative w-24 h-6 block">
                                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" />
                                    </Link>
                                    <p className="text-savron-green/70 text-[9px] uppercase tracking-widest mt-1">Barber Dashboard</p>
                                </div>
                                <button
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="p-2 text-savron-silver hover:text-white transition-colors"
                                    aria-label="Close Menu"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                                {navItems.map(item => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsDrawerOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider transition-all",
                                                isActive
                                                    ? "bg-savron-green/15 text-savron-green border border-savron-green/20"
                                                    : "text-savron-silver hover:text-white hover:bg-white/5 border border-transparent"
                                            )}
                                        >
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="p-3 border-t border-white/5">
                                <button
                                    onClick={() => {
                                        setIsDrawerOpen(false);
                                        handleLogout();
                                    }}
                                    className="flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-red-400 hover:bg-red-500/5 transition-all w-full border border-transparent"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 pt-20 lg:pt-8 p-6 md:p-12">
                {children}
            </main>
        </div>
    );
}

