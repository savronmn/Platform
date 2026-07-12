"use client";

import Image from 'next/image';

const Hero = () => {
    return (
        <section style={{ position: "relative", height: "100vh", overflow: "hidden", background: "#0d0d0b" }}>

            {/* Background photo */}
            <div style={{ position: "absolute", inset: 0 }}>
                <Image
                    src="/savron.png"
                    alt=""
                    fill
                    sizes="100vw"
                    priority
                    style={{ objectFit: "cover", objectPosition: "center", filter: "grayscale(40%)", opacity: 0.45 }}
                />
                <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(13,13,11,0.55) 0%, rgba(13,13,11,0.1) 40%, rgba(13,13,11,0.88) 100%)",
                }} />
            </div>


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
                            style={{ objectFit: "contain", opacity: 0.95 }}
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
                    fontWeight: 300, fontSize: 12,
                    letterSpacing: "0.38em", textTransform: "uppercase",
                    color: "rgba(232,228,220,0.68)", marginBottom: 18,
                }}>
                    Minneapolis &nbsp;·&nbsp; North Loop
                </p>
                <p style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontStyle: "italic", fontSize: "clamp(18px, 2.1vw, 28px)",
                    fontWeight: 400, color: "rgba(232,228,220,0.82)",
                    lineHeight: 1.6, maxWidth: 440, margin: "0 auto",
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
                @media (max-width: 768px) {
                    .hero-nav {
                        display: none !important;
                    }
                }
            `}</style>
        </section>
    );
};

export default Hero;
