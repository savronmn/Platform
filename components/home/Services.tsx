"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useServices } from '@/lib/use-services';

const Services = () => {
    const services = useServices();
    return (
        <section
            id="services"
            style={{
                padding: "clamp(64px, 10vw, 160px) clamp(24px, 5vw, 64px)",
                background: "#0a0a09",
                borderBottom: "1px solid rgba(232,228,220,0.06)",
            }}
        >
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    style={{ marginBottom: "clamp(40px, 6vw, 72px)" }}
                >
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 9,
                        letterSpacing: "0.4em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.25)", marginBottom: 24,
                    }}>
                        002 The Menu
                    </p>
                    <h2 style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontWeight: 500,
                        fontSize: "clamp(32px, 3.6vw, 52px)",
                        lineHeight: 1.1,
                        color: "#e8e4dc",
                        letterSpacing: "-0.015em",
                    }}>
                        Every service, deliberate.
                    </h2>
                </motion.div>

                {/* Service rows */}
                <div style={{ borderTop: "1px solid rgba(232,228,220,0.06)" }}>
                    {services.map((service, index) => {
                        const desc = service.description ?? '';
                        const price = service.price;
                        const duration = service.duration;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.7, delay: index * 0.08 }}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto",
                                    alignItems: "center",
                                    gap: 24,
                                    padding: "clamp(20px, 3vw, 36px) 0",
                                    borderBottom: "1px solid rgba(232,228,220,0.06)",
                                }}
                                className="service-row"
                            >
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 20, minWidth: 0 }}>
                                    <span style={{
                                        fontFamily: "var(--font-montserrat), sans-serif",
                                        fontWeight: 300, fontSize: 10,
                                        color: "rgba(232,228,220,0.22)",
                                        letterSpacing: "0.1em",
                                        minWidth: 24,
                                        paddingTop: 3,
                                        flexShrink: 0,
                                    }}>
                                        0{index + 1}
                                    </span>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 style={{
                                            fontFamily: "var(--font-montserrat), sans-serif",
                                            fontWeight: 500, fontSize: 14,
                                            letterSpacing: "0.06em", textTransform: "uppercase",
                                            color: "#e8e4dc", marginBottom: 6,
                                        }}>
                                            {service.name}
                                        </h3>
                                        <p style={{
                                            fontFamily: "var(--font-montserrat), sans-serif",
                                            fontWeight: 300, fontSize: 13,
                                            lineHeight: 1.8,
                                            color: "rgba(232,228,220,0.55)",
                                            maxWidth: 480,
                                        }}>
                                            {desc}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
                                    <div style={{ textAlign: "right" }}>
                                        <p style={{
                                            fontFamily: "var(--font-playfair), Georgia, serif",
                                            fontSize: 20, fontWeight: 400,
                                            color: "#e8e4dc",
                                        }}>
                                            {price}
                                        </p>
                                        <p style={{
                                            fontFamily: "var(--font-montserrat), sans-serif",
                                            fontSize: 10, letterSpacing: "0.18em",
                                            textTransform: "uppercase",
                                            color: "rgba(232,228,220,0.42)",
                                            marginTop: 4,
                                        }}>
                                            {duration}
                                        </p>
                                    </div>
                                    <Link href="/booking" style={{
                                        fontFamily: "var(--font-montserrat), sans-serif",
                                        fontWeight: 400, fontSize: 10,
                                        letterSpacing: "0.22em", textTransform: "uppercase",
                                        color: "rgba(232,228,220,0.38)",
                                        textDecoration: "none",
                                        whiteSpace: "nowrap",
                                        transition: "color 0.3s",
                                    }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e4dc")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.38)")}
                                    >
                                        Book →
                                    </Link>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    style={{ marginTop: "clamp(32px, 4vw, 56px)" }}
                >
                    <Link href="/booking" style={{
                        display: "inline-block",
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 500, fontSize: 9,
                        letterSpacing: "0.32em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.55)",
                        textDecoration: "none",
                        border: "1px solid rgba(232,228,220,0.14)",
                        padding: "18px 40px",
                        transition: "all 0.35s ease",
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(232,228,220,0.05)";
                            e.currentTarget.style.borderColor = "rgba(232,228,220,0.28)";
                            e.currentTarget.style.color = "#e8e4dc";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "rgba(232,228,220,0.14)";
                            e.currentTarget.style.color = "rgba(232,228,220,0.55)";
                        }}
                    >
                        Reserve a Session →
                    </Link>
                </motion.div>

            </div>

            <style>{`
                @media (max-width: 640px) {
                    .service-row {
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                    }
                    .service-row > div:last-child {
                        justify-content: flex-start !important;
                    }
                }
            `}</style>
        </section>
    );
};

export default Services;
