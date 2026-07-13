import { Facebook, Instagram } from 'lucide-react';
import { SHOP_SOCIAL_LINK_LIST } from '@/lib/shop';

const linkStyle = {
    fontSize: 12,
    fontWeight: 300 as const,
    color: 'rgba(232,228,220,0.38)',
    textDecoration: 'none',
    transition: 'color 0.3s',
};

function TikTokIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} aria-hidden="true">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
        </svg>
    );
}

function SocialIcon({ id, size }: { id: (typeof SHOP_SOCIAL_LINK_LIST)[number]['id']; size: number }) {
    if (id === 'instagram') return <Instagram size={size} aria-hidden="true" />;
    if (id === 'facebook') return <Facebook size={size} aria-hidden="true" />;
    return <TikTokIcon size={size} />;
}

type ShopSocialLinksProps = {
    variant?: 'footer' | 'inline';
};

export default function ShopSocialLinks({ variant = 'footer' }: ShopSocialLinksProps) {
    const iconSize = variant === 'inline' ? 16 : 14;

    if (variant === 'inline') {
        return (
            <div className="flex items-center gap-4">
                {SHOP_SOCIAL_LINK_LIST.map(({ id, label, href }) => (
                    <a
                        key={id}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`SAVRON on ${label}`}
                        className="text-savron-silver/50 hover:text-white transition-colors"
                    >
                        <SocialIcon id={id} size={iconSize} />
                    </a>
                ))}
            </div>
        );
    }

    return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SHOP_SOCIAL_LINK_LIST.map(({ id, label, href }) => (
                <li key={id}>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#e8e4dc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(232,228,220,0.38)'; }}
                    >
                        <SocialIcon id={id} size={iconSize} />
                        {label}
                    </a>
                </li>
            ))}
        </ul>
    );
}
