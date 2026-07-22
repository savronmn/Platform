"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import ShopSocialLinks from '@/components/layout/ShopSocialLinks';
import { useServicesPerformedCount } from '@/lib/use-services-performed-count';

const pillars = [
    { title: "Intentional.", body: "Every detail considered. Nothing left to chance." },
    { title: "Crafted.", body: "Traditional technique refined through years of practice." },
    { title: "Personal.", body: "Good music, good energy, and a barber who actually listens." },
];

const About = () => {
    const { display: servicesPerformed } = useServicesPerformedCount();

    const stats = [
        { value: servicesPerformed, label: "Services performed" },
        { value: "1,000+", label: "Professional cuts" },
        { value: "Walk-ins", label: "Welcome" },
    ];

    return (
        <section
            id="about"
            style={{
                position: "relative",
                padding: "clamp(64px, 10vw, 160px) clamp(24px, 5vw, 64px)",
                borderBottom: "1px solid rgba(232,228,220,0.06)",
                overflow: "hidden",
            }}
        >
            {/* Interior photo — bottom half visible */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                <Image
                    src="/savron.png"
                    alt=""
                    fill
                    sizes="100vw"
                    style={{
                        objectFit: "cover",
                        objectPosition: "center bottom",
                        opacity: 0.18,
                        filter: "grayscale(20%)",
                    }}
                    priority={false}
                />
                {/* Dark overlay so text stays sharp */}
                <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to bottom, #0d0d0b 0%, rgba(13,13,11,0.82) 50%, rgba(13,13,11,0.88) 100%)",
                }} />
            </div>
            <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
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
                            fontWeight: 300, fontSize: 12,
                            letterSpacing: "0.35em", textTransform: "uppercase",
                            color: "rgba(232,228,220,0.65)", marginBottom: 28,
                        }}>
                            001 The Standard
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
                            color: "rgba(232,228,220,0.78)",
                            maxWidth: 380,
                            marginBottom: 24,
                        }}>
                            Located in the North Loop, Minneapolis. SAVRON is built on quality craft and a straightforward approach to barbering. Appointments and walk-ins both welcome.
                        </p>
                        <ShopSocialLinks variant="inline" />
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
                                    color: "rgba(232,228,220,0.72)",
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
                            {stats.map(({ value, label }) => (
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
                                        fontSize: 12, letterSpacing: "0.2em",
                                        textTransform: "uppercase",
                                        color: "rgba(232,228,220,0.72)",
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
