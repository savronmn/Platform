import Image from 'next/image';
import Link from 'next/link';
import MembershipSignupForm from '@/components/home/MembershipSignupForm';
import ShopSocialLinks from '@/components/layout/ShopSocialLinks';

const Footer = () => {
    return (
        <footer style={{ background: "#0d0d0b", color: "#e8e4dc", fontFamily: "var(--font-montserrat), sans-serif" }}>

            {/* Top rule */}
            <div style={{ height: 1, background: "rgba(232,228,220,0.06)" }} />

            {/* Membership signup section */}
            <div id="request-access" style={{
                padding: "clamp(72px, 10vw, 120px) clamp(24px, 8vw, 120px)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "clamp(40px, 8vw, 120px)",
                alignItems: "start",
                borderBottom: "1px solid rgba(232,228,220,0.05)",
            }}
                className="footer-signup-grid"
            >
                {/* Left: editorial copy */}
                <div>
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 9,
                        letterSpacing: "0.4em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.25)", marginBottom: 28,
                    }}>
                        004. The List
                    </p>
                    <h2 style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontWeight: 600,
                        fontSize: "clamp(32px, 3.5vw, 52px)",
                        lineHeight: 1.05,
                        color: "#e8e4dc",
                        letterSpacing: "-0.02em",
                        marginBottom: 28,
                    }}>
                        Request access.
                    </h2>
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 13,
                        lineHeight: 1.9,
                        color: "rgba(232,228,220,0.4)",
                        maxWidth: 340,
                        marginBottom: 36,
                    }}>
                        Leave your name and email. Your digital membership pass for Apple Wallet or Google Wallet arrives immediately and tracks your visits automatically.
                    </p>
                    {["Apple Wallet", "Google Wallet"].map((item) => (
                        <p key={item} style={{
                            fontFamily: "var(--font-montserrat), sans-serif",
                            fontWeight: 300, fontSize: 10,
                            letterSpacing: "0.18em",
                            color: "rgba(232,228,220,0.18)",
                            display: "flex", alignItems: "center", gap: 12,
                            marginBottom: 10,
                        }}>
                            <span style={{ width: 20, height: 1, background: "rgba(232,228,220,0.12)", display: "inline-block" }} />
                            {item}
                        </p>
                    ))}
                </div>

                {/* Right: form */}
                <div style={{ paddingTop: 4 }}>
                    <MembershipSignupForm />
                    <p style={{
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 300, fontSize: 9,
                        letterSpacing: "0.22em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.12)", textAlign: "center",
                        marginTop: 24,
                    }}>
                        Invitation only &nbsp;·&nbsp; North Loop, Minneapolis
                    </p>
                </div>
            </div>

            {/* Nav + contact row */}
            <div
                className="footer-nav-row"
                style={{
                padding: "clamp(40px, 6vw, 72px) clamp(24px, 8vw, 120px)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 40,
                borderBottom: "1px solid rgba(232,228,220,0.05)",
                flexWrap: "wrap",
            }}>
                {/* Brand */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 240 }}>
                    <div style={{ position: "relative", width: 108, height: 26 }}>
                        <Image src="/logo.png" alt="SAVRON" fill style={{ objectFit: "contain", objectPosition: "left", opacity: 0.7 }} />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.8, color: "rgba(232,228,220,0.32)" }}>
                        A luxury barbershop in Minneapolis. Traditional craftsmanship, modern aesthetic.
                    </p>
                </div>

                {/* Links */}
                <div className="footer-links-group" style={{ display: "flex", gap: 64 }}>
                    <div>
                        <p style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(232,228,220,0.25)", marginBottom: 20 }}>
                            Explore
                        </p>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { href: "/#about", label: "About" },
                                { href: "/#services", label: "Services" },
                                { href: "/booking", label: "Book Now" },
                                { href: "/portal", label: "Join the Team" },
                            ].map(({ href, label }) => (
                                <li key={href}>
                                    <Link href={href} style={{
                                        fontSize: 12, fontWeight: 300,
                                        letterSpacing: "0.08em",
                                        color: "rgba(232,228,220,0.38)",
                                        textDecoration: "none",
                                        transition: "color 0.3s",
                                    }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e4dc")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.38)")}
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <p style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(232,228,220,0.25)", marginBottom: 20 }}>
                            Contact
                        </p>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                            <li style={{ fontSize: 12, fontWeight: 300, color: "rgba(232,228,220,0.38)" }}>Minneapolis, MN</li>
                            <li>
                                <a href="mailto:info@savronmn.com" style={{
                                    fontSize: 12, fontWeight: 300,
                                    color: "rgba(232,228,220,0.38)", textDecoration: "none",
                                    transition: "color 0.3s",
                                }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e4dc")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.38)")}
                                >
                                    info@savronmn.com
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <p style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(232,228,220,0.25)", marginBottom: 20 }}>
                            Follow
                        </p>
                        <ShopSocialLinks />
                    </div>
                </div>
            </div>

            {/* Licensing / regulatory notice (MN Board of Barber Examiners) */}
            <div style={{
                padding: "0 clamp(24px, 8vw, 120px) 20px",
            }}>
                <p style={{
                    fontSize: "10px",
                    lineHeight: 1.6,
                    color: "rgba(232,228,220,0.2)",
                    maxWidth: "800px",
                }}>
                    SAVRON Barbershop &amp; Lounge operates as a registered Minnesota barbershop. Individual barber
                    licenses and the shop registration are displayed in-shop as required by the Minnesota Board of
                    Barber Examiners. Verify a registration at{' '}
                    <a
                        href="https://mn.gov/boards/barber-examiners/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "rgba(232,228,220,0.35)", textDecoration: "underline" }}
                    >
                        mn.gov/boards/barber-examiners
                    </a>
                    . Licensing questions: 651-201-2820 · bbe.board@state.mn.us
                </p>
            </div>

            {/* Google OAuth Transparency Copy */}
            <div style={{
                padding: "0 clamp(24px, 8vw, 120px) 20px",
            }}>
                <p style={{
                    fontSize: "10px",
                    lineHeight: 1.6,
                    color: "rgba(232,228,220,0.2)",
                    maxWidth: "800px",
                }}>
                    Savron is a professional scheduling platform and digital infrastructure designed to streamline client management. Our platform integrates with Google OAuth services to synchronize calendar data and automate booking availability. We prioritize data integrity and only utilize permissions necessary for core scheduling functionality.
                </p>
            </div>

            {/* Copyright */}
            <div
                className="footer-copyright-row"
                style={{
                padding: "20px clamp(24px, 8vw, 120px)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(232,228,220,0.14)" }}>
                    © {new Date().getFullYear()} SAVRON. All rights reserved.
                </p>
                <div className="footer-copyright-links" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Link href="/privacy" style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(232,228,220,0.14)", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.4)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.14)")}>Privacy</Link>
                    <Link href="/privacy#privacy-rights" style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(232,228,220,0.14)", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.4)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.14)")}>Your Privacy Rights</Link>
                    <Link href="/privacy#cookies" style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(232,228,220,0.14)", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.4)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.14)")}>Cookies</Link>
                    <Link href="/terms" style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(232,228,220,0.14)", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.4)")} onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232,228,220,0.14)")}>Terms</Link>
                    <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(232,228,220,0.14)" }}>
                        savronmn.com
                    </p>
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .footer-signup-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .footer-nav-row {
                        flex-direction: column !important;
                        gap: 40px !important;
                    }
                    .footer-links-group {
                        flex-direction: column !important;
                        gap: 32px !important;
                    }
                    .footer-copyright-row {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 12px !important;
                    }
                    .footer-copyright-links {
                        justify-content: flex-start !important;
                    }
                    .footer-service-row {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 16px !important;
                    }
                    .footer-service-right {
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        width: 100% !important;
                    }
                }
            `}</style>
        </footer>
    );
};

export default Footer;
