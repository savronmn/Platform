import type { Metadata } from 'next';
import Link from 'next/link';
import { blogPosts } from '@/lib/blog-data';

export const metadata: Metadata = {
  title: 'Grooming Journal | SAVRON Barbershop Minneapolis',
  description:
    'Expert insight on haircuts, beard care, scalp health, and men\'s grooming from the barbers at SAVRON. Minneapolis\'s premier luxury barbershop.',
  openGraph: {
    title: 'Grooming Journal | SAVRON Barbershop Minneapolis',
    description:
      'Expert insight on haircuts, beard care, scalp health, and men\'s grooming from the barbers at SAVRON.',
    type: 'website',
    url: 'https://savron.com/blog',
  },
  keywords: [
    'men grooming blog',
    'barbershop Minneapolis',
    'haircut tips for men',
    'beard care advice',
    'hair growth men',
    'scalp health routine',
    'luxury barbershop blog',
    'Minneapolis men hairstyles',
  ],
  alternates: {
    canonical: 'https://savron.com/blog',
  },
};

const categoryColors: Record<string, string> = {
  'Style Guide': 'text-savron-green-light border-savron-green-light/30',
  'Hair Health': 'text-savron-silver border-savron-silver/30',
  'Beard Care': 'text-white/70 border-white/20',
  Barbering: 'text-savron-green-light border-savron-green-light/30',
};

export default function BlogIndexPage() {
  const featured = blogPosts[0];
  const rest = blogPosts.slice(1);

  return (
    <main className="min-h-screen bg-savron-black pt-24 pb-32">
      {/* JSON-LD Blog structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'SAVRON Grooming Journal',
            description:
              'Expert grooming insight from SAVRON Barbershop in Minneapolis, MN.',
            url: 'https://savron.com/blog',
            publisher: {
              '@type': 'Organization',
              name: 'SAVRON Barbershop',
              url: 'https://savron.com',
            },
            blogPost: blogPosts.map((post) => ({
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.excerpt,
              url: `https://savron.com/blog/${post.slug}`,
              datePublished: post.publishedAtISO,
              keywords: post.keywords.join(', '),
            })),
          }),
        }}
      />

      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="mb-20">
          <p className="chapter-label mb-4">SAVRON / Grooming Journal</p>
          <h1 className="font-heading text-4xl md:text-5xl font-light tracking-tight text-white mb-5">
            The Journal
          </h1>
          <div className="divider-silver mb-6" />
          <p className="text-savron-silver/70 text-base max-w-xl leading-relaxed">
            Craft, technique, and the details that separate good grooming from great grooming.
            Written by the barbers who practice it daily.
          </p>
        </div>

        {/* Featured post */}
        <Link
          href={`/blog/${featured.slug}`}
          className="group block mb-20 border border-white/8 hover:border-white/20 transition-all duration-500 rounded-savron overflow-hidden"
        >
          <div className="bg-savron-grey p-8 md:p-12">
            <div className="flex items-center gap-4 mb-6">
              <span
                className={`text-[10px] uppercase tracking-[0.35em] border px-3 py-1 rounded-savron ${
                  categoryColors[featured.category] ?? 'text-white/50 border-white/15'
                }`}
              >
                {featured.category}
              </span>
              <span className="text-white/30 text-xs tracking-widest">{featured.readTime}</span>
            </div>

            <h2 className="font-heading text-2xl md:text-4xl font-light text-white mb-4 group-hover:text-savron-silver transition-colors duration-300 leading-snug">
              {featured.title}
            </h2>

            <p className="text-savron-silver/60 text-sm md:text-base leading-relaxed max-w-2xl mb-8">
              {featured.excerpt}
            </p>

            <div className="flex items-center gap-2 text-savron-green-light text-xs uppercase tracking-widest">
              <span>Read Article</span>
              <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
            </div>
          </div>
        </Link>

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block border border-white/8 hover:border-white/20 transition-all duration-500 rounded-savron p-7"
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className={`text-[10px] uppercase tracking-[0.35em] border px-2.5 py-0.5 rounded-savron ${
                    categoryColors[post.category] ?? 'text-white/50 border-white/15'
                  }`}
                >
                  {post.category}
                </span>
                <span className="text-white/25 text-xs">{post.readTime}</span>
              </div>

              <h2 className="font-heading text-lg md:text-xl font-light text-white mb-3 group-hover:text-savron-silver transition-colors duration-300 leading-snug">
                {post.title}
              </h2>

              <p className="text-savron-silver/50 text-sm leading-relaxed mb-6 line-clamp-3">
                {post.excerpt}
              </p>

              <div className="flex items-center gap-2 text-white/30 group-hover:text-savron-green-light text-xs uppercase tracking-widest transition-colors duration-300">
                <span>Read</span>
                <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-24 border-t border-white/8 pt-16 text-center">
          <p className="chapter-label mb-4">Ready for the real thing?</p>
          <h3 className="font-heading text-2xl md:text-3xl font-light text-white mb-6">
            Book Your Appointment at SAVRON
          </h3>
          <p className="text-savron-silver/50 text-sm mb-8 max-w-md mx-auto">
            Minneapolis&apos;s most precise barbershop. Open to the public.
            Walk-ins welcome.
          </p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-3 bg-savron-green text-white px-8 py-3.5 text-xs uppercase tracking-widest hover:bg-savron-green-light transition-colors duration-300 rounded-savron glow-green"
          >
            Book Now
          </Link>
        </div>
      </div>
    </main>
  );
}
