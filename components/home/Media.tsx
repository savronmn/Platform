"use client";

import { motion } from 'framer-motion';

const Media = () => {
    return (
        <section style={{
            position: "relative",
            minHeight: 600,
            overflow: "hidden",
            background: "#0a0a09",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
        }}>
            {/* Full-bleed atmospheric image */}
            <div style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=2070&auto=format&fit=crop')",
                backgroundSize: "cover",
                backgroundPosition: "center 30%",
                filter: "grayscale(70%)",
                opacity: 0.45,
            }} />

            {/* Gradient: heavy at bottom, fades to transparent at top */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(10,10,9,0.97) 0%, rgba(10,10,9,0.55) 45%, rgba(10,10,9,0.1) 100%)",
            }} />

            {/* Top fade from previous section */}
            <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: 120,
                background: "linear-gradient(to bottom, #0d0d0b 0%, transparent 100%)",
            }} />

            {/* Content — aligned to grid */}
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                style={{
                    position: "relative",
                    zIndex: 10,
                    padding: "0 clamp(24px, 5vw, 64px) clamp(56px, 7vw, 96px)",
                }}
            >
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    <div style={{
                        height: 1,
                        width: 40,
                        background: "rgba(232,228,220,0.2)",
                        marginBottom: 28,
                    }} />
                    <h2 style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                        fontSize: "clamp(28px, 4vw, 56px)",
                        lineHeight: 1.1,
                        color: "#e8e4dc",
                        letterSpacing: "-0.015em",
                        marginBottom: 16,
                    }}>
                        Savron lands in Minneapolis.
                    </h2>
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 10,
                        letterSpacing: "0.32em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.38)",
                    }}>
                        The Standard of Excellence &nbsp;·&nbsp; North Loop
                    </p>
                </div>
            </motion.div>
        </section>
    );
};

export default Media;
