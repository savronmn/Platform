/** @type {import('next').NextConfig} */
const supabaseHostname = (() => {
    try {
        return process.env.NEXT_PUBLIC_SUPABASE_URL
            ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
            : 'joakpktzdroizxtrqkrl.supabase.co';
    } catch {
        return 'joakpktzdroizxtrqkrl.supabase.co';
    }
})();

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: supabaseHostname,
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
};

module.exports = nextConfig;
