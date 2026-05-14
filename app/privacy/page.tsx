"use client";

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-savron-black text-savron-silver py-24 px-6 md:px-12">
            <div className="max-w-3xl mx-auto space-y-12">
                <Link href="/" className="inline-flex items-center text-[10px] uppercase tracking-[0.3em] text-savron-silver/50 hover:text-white transition-colors">
                    <ChevronLeft className="w-3 h-3 mr-2" />
                    Back to Home
                </Link>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <h1 className="font-heading text-4xl md:text-5xl text-white tracking-wider uppercase">Privacy Policy</h1>
                    <p className="text-xs uppercase tracking-widest text-savron-silver/50">Last Updated: May 2026</p>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-8 font-light text-sm leading-relaxed text-savron-silver/80">
                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">1. Information We Collect</h2>
                        <p>We collect information you provide directly to us when you book an appointment, create an account, apply to be a barber, or communicate with us. This may include your name, email address, phone number, and payment information.</p>
                        <p>We also automatically collect certain information about your device and how you interact with our website, including your IP address, browser type, and pages visited.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">2. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-5 space-y-2 text-savron-silver/70">
                            <li>Process and manage your booking appointments</li>
                            <li>Send appointment confirmations and reminders</li>
                            <li>Communicate with you regarding services, promotions, or changes to our terms</li>
                            <li>Maintain and improve our website and scheduling platform</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">3. Information Sharing</h2>
                        <p>We do not sell your personal information. We may share your information with trusted third-party service providers (such as payment processors, calendar syncing providers, or hosting services) only to the extent necessary for them to perform services on our behalf.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">4. Data Security</h2>
                        <p>We implement reasonable security measures to protect your personal information from unauthorized access, alteration, or disclosure. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">5. Your Rights</h2>
                        <p>You have the right to access, correct, or delete your personal information. If you have created an account on our platform, you may update your information by logging in. For deletion requests, please contact us.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">6. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
                        <p className="text-white">info@savronmn.com</p>
                    </section>
                </motion.div>
            </div>
        </div>
    );
}
