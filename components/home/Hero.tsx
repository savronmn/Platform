"use client";

import Image from 'next/image';
import Link from 'next/link';

const Hero = () => {
    return (
        <section style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#0d0d0b" }}>

            {/* Background video */}
            <div style={{ position: "absolute", inset: 0 }}>
                <div style={{
                    position: "absolute", inset: 0, zIndex: 1,
                    background: "linear-gradient(to bottom, rgba(13,13,11,0.6) 0%, rgba(13,13,11,0.1) 40%, rgba(13,13,11,0.88) 100%)",
                }} />
                <video
                    autoPlay loop muted playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(60%)", opacity: 0.55 }}
                >
                    <source src="/hero_bg.mp4" type="video/mp4" />
                </video>
            </div>

            {/* Nav */}
            <nav style={{
                position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "32px clamp(24px, 6vw, 80px)",
            }}>
                <div style={{ position: "relative", width: 110, height: 24 }}>
                    <Image src="/logo.png" alt="SAVRON" fill
                        style={{ objectFit: "contain", objectPosition: "left", filter: "brightness(0) invert(1)", opacity: 0.75 }}
                        priority
                    />
                </div>
                <Link
                    href="/booking"
                    className="glass-panel"
                    style={{
                        display: "inline-flex", alignItems: "center",
                        fontFamily: "var(--font-montserrat), sans-serif",
                        fontWeight: 500, fontSize: 10,
                        letterSpacing: "0.32em", textTransform: "uppercase",
                        color: "rgba(232,228,220,0.85)", textDecoration: "none",
                        padding: "14px 26px",
                        transition: "all 0.4s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(232,228,220,0.85)";
                        e.currentTarget.style.transform = "translateY(0)";
                    }}
                >
                    Book Now →
                </Link>
            </nav>

            {/* Centered logo */}
            <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10, textAlign: "center",
                animation: "svHeroIn 1.2s cubic-bezier(.16,1,.3,1) 0.2s both",
            }}>
                <div style={{ overflow: "hidden", padding: "12px 0 18px" }}>
                    <div style={{ position: "relative", width: "clamp(240px, 42vw, 540px)", height: "clamp(56px, 10vw, 130px)" }}>
                        <Image src="/logo.png" alt="SAVRON" fill
                            style={{ objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }}
                            priority
                        />
                    </div>
                </div>
            </div>

            {/* Location + tagline at bottom */}
            <div style={{
                position: "absolute", bottom: "14%",
                left: 0, right: 0, textAlign: "center",
                zIndex: 10, padding: "0 24px",
                animation: "svFadeIn 1s ease 0.9s both",
            }}>
                <p style={{
                    fontFamily: "var(--font-montserrat), sans-serif",
                    fontWeight: 300, fontSize: 9,
                    letterSpacing: "0.44em", textTransform: "uppercase",
                    color: "rgba(232,228,220,0.35)", marginBottom: 18,
                }}>
                    Minneapolis &nbsp;·&nbsp; North Loop
                </p>
                <p style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontStyle: "italic", fontSize: "clamp(17px, 2vw, 26px)",
                    fontWeight: 400, color: "rgba(232,228,220,0.6)",
                    lineHeight: 1.55, maxWidth: 420, margin: "0 auto",
                }}>
                    &ldquo;Some things are not announced.<br />They are simply experienced.&rdquo;
                </p>
            </div>

            {/* Scroll cue */}
            <div style={{
                position: "absolute", bottom: 32, left: "50%",
                transform: "translateX(-50%)", zIndex: 10,
                animation: "svFadeIn 1s ease 1.6s both",
                opacity: 0,
            }}>
                <div style={{ width: 1, height: 44, background: "rgba(232,228,220,0.22)" }} />
            </div>

            <style>{`
                @keyframes svHeroIn {
                    from { opacity: 0; transform: translate(-50%, calc(-50% + 32px)); }
                    to   { opacity: 1; transform: translate(-50%, -50%); }
                }
                @keyframes svFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
            `}</style>
        </section>
    );
};

export default Hero;
