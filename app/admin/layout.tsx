"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Users, Scissors, LayoutDashboard, LogOut, MonitorPlay, CreditCard, Mail, ClipboardList, Layers, Inbox, Menu, X, Languages, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LanguageProvider, useLanguage } from '@/lib/language-context';

function NavContent({ onClose }: { onClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const { lang, toggle, t } = useLanguage();

    const navItems = [
        { labelKey: 'nav.dashboard',      href: '/admin',                icon: LayoutDashboard },
        { labelKey: 'nav.host_view',      href: '/host',                 icon: MonitorPlay },
        { labelKey: 'nav.bookings',       href: '/admin/bookings',       icon: Calendar },
        { labelKey: 'nav.requests',       href: '/admin/requests',       icon: Inbox },
        { labelKey: 'nav.barbers',        href: '/admin/barbers',        icon: Scissors },
        { labelKey: 'nav.clients',        href: '/admin/clients',        icon: Users },
        { labelKey: 'nav.membership',     href: '/admin/membership',     icon: CreditCard },
        { labelKey: 'nav.communications', href: '/admin/communications', icon: Mail },
        { labelKey: 'nav.services',       href: '/admin/services',       icon: Layers },
        { labelKey: 'nav.hiring',         href: '/admin/applicants',     icon: ClipboardList },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
        router.refresh();
    };

    return (
        <div className="flex flex-col h-full">
            <nav className="flex-1 py-7 px-4 space-y-1.5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3.5 rounded-savron text-sm uppercase tracking-wider transition-all border",
                                isActive
                                    ? "bg-savron-green border-savron-green-light/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(18,84,112,0.25)]"
                                    : "text-savron-silver border-transparent hover:text-white hover:bg-white/[0.06] hover:border-white/[0.08]"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {t(item.labelKey)}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/[0.06] space-y-1.5">
                {/* EN / ES language toggle */}
                <button
                    onClick={toggle}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-white hover:bg-white/[0.06] transition-all w-full border border-transparent hover:border-white/[0.08] group"
                >
                    <Languages className="w-4 h-4" />
                    <span className="flex items-center gap-1.5">
                        <span className={cn("transition-colors", lang === 'en' ? "text-white" : "text-savron-silver/40")}>EN</span>
                        <span className="text-savron-silver/30">/</span>
                        <span className={cn("transition-colors", lang === 'es' ? "text-white" : "text-savron-silver/40")}>ES</span>
                    </span>
                    <span className={cn(
                        "ml-auto text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors",
                        lang === 'es'
                            ? "border-savron-green/40 text-savron-green bg-savron-green/10"
                            : "border-white/10 text-savron-silver/40"
                    )}>
                        {lang === 'en' ? 'EN' : 'ES'}
                    </span>
                </button>

                <button
                    onClick={() => { onClose?.(); handleLogout(); }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-red-400 hover:bg-red-500/5 transition-all w-full border border-transparent hover:border-red-500/10"
                >
                    <LogOut className="w-4 h-4" />
                    {t('nav.sign_out')}
                </button>
            </div>
        </div>
    );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { t } = useLanguage();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-savron-black flex flex-col lg:flex-row relative overflow-hidden">
            <div className="pointer-events-none fixed inset-0 opacity-[0.055] bg-[url('/savron.png')] bg-cover bg-center" />
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(18,84,112,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_26%)]" />
            {/* Mobile Top Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-savron-grey/85 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-6 z-30">
                <Link href="/admin" className="relative w-24 h-6 block">
                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                </Link>
                <div className="flex items-center gap-3">
                    <span className="text-savron-silver/50 text-[9px] uppercase tracking-widest font-medium">{t('nav.business_os')}</span>
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
            <aside className="hidden lg:flex w-72 glass-panel border-r border-white/[0.06] flex-col fixed h-full z-40">
                <div className="p-8 border-b border-white/[0.06]">
                    <Link href="/admin" className="relative w-28 h-7 block">
                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                    </Link>
                    <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest mt-2">{t('nav.business_os')}</p>
                    <div className="divider-silver mt-5" />
                </div>
                <NavContent />
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
                            className="lg:hidden fixed top-0 left-0 bottom-0 w-72 glass-panel border-r border-white/[0.06] z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                                <div>
                                    <Link href="/admin" onClick={() => setIsDrawerOpen(false)} className="relative w-24 h-6 block">
                                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" />
                                    </Link>
                                    <p className="text-savron-silver/50 text-[9px] uppercase tracking-widest mt-1">{t('nav.business_os')}</p>
                                </div>
                                <button
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="p-2 text-savron-silver hover:text-white transition-colors"
                                    aria-label="Close Menu"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <NavContent onClose={() => setIsDrawerOpen(false)} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="relative z-10 flex-1 lg:ml-72 pt-20 lg:pt-12 px-6 md:px-10 lg:px-12 xl:px-16 pb-10 lg:pb-14 flex flex-col">
                <div className="w-full max-w-7xl mx-auto flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <LanguageProvider>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </LanguageProvider>
    );
}
