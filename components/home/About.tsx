"use client";

import { motion } from 'framer-motion';

const pillars = [
    { title: "Intentional.", body: "Every detail considered. Nothing left to chance." },
    { title: "Crafted.", body: "Traditional technique refined through years of practice." },
    { title: "Personal.", body: "Good music, good energy, and a barber who actually listens." },
];

const About = () => {
    return (
        <section
            id="about"
            style={{
                padding: "clamp(100px, 12vw, 160px) clamp(24px, 5vw, 64px)",
                background: "#0d0d0b",
                borderBottom: "1px solid rgba(232,228,220,0.06)",
            }}
        >
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.15fr",
                        gap: "clamp(48px, 8vw, 120px)",
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
                            fontSize: "clamp(32px, 3.6vw, 52px)",
                            lineHeight: 1.1,
                            color: "#e8e4dc",
                            letterSpacing: "-0.02em",
                            marginBottom: 32,
                        }}>
                            Quality barbering, done right, every time.
                        </h2>
                        <p style={{
                            fontFamily: "var(--font-montserrat), sans-serif",
                            fontWeight: 300, fontSize: 15,
                            lineHeight: 1.9,
                            color: "rgba(232,228,220,0.62)",
                            maxWidth: 380,
                        }}>
                            Located in the North Loop, Minneapolis. SAVRON is built on quality craft and a straightforward approach to barbering. Appointments and walk-ins both welcome.
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
                            paddingLeft: "clamp(28px, 4vw, 64px)",
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
                                    fontWeight: 300, fontSize: 14,
                                    lineHeight: 1.8,
                                    color: "rgba(232,228,220,0.58)",
                                }}>
                                    {body}
                                </p>
                            </div>
                        ))}

                        {/* Stats */}
                        <div style={{
                            display: "flex",
                            gap: "clamp(24px, 4vw, 48px)",
                            paddingTop: 16,
                            borderTop: "1px solid rgba(232,228,220,0.08)",
                            flexWrap: "wrap",
                        }}>
                            {[
                                { value: "7,000+", label: "Services performed" },
                                { value: "1,000+", label: "Professional cuts" },
                                { value: "Walk-ins", label: "Welcome" },
                            ].map(({ value, label }) => (
                                <div key={label}>
                                    <p style={{
                                        fontFamily: "var(--font-playfair), Georgia, serif",
                                        fontSize: 26, fontWeight: 400,
                                        color: "#e8e4dc", marginBottom: 6,
                                    }}>
                                        {value}
                                    </p>
                                    <p style={{
                                        fontFamily: "var(--font-montserrat), sans-serif",
                                        fontSize: 10, letterSpacing: "0.22em",
                                        textTransform: "uppercase",
                                        color: "rgba(232,228,220,0.42)",
                                    }}>
                                        {label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .about-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .about-grid > div:last-child {
                        border-left: none !important;
                        border-top: 1px solid rgba(232,228,220,0.07);
                        padding-left: 0 !important;
                        padding-top: 40px;
                    }
                }
            `}</style>
        </section>
    );
};

export default About;
