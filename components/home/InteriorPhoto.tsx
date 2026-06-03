"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';

const InteriorPhoto = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{
                position: "relative",
                width: "100%",
                height: "clamp(280px, 38vw, 560px)",
                overflow: "hidden",
                background: "#080806",
            }}
        >
            <Image
                src="/savron.png"
                alt=""
                fill
                sizes="100vw"
                style={{
                    objectFit: "cover",
                    objectPosition: "center 40%",
                    opacity: 0.75,
                    filter: "grayscale(30%)",
                }}
                priority={false}
            />
            {/* subtle top/bottom fade to blend with surrounding sections */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, #0d0d0b 0%, transparent 22%, transparent 78%, #0d0d0b 100%)",
                pointerEvents: "none",
            }} />
        </motion.div>
    );
};

export default InteriorPhoto;
