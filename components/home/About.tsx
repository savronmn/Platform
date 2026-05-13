"use client";

import { motion } from 'framer-motion';

const pillars = [
    { title: "Intentional.", body: "Every detail considered. Nothing left to chance." },
    { title: "Private.", body: "A space engineered for those who understand discretion." },
    { title: "Timeless.", body: "No trends. No noise. Enduring craft and excellence." },
];

const About = () => {
    return (
        <section
            id="about"
            style={{
                padding: "clamp(80px, 12vw, 160px) clamp(24px, 8vw, 120px)",
                background: "#0d0d0b",
                borderBottom: "1px solid rgba(232,228,220,0.06)",
            }}
        >
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "clamp(40px, 7vw, 100px)",
                alignItems: "center",
            }}
                className="about-grid"
            >
                {/* Left */}
                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9 }}
                >
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 9,
                        letterSpacing: "0.4em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.25)", marginBottom: 28,
                    }}>
                        001 — The Standard
                    </p>
                    <h2 style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontWeight: 600,
                        fontSize: "clamp(32px, 4vw, 56px)",
                        lineHeight: 1.08,
                        color: "#e8e4dc",
                        letterSpacing: "-0.02em",
                        marginBottom: 32,
                    }}>
                        Curated for the man who demands the extraordinary.
                    </h2>
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 14,
                        lineHeight: 1.9,
                        color: "rgba(232,228,220,0.45)",
                        maxWidth: 400,
                    }}>
                        Located in the North Loop, Minneapolis. SAVRON is a space where traditional craftsmanship meets modern restraint. Every appointment is deliberate. Every walk-in, welcome.
                    </p>
                </motion.div>

                {/* Right: pillars */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.18 }}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 40,
                        borderLeft: "1px solid rgba(232,228,220,0.07)",
                        paddingLeft: "clamp(24px, 4vw, 60px)",
                    }}
                >
                    {pillars.map(({ title, body }) => (
                        <div key={title}>
                            <p style={{
                                fontFamily: "var(--font-playfair), Georgia, serif",
                                fontStyle: "italic",
                                fontSize: 21, fontWeight: 400,
                                color: "#e8e4dc", marginBottom: 8,
                            }}>
                                {title}
                            </p>
                            <p style={{
                                fontFamily: "var(--font-montserrat), sans-serif",
                                fontWeight: 300, fontSize: 13,
                                lineHeight: 1.75,
                                color: "rgba(232,228,220,0.35)",
                            }}>
                                {body}
                            </p>
                        </div>
                    ))}

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 36, paddingTop: 8, borderTop: "1px solid rgba(232,228,220,0.06)", flexWrap: "wrap" }}>
                        {[
                            { value: "7,000+", label: "Services performed" },
                            { value: "1,000+", label: "Professional cuts" },
                            { value: "Walk-ins", label: "Welcome" },
                        ].map(({ value, label }) => (
                            <div key={label}>
                                <p style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: 26, fontWeight: 400, color: "#e8e4dc", marginBottom: 4 }}>
                                    {value}
                                </p>
                                <p style={{ fontFamily: "var(--font-montserrat), sans-serif", fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(232,228,220,0.28)" }}>
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .about-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </section>
    );
};

export default About;
