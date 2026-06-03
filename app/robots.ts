import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/barber/', '/membership/', '/api/', '/host/', '/epass/'],
      },
    ],
    sitemap: 'https://savron.com/sitemap.xml',
  };
}
