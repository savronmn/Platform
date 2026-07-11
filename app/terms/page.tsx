"use client";

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-savron-black text-savron-silver py-24 px-6 md:px-12">
            <div className="max-w-3xl mx-auto space-y-12">
                <Link href="/" className="inline-flex items-center text-[10px] uppercase tracking-[0.3em] text-savron-silver/50 hover:text-white transition-colors">
                    <ChevronLeft className="w-3 h-3 mr-2" />
                    Back to Home
                </Link>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <h1 className="font-heading text-4xl md:text-5xl text-white tracking-wider uppercase">Terms of Service</h1>
                    <p className="text-xs uppercase tracking-widest text-savron-silver/50">Last Updated: May 2026</p>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-8 font-light text-sm leading-relaxed text-savron-silver/80">
                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">1. Acceptance of Terms</h2>
                        <p>By accessing or using the SAVRON website and booking platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">2. Booking and Cancellations</h2>
                        <p>All appointments booked through our platform are subject to our scheduling and cancellation policies. Please ensure you arrive on time for your scheduled appointment. Late arrivals may result in reduced service time or cancellation.</p>
                        <p>If you need to cancel or reschedule, please do so at least 24 hours in advance through the booking portal, by email, or by responding <em>No</em> to your Google Calendar invitation from <strong>SAVRON</strong> (<strong>savronmn@gmail.com</strong>). Declining the invite cancels the appointment and frees the slot. Failure to provide sufficient notice or failure to show up for an appointment may result in a cancellation fee or restriction of future booking privileges.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">3. User Accounts</h2>
                        <p>When creating an account as a client or a barber, you are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">4. Payments and Refunds</h2>
                        <p>Payment for services must be made in full at the time of service or through our secure online payment processor. All prices are subject to change without prior notice. Refunds for services rendered are granted at the discretion of the management.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">5. Intellectual Property</h2>
                        <p>All content, branding, logos, and materials on this website are the intellectual property of SAVRON. You may not use, reproduce, or distribute any of our materials without express written permission.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">6. Limitation of Liability</h2>
                        <p>SAVRON shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">7. Changes to Terms</h2>
                        <p>We reserve the right to modify or replace these Terms at any time. We will provide notice of any significant changes by posting the new Terms on this site.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-heading text-white tracking-widest uppercase">8. Contact Information</h2>
                        <p>For any questions regarding these Terms, please contact us at:</p>
                        <p className="text-white">info@savronmn.com</p>
                    </section>
                </motion.div>
            </div>
        </div>
    );
}
