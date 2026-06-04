"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const navLinks = [
    { href: '/#about', label: 'About' },
    { href: '/#services', label: 'Services' },
    { href: '/blog', label: 'Journal' },
    { href: '/portal', label: 'Join Team' },
];

const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
            scrolled
                ? "bg-savron-black/80 backdrop-blur-xl border-b border-white/[0.04]"
                : "bg-gradient-to-b from-black/60 to-transparent border-b border-transparent"
        )}>
            <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 h-20 flex items-center justify-between">

                {/* Logo */}
                <Link href="/" className="relative w-28 h-7 md:w-36 md:h-9 opacity-90 hover:opacity-100 transition-opacity duration-300">
                    <Image
                        src="/logo.png"
                        alt="SAVRON"
                        fill
                        className="object-contain object-left"
                        priority
                    />
                </Link>

                {/* Right side actions */}
                <div className="flex items-center gap-4">
                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-10 mr-4">
                        {navLinks.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className="relative text-[11px] uppercase tracking-[0.2em] text-savron-silver hover:text-white transition-colors duration-300 group"
                            >
                                {label}
                                <span className="absolute -bottom-1 left-0 w-0 h-px bg-savron-gold group-hover:w-full transition-all duration-500" />
                            </Link>
                        ))}
                    </nav>

                    {/* CTA — scissors silhouette */}
                    <Link
                        href="/booking"
                        aria-label="Book appointment"
                        className="group flex items-center justify-center w-10 h-10 rounded-full border border-white/20 hover:border-white/50 text-white/70 hover:text-white transition-all duration-300 hover:bg-white/5"
                    >
                        <Scissors className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                    </Link>

                    {/* Mobile menu toggle */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 text-savron-silver hover:text-white transition-colors focus:outline-none"
                        aria-label="Toggle Menu"
                    >
                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Dropdown */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="md:hidden overflow-hidden bg-savron-black/95 border-b border-white/[0.04]"
                    >
                        <div className="flex flex-col px-6 py-6 gap-2">
                            {navLinks.map(({ href, label }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="text-xs uppercase tracking-[0.2em] text-savron-silver hover:text-white py-4 transition-colors duration-300 border-b border-white/[0.04] last:border-0"
                                >
                                    {label}
                                </Link>
                            ))}
                            <div className="pt-5 border-t border-white/[0.05] mt-2">
                                <Link
                                    href="/booking"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center justify-center gap-2 w-full py-3 border border-white/20 text-white/80 hover:text-white hover:border-white/40 text-[11px] uppercase tracking-widest transition-all rounded-savron"
                                >
                                    <Scissors className="w-3.5 h-3.5" /> Book Appointment
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Header;
