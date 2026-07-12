"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useServices } from '@/lib/use-services';
import { buildBookingUrl } from '@/lib/booking-utils';

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
                    transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ marginBottom: "clamp(40px, 6vw, 72px)" }}
                >
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 12,
                        letterSpacing: "0.32em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.65)", marginBottom: 24,
                    }}>
                        002 The Menu
                    </p>
                    <h2 style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontWeight: 500,
                        fontSize: "clamp(32px, 3.6vw, 52px)",
                        lineHeight: 1.15,
                        color: "#e8e4dc",
                        letterSpacing: "-0.015em",
                    }}>
                        Every service, deliberate.
                    </h2>
                </motion.div>

                {/* Service rows — entire row is tappable */}
                <div style={{ borderTop: "1px solid rgba(232,228,220,0.06)" }}>
                    {services.map((service, index) => {
                        const desc = service.description ?? '';
                        const price = service.price;
                        const duration = service.duration;
                        return (
                            <motion.div
                                key={service.id}
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                            >
                                <Link
                                    href={buildBookingUrl(service.name)}
                                    className="service-row-link"
                                    aria-label={`Book ${service.name}`}
                                >
                                    <div className="service-row">
                                        <div className="service-row-content">
                                            <span className="service-row-index">
                                                0{index + 1}
                                            </span>
                                            <div className="service-row-text">
                                                <h3 className="service-row-name">{service.name}</h3>
                                                <p className="service-row-desc">{desc}</p>
                                            </div>
                                        </div>

                                        <div className="service-row-meta">
                                            <div className="service-row-price-block">
                                                <p className="service-row-price">{price}</p>
                                                <p className="service-row-duration">{duration}</p>
                                            </div>
                                            <span className="service-row-cta" aria-hidden="true">
                                                Book →
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{ marginTop: "clamp(32px, 4vw, 56px)" }}
                >
                    <Link href="/booking" className="services-reserve-cta">
                        Reserve a Session →
                    </Link>
                </motion.div>

            </div>

            <style>{`
                .service-row-link {
                    display: block;
                    text-decoration: none;
                    color: inherit;
                    -webkit-tap-highlight-color: transparent;
                }

                .service-row {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    align-items: center;
                    gap: 24px;
                    padding: clamp(22px, 3vw, 38px) clamp(4px, 1vw, 12px);
                    border-bottom: 1px solid rgba(232,228,220,0.06);
                    cursor: pointer;
                    transition: background 0.35s ease, padding-left 0.35s ease;
                    min-height: 72px;
                }

                .service-row-link:hover .service-row,
                .service-row-link:focus-visible .service-row {
                    background: rgba(232,228,220,0.03);
                    padding-left: clamp(8px, 1.5vw, 16px);
                }

                .service-row-link:focus-visible .service-row {
                    outline: 2px solid rgba(232,228,220,0.25);
                    outline-offset: -2px;
                }

                .service-row-content {
                    display: flex;
                    align-items: flex-start;
                    gap: 20px;
                    min-width: 0;
                }

                .service-row-index {
                    font-family: var(--font-montserrat), sans-serif;
                    font-weight: 300;
                    font-size: 12px;
                    color: rgba(232,228,220,0.62);
                    letter-spacing: 0.1em;
                    min-width: 28px;
                    padding-top: 4px;
                    flex-shrink: 0;
                }

                .service-row-text {
                    min-width: 0;
                }

                .service-row-name {
                    font-family: var(--font-montserrat), sans-serif;
                    font-weight: 500;
                    font-size: clamp(15px, 1.6vw, 17px);
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    color: #e8e4dc;
                    margin-bottom: 8px;
                    line-height: 1.3;
                }

                .service-row-desc {
                    font-family: var(--font-montserrat), sans-serif;
                    font-weight: 300;
                    font-size: clamp(14px, 1.4vw, 15px);
                    line-height: 1.65;
                    color: rgba(232,228,220,0.78);
                    max-width: 520px;
                }

                .service-row-meta {
                    display: flex;
                    align-items: center;
                    gap: 28px;
                    flex-shrink: 0;
                }

                .service-row-price-block {
                    text-align: right;
                }

                .service-row-price {
                    font-family: var(--font-playfair), Georgia, serif;
                    font-size: clamp(20px, 2vw, 24px);
                    font-weight: 400;
                    color: #e8e4dc;
                    line-height: 1.2;
                }

                .service-row-duration {
                    font-family: var(--font-montserrat), sans-serif;
                    font-size: 12px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: rgba(232,228,220,0.72);
                    margin-top: 6px;
                }

                .service-row-cta {
                    font-family: var(--font-montserrat), sans-serif;
                    font-weight: 500;
                    font-size: 12px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: rgba(232,228,220,0.7);
                    white-space: nowrap;
                    transition: color 0.35s ease, transform 0.35s ease;
                }

                .service-row-link:hover .service-row-cta,
                .service-row-link:focus-visible .service-row-cta {
                    color: #e8e4dc;
                    transform: translateX(3px);
                }

                .services-reserve-cta {
                    display: inline-block;
                    font-family: var(--font-montserrat), sans-serif;
                    font-weight: 500;
                    font-size: 11px;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    color: rgba(232,228,220,0.6);
                    text-decoration: none;
                    border: 1px solid rgba(232,228,220,0.16);
                    padding: 18px 40px;
                    min-height: 52px;
                    transition: all 0.35s ease;
                }

                .services-reserve-cta:hover,
                .services-reserve-cta:focus-visible {
                    background: rgba(232,228,220,0.05);
                    border-color: rgba(232,228,220,0.3);
                    color: #e8e4dc;
                    outline: none;
                }

                @media (max-width: 640px) {
                    .service-row {
                        grid-template-columns: 1fr !important;
                        gap: 18px !important;
                    }
                    .service-row-meta {
                        justify-content: space-between;
                        width: 100%;
                    }
                    .service-row-price-block {
                        text-align: left;
                    }
                }
            `}</style>
        </section>
    );
};

export default Services;
