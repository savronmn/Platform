"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Users, Scissors, LayoutDashboard, LogOut, MonitorPlay, CreditCard, Mail, ClipboardList } from 'lucide-react';

const navItems = [
    { label: 'Dashboard',      href: '/admin',                icon: LayoutDashboard },
    { label: 'Host View',      href: '/host',                 icon: MonitorPlay },
    { label: 'Barbers',        href: '/admin/barbers',        icon: Scissors },
    { label: 'Clients',        href: '/admin/clients',        icon: Users },
    { label: 'Membership',     href: '/admin/membership',     icon: CreditCard },
    { label: 'Communications', href: '/admin/communications', icon: Mail },
    { label: 'Hiring',         href: '/admin/applicants',     icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-savron-black flex">
            <aside className="w-64 bg-savron-grey border-r border-white/5 flex flex-col fixed h-full z-40">
                <div className="p-6 border-b border-white/5">
                    <Link href="/admin" className="relative w-28 h-7 block">
                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" priority />
                    </Link>
                    <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest mt-2">Business OS</p>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
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
