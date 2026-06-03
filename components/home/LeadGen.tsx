"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';

const LeadGen = () => {
    return (
        <section style={{
            padding: "clamp(100px, 11vw, 160px) clamp(24px, 5vw, 64px)",
            background: "#0d0d0b",
            borderBottom: "1px solid rgba(232,228,220,0.06)",
        }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9 }}
                >
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 9,
                        letterSpacing: "0.4em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.25)", marginBottom: 40,
                    }}>
                        003 — The Access
                    </p>
                    <p style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontWeight: 500,
                        fontSize: "clamp(26px, 3.8vw, 54px)",
                        lineHeight: 1.28,
                        color: "#f0ede8",
                        maxWidth: 720,
                        letterSpacing: "-0.015em",
                        marginBottom: 56,
                    }}>
                        A great haircut should be the easiest part of your day.
                        Walk in, sit down, leave looking sharp.
                        That&rsquo;s the whole idea.
                    </p>
                    <Link
                        href="/booking"
                        className="glass-panel"
                        style={{
                            display: "inline-block",
                            fontFamily: "var(--font-montserrat), sans-serif",
                            fontWeight: 500, fontSize: 12,
                            letterSpacing: "0.34em", textTransform: "uppercase",
                            color: "rgba(232,228,220,0.9)",
                            textDecoration: "none",
                            padding: "26px 56px",
                            transition: "all 0.45s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = "rgba(232,228,220,0.9)";
                            e.currentTarget.style.transform = "translateY(0)";
                        }}
                    >
                        Book an Appointment →
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

export default LeadGen;
