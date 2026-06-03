import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { blogPosts, getBlogPost, type BlogPost } from '@/lib/blog-data';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return {};

  return {
    title: `${post.title} | SAVRON Barbershop`,
    description: post.excerpt,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `https://savron.com/blog/${post.slug}`,
      publishedTime: post.publishedAtISO,
      authors: ['SAVRON Barbershop Minneapolis'],
      tags: post.keywords,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `https://savron.com/blog/${post.slug}`,
    },
  };
}

function renderContent(post: BlogPost) {
  return post.content.map((section, i) => {
    switch (section.type) {
      case 'intro':
        return (
          <p key={i} className="text-savron-silver/80 text-lg leading-[1.85] mb-10 font-light">
            {section.text}
          </p>
        );

      case 'h2':
        return (
          <div key={i} className="mb-8">
            <h2 className="font-heading text-xl md:text-2xl font-light text-white mb-4 leading-snug">
              {section.heading}
            </h2>
            {section.text && (
              <p className="text-savron-silver/65 text-base leading-[1.85]">{section.text}</p>
            )}
          </div>
        );

      case 'h3':
        return (
          <div key={i} className="mb-8">
            <h3 className="font-heading text-lg font-light text-savron-silver mb-3 leading-snug">
              {section.heading}
            </h3>
            {section.text && (
              <p className="text-savron-silver/65 text-base leading-[1.85]">{section.text}</p>
            )}
          </div>
        );

      case 'p':
        return (
          <p key={i} className="text-savron-silver/65 text-base leading-[1.85] mb-8">
            {section.text}
          </p>
        );

      case 'list':
        return (
          <div key={i} className="mb-10">
            {section.heading && (
              <h3 className="font-heading text-lg font-light text-white mb-4">
                {section.heading}
              </h3>
            )}
            <ul className="space-y-3">
              {section.items?.map((item, j) => (
                <li key={j} className="flex gap-3 text-savron-silver/65 text-sm leading-relaxed">
                  <span className="text-savron-green-light mt-1 shrink-0">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'callout':
        return (
          <div
            key={i}
            className="my-10 border-l-2 border-savron-green pl-6 py-1"
          >
            <p className="text-savron-silver/80 text-sm leading-relaxed italic">
              {section.text}
            </p>
          </div>
        );

      case 'closing':
        return (
          <div key={i} className="mt-12 pt-10 border-t border-white/8">
            <p className="text-savron-silver/70 text-base leading-[1.85]">{section.text}</p>
          </div>
        );

      default:
        return null;
    }
  });
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAtISO,
    dateModified: post.publishedAtISO,
    author: {
      '@type': 'Organization',
      name: 'SAVRON Barbershop',
      url: 'https://savron.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SAVRON Barbershop',
      url: 'https://savron.com',
    },
    url: `https://savron.com/blog/${post.slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://savron.com/blog/${post.slug}`,
    },
    keywords: post.keywords.join(', '),
    articleSection: post.category,
  };

  return (
    <main className="min-h-screen bg-savron-black pt-24 pb-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-3xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/25 tracking-widest uppercase mb-12">
          <Link href="/" className="hover:text-white/50 transition-colors">
            SAVRON
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white/50 transition-colors">
            Journal
          </Link>
          <span>/</span>
          <span className="text-white/40">{post.category}</span>
        </nav>

        {/* Article header */}
        <header className="mb-14">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] uppercase tracking-[0.4em] text-savron-green-light border border-savron-green-light/30 px-3 py-1 rounded-savron">
              {post.category}
            </span>
            <span className="text-white/25 text-xs tracking-widest">{post.readTime}</span>
          </div>

          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-light text-white leading-tight mb-5">
            {post.title}
          </h1>

          <p className="text-savron-silver/60 text-base md:text-lg leading-relaxed mb-8">
            {post.subtitle}
          </p>

          <div className="flex items-center gap-6">
            <div className="divider-silver flex-1" />
            <time
              dateTime={post.publishedAtISO}
              className="text-white/25 text-xs tracking-widest uppercase shrink-0"
            >
              {post.publishedAt}
            </time>
            <div className="divider-silver flex-1" />
          </div>
        </header>

        {/* Article body */}
        <article className="prose-savron">
          {renderContent(post)}
        </article>

        {/* Book CTA */}
        <div className="mt-20 bg-savron-charcoal border border-white/8 rounded-savron p-8 md:p-10">
          <p className="chapter-label mb-3">SAVRON — Minneapolis</p>
          <h3 className="font-heading text-xl md:text-2xl font-light text-white mb-3">
            Ready to book?
          </h3>
          <p className="text-savron-silver/50 text-sm mb-6 max-w-sm">
            Precision cuts, beard shaping, and scalp treatments. Appointments and walk-ins both welcome.
          </p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-3 bg-savron-green text-white px-7 py-3 text-xs uppercase tracking-widest hover:bg-savron-green-light transition-colors duration-300 rounded-savron"
          >
            Book Your Appointment
          </Link>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mt-20">
            <p className="chapter-label mb-8">Continue Reading</p>
            <div className="grid md:grid-cols-2 gap-5">
              {related.map((rPost) => (
                <Link
                  key={rPost.slug}
                  href={`/blog/${rPost.slug}`}
                  className="group block border border-white/8 hover:border-white/18 transition-all duration-400 rounded-savron p-6"
                >
                  <span className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-3 block">
                    {rPost.category}
                  </span>
                  <h4 className="font-heading text-base font-light text-white group-hover:text-savron-silver transition-colors duration-300 leading-snug mb-2">
                    {rPost.title}
                  </h4>
                  <p className="text-white/25 text-xs mt-3 flex items-center gap-1.5">
                    <span>Read</span>
                    <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back to journal */}
        <div className="mt-16 pt-8 border-t border-white/8">
          <Link
            href="/blog"
            className="text-white/30 hover:text-white/60 text-xs uppercase tracking-widest transition-colors duration-300 flex items-center gap-2"
          >
            <span>←</span>
            <span>Back to Journal</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
