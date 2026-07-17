"use client";

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { SHOP_CONTACT_EMAIL } from '@/lib/shop';

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
                    <p className="text-xs uppercase tracking-widest text-savron-silver/50">Last Updated: July 2026</p>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-8 font-light text-sm leading-relaxed text-savron-silver/80">
                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">1. Information We Collect</h2>
                        <p>We collect information you provide directly to us when you book an appointment, create an account, join our membership program, download a digital membership pass (ePass / Apple Wallet / Google Wallet), apply to be a barber, or communicate with us. This may include your name, email address, phone number, visit history, and appointment details.</p>
                        <p>We also automatically collect certain information about your device and how you interact with our website, including your IP address, browser type, and pages visited.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">2. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-5 space-y-2 text-savron-silver/70">
                            <li>Process and manage your booking appointments</li>
                            <li>Send appointment confirmations, updates, cancellations, and reminders</li>
                            <li>Synchronize appointments with Google Calendar for scheduling and availability</li>
                            <li>Issue and update digital membership passes and visit counts</li>
                            <li>Communicate with you regarding services, promotions, or changes to our terms</li>
                            <li>Maintain and improve our website and scheduling platform</li>
                            <li>Comply with legal obligations, including Minnesota barbering regulations where applicable</li>
                        </ul>
                    </section>

                    <section id="cookies" className="space-y-4 scroll-mt-24">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">3. Cookies & Similar Technologies</h2>
                        <p>We use cookies and similar technologies (such as browser local storage) to operate our website and services.</p>
                        <ul className="list-disc pl-5 space-y-2 text-savron-silver/70">
                            <li><strong className="text-savron-silver">Essential cookies</strong>. required for secure login, session management, appointment booking, membership passes, and fraud prevention. These cannot be disabled if you use our online services.</li>
                            <li><strong className="text-savron-silver">Functional storage</strong>. remembers preferences such as language settings to improve your experience.</li>
                            <li><strong className="text-savron-silver">Analytics cookies</strong>. optional, off by default unless you allow them in our cookie preferences. We do not use analytics cookies for targeted advertising.</li>
                        </ul>
                        <p>You can change your cookie preferences at any time using the cookie banner on your first visit, or by clearing site data in your browser and revisiting savron.com.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">4. Information Sharing</h2>
                        <p>We do not sell your personal information. We do not process personal data for targeted advertising across non-affiliated websites. We may share your information with trusted third-party service providers (such as payment processors, calendar syncing providers, email delivery, or hosting services) only to the extent necessary for them to perform services on our behalf.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">5. Data Security</h2>
                        <p>We implement reasonable security measures to protect your personal information from unauthorized access, alteration, or disclosure. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
                    </section>

                    <section id="privacy-rights" className="space-y-4 scroll-mt-24">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">6. Your Privacy Rights (Minnesota)</h2>
                        <p>If you are a Minnesota resident, the Minnesota Consumer Data Privacy Act (MCDPA) may provide you with the following rights regarding your personal data:</p>
                        <ul className="list-disc pl-5 space-y-2 text-savron-silver/70">
                            <li><strong className="text-savron-silver">Access</strong>. request to know what personal data we hold about you</li>
                            <li><strong className="text-savron-silver">Correction</strong>. request correction of inaccurate personal data</li>
                            <li><strong className="text-savron-silver">Deletion</strong>. request deletion of personal data we collected from you</li>
                            <li><strong className="text-savron-silver">Opt out</strong>. opt out of the sale of personal data (we do not sell personal data) and opt out of targeted advertising (we do not engage in cross-site targeted advertising)</li>
                            <li><strong className="text-savron-silver">Data portability</strong>. request a copy of personal data you provided, where applicable</li>
                        </ul>
                        <p>To exercise these rights, email us at <a href={`mailto:${SHOP_CONTACT_EMAIL}`} className="text-white hover:underline">{SHOP_CONTACT_EMAIL}</a> with the subject line &quot;Privacy Rights Request.&quot; We will verify your request and respond as required by law. You will not be discriminated against for exercising your privacy rights.</p>
                        <p>If you have an account, you may also update certain information by logging in to your membership or booking profile.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">7. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy or our data practices, please contact us at:</p>
                        <p className="text-white">{SHOP_CONTACT_EMAIL}</p>
                        <p className="text-savron-silver/60 text-xs">SAVRON Barbershop · Minneapolis, Minnesota</p>
                    </section>
                </motion.div>
            </div>
        </div>
    );
}
