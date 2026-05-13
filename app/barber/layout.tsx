"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Calendar, LayoutDashboard, LogOut, Link2, UserCircle, Send } from 'lucide-react';

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

    if (pathname === '/barber/login') {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/barber/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-savron-black flex">
            <aside className="w-64 bg-savron-grey border-r border-white/5 flex flex-col fixed h-full z-40">
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

            <main className="flex-1 ml-64 p-8 md:p-12">
                {children}
            </main>
        </div>
    );
}
