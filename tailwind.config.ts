import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                'savron-black': '#050505',
                'savron-grey': '#0e0e0e',
                'savron-charcoal': '#1a1a1a',
                'savron-concrete': '#262626',
                'savron-blue': '#125470',
                'savron-blue-light': '#1A6A8A',
                'savron-green': '#125470',
                'savron-green-light': '#1A6A8A',
                'savron-cream': '#e8e4dc',
                'savron-silver': '#C8C8C8',
                'savron-silver-muted': '#787878',
                'savron-white': '#FFFFFF',
            },
            fontFamily: {
                sans: ['var(--font-inter)'],
                heading: ['var(--font-montserrat)'],
            },
            borderRadius: {
                'savron': '2px',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'luxury-pulse': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.6s ease-out forwards',
                'fade-in-delay': 'fade-in 0.6s ease-out 0.2s forwards',
                'luxury-pulse': 'luxury-pulse 2s ease-in-out infinite',
            },
        },
    },
    plugins: [],
};
export default config;
