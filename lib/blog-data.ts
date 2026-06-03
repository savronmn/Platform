export interface BlogPost {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishedAt: string;
  publishedAtISO: string;
  keywords: string[];
  content: BlogSection[];
}

export interface BlogSection {
  type: 'intro' | 'h2' | 'h3' | 'p' | 'list' | 'callout' | 'closing';
  heading?: string;
  text?: string;
  items?: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'summer-2026-haircuts',
    title: 'Summer 2026 Haircuts: The Cuts Defining the Season',
    subtitle: 'From textured crops to modern fades — what to ask for at your next appointment.',
    excerpt:
      'Every summer rewrites the rule book. This one is no different. The cuts dominating chairs in 2026 share a common thread: structure with intention, volume with restraint.',
    category: 'Style Guide',
    readTime: '6 min read',
    publishedAt: 'June 3, 2026',
    publishedAtISO: '2026-06-03',
    keywords: [
      'summer 2026 haircuts',
      'men haircut trends 2026',
      'textured crop',
      'wolf cut men',
      'curtain bangs men',
      'skin fade 2026',
      'Minneapolis barbershop',
      'luxury barber Minneapolis',
    ],
    content: [
      {
        type: 'intro',
        text: 'Every summer rewrites the rule book. The cuts dominating chairs in 2026 share a common thread: structure with intention, volume with restraint. Whether you prefer something refined or something with edges, the season\'s best work balances identity with craft.',
      },
      {
        type: 'h2',
        heading: 'The Textured Crop — Reinvented',
        text: 'The crop has evolved. What started as a blunt, close-cropped style has matured into something more deliberate. This summer, expect to see textured tops with a slight forward fringe — weight taken out through the midsection, leaving movement on the surface. Paired with a low or mid fade, it reads modern without chasing trends.',
      },
      {
        type: 'callout',
        text: 'Ask your barber for: "textured crop with a low skin fade, disconnected at the sides, light point-cut on top."',
      },
      {
        type: 'h2',
        heading: 'The Wolf Cut — Tamed for 2026',
        text: 'Last season\'s wolf cut was raw and somewhat untamed. This summer it arrives refined. More layering through the crown, less bulk at the perimeter, and a defined recession-line trim that gives it an intentional silhouette. It works best on medium-to-thick hair and benefits enormously from quality texture cream.',
      },
      {
        type: 'h2',
        heading: 'Curtain Bangs — The Quiet Comeback',
        text: 'Curtain bangs on men have been quietly building momentum for two years. In 2026 they land squarely in the mainstream — but the version worth wearing is minimal. The bang should fall to the brow, part naturally in the center, and blend seamlessly into a longer top. Avoid the temptation to over-style it. The entire point is the ease.',
      },
      {
        type: 'h2',
        heading: 'The Modern Skin Fade',
        text: 'The skin fade is not new, but its current iteration is more precise than ever. Barbers are working lower — starting the fade from the neckline up — and blending with a tighter gradient. The result is a cleaner line between skin and hair that photographs sharply and holds throughout the day. High skin fades are giving way to mid and low versions that feel less stark against natural hair growth.',
      },
      {
        type: 'h2',
        heading: 'The French Crop with Drop Fade',
        text: 'A perennial in European barbershops, the French crop with a drop fade is having its American moment. The drop fade — where the fade curves down behind the ear rather than maintaining a straight line — adds dimension and a slight aggression to what is otherwise a clean, contained look. The combination rewards regular maintenance, which is exactly why booking a standing appointment pays off.',
      },
      {
        type: 'h3',
        heading: 'What to Bring to Your Appointment',
        text: 'Reference images matter. Even for experienced barbers, a clear photo communicates proportion, texture preference, and finish better than any verbal description. Bring two or three images — not to replicate exactly, but to anchor the conversation.',
      },
      {
        type: 'closing',
        text: 'The best haircut is not always the trendiest one — it is the one built for your structure. Every cut at SAVRON begins with that conversation. Book your appointment and let\'s find the version that works for you.',
      },
    ],
  },

  {
    slug: 'science-of-hair-growth',
    title: 'The Science of Hair Growth: What Your Barber Wants You to Know',
    subtitle: 'Understanding your hair cycle changes how you care for it — and how fast it actually grows.',
    excerpt:
      'Hair growth is not linear, and it is not passive. The scalp is a living ecosystem. Understanding its mechanics shifts you from reactive to proactive.',
    category: 'Hair Health',
    readTime: '7 min read',
    publishedAt: 'June 3, 2026',
    publishedAtISO: '2026-06-03',
    keywords: [
      'hair growth tips for men',
      'how to grow hair faster men',
      'scalp health men',
      'DHT hair loss',
      'hair growth cycle',
      'hair care routine men',
      'best products for hair growth men',
      'barbershop Minneapolis hair health',
    ],
    content: [
      {
        type: 'intro',
        text: 'Hair growth is not linear, and it is not passive. The scalp is a living ecosystem — one that responds to what you eat, how you sleep, and how consistently you care for it. Understanding the mechanics shifts you from reactive maintenance to intentional growth.',
      },
      {
        type: 'h2',
        heading: 'The Three Phases Every Strand Goes Through',
        text: 'Each hair follicle operates on its own independent clock, cycling through three distinct phases. The anagen phase is the active growth period — lasting two to seven years, depending on genetics. The catagen phase is a brief two-week transition where growth stops. And telogen is the resting phase, lasting roughly three months before the follicle sheds and resets. At any given moment, roughly 85% of your hair is in anagen. When that percentage drops — due to stress, hormonal shifts, or poor nutrition — shedding accelerates noticeably.',
      },
      {
        type: 'h2',
        heading: 'DHT: The Hormone No One Talks About Enough',
        text: 'Dihydrotestosterone, or DHT, is the primary driver of male pattern hair loss. It is a derivative of testosterone that binds to receptors in the follicle, gradually miniaturizing it over successive cycles. Sensitivity to DHT is largely genetic — but sensitivity is not destiny. Topical minoxidil and oral finasteride remain the two clinically validated interventions. If you are seeing recession, speak to a dermatologist early. Early intervention preserves significantly more ground than late action.',
      },
      {
        type: 'h2',
        heading: 'The Scalp Microbiome',
        text: 'The scalp hosts a microbiome just as the gut does. When it is balanced, follicles function without interference. When it is disrupted — through harsh shampoos, over-washing, or product buildup — inflammation sets in at the follicle level. That inflammation shortens the anagen phase. The practical implication: wash with a sulfate-free shampoo two to three times per week. No more, no less.',
      },
      {
        type: 'list',
        heading: 'Nutrients That Directly Support Hair Growth',
        items: [
          'Biotin (Vitamin B7) — supports keratin infrastructure; found in eggs, almonds, and sweet potatoes',
          'Iron — low ferritin is one of the most common and overlooked causes of excess shedding in men',
          'Zinc — regulates DHT production and supports follicle repair',
          'Vitamin D — follicle receptors depend on adequate levels to enter and sustain the anagen phase',
          'Omega-3 fatty acids — reduce follicle inflammation and improve scalp circulation',
        ],
      },
      {
        type: 'h2',
        heading: 'Does Cutting Your Hair Make It Grow Faster?',
        text: 'No. Hair grows from the follicle — not from the tip. Trimming has no biological effect on growth rate. What it does is remove split ends that would otherwise travel up the shaft, causing breakage that makes hair appear thinner and shorter over time. Regular trims maintain the integrity of what is already growing.',
      },
      {
        type: 'h2',
        heading: 'Scalp Massage: A Simple Practice With Real Evidence',
        text: 'A 2019 study published in Dermatology and Therapy found that consistent daily scalp massage — four minutes per day over twenty-four weeks — increased hair thickness in participants. The mechanism is mechanical stimulation of the dermal papilla cells at the follicle base. No product required. Just consistent, firm circular pressure with your fingertips.',
      },
      {
        type: 'closing',
        text: 'The barbers at SAVRON approach grooming as a long game. A great haircut today is only part of the equation — the foundation beneath it matters just as much. Our team can recommend products and routines aligned with your specific hair type and goals.',
      },
    ],
  },

  {
    slug: 'beard-architecture',
    title: 'Beard Architecture: How to Grow, Shape, and Maintain a Beard Worth Keeping',
    subtitle: 'A beard is not an accident. It is a decision — made every morning.',
    excerpt:
      'There is a point in every beard\'s life where it either becomes intentional or becomes neglect. The difference is maintenance — and knowing what that actually means.',
    category: 'Beard Care',
    readTime: '8 min read',
    publishedAt: 'June 3, 2026',
    publishedAtISO: '2026-06-03',
    keywords: [
      'beard care for men',
      'how to grow a beard',
      'beard grooming routine',
      'beard oil vs beard balm',
      'best beard styles 2026',
      'beard maintenance Minneapolis',
      'barber beard shaping',
      'beard trim near me',
    ],
    content: [
      {
        type: 'intro',
        text: 'There is a point in every beard\'s life where it either becomes intentional or becomes neglect. The line between the two is thinner than most men realize. Architecture — understanding proportion, symmetry, and maintenance — is what separates a distinguished beard from an unfinished thought.',
      },
      {
        type: 'h2',
        heading: 'The First Eight Weeks: Resist the Urge to Trim',
        text: 'The most common mistake in beard growing is trimming too early. Beard hair grows at different rates across the face — the mustache tends to lead, the chin follows, the cheeks come last. The uneven phase at weeks three and four is temporary, not your final result. Commit to eight weeks before making any shaping decisions. This gives you the full canvas.',
      },
      {
        type: 'h2',
        heading: 'Understanding Your Beard Line',
        text: 'The neckline is where most home grooming goes wrong. Too high, and the beard appears to float without a base. Too low, and it loses definition entirely. The correct neckline sits two finger-widths above the Adam\'s apple and curves naturally behind the jaw. The cheek line should follow the natural edge of your beard growth — enhanced, not invented. Forcing a cheek line higher than your growth creates a geometric shape that reads artificial.',
      },
      {
        type: 'callout',
        text: 'A professional beard shaping at SAVRON takes 20–30 minutes and serves as a template you can maintain at home for the following four to six weeks.',
      },
      {
        type: 'h2',
        heading: 'Beard Oil vs. Beard Balm: When to Use Each',
        text: 'Both serve different functions and the best routines use both. Beard oil is a carrier oil blend — jojoba, argan, sweet almond — that hydrates the skin beneath the beard and conditions the hair shaft from root to tip. It absorbs fully and leaves no residue. Use it daily after washing. Beard balm adds a beeswax component that provides light hold and definition. It is not a styling product per se — it tames flyaways and seals the conditioning work the oil started. Use it after the oil, on towel-dried beard.',
      },
      {
        type: 'list',
        heading: 'The Daily Beard Maintenance Stack',
        items: [
          'Wash two to three times per week with a dedicated beard wash — not face soap or shampoo',
          'Apply beard oil daily, massaging into the skin beneath',
          'Follow with beard balm on days when shape and flyaway control are needed',
          'Brush daily with a boar bristle brush to train direction and distribute product evenly',
          'Trim weekly along the neckline with a precision trimmer to maintain the boundary',
        ],
      },
      {
        type: 'h2',
        heading: 'The Best Beard Styles Carrying Into 2026',
        text: 'The heavy, full beard that dominated the 2010s has given way to more sculpted, considered shapes. The medium boxed beard — full but trimmed to a consistent length with sharp neckline and cheek lines — remains the most versatile option for professional settings. The short stubble at five to seven millimeters is experiencing renewed interest as men recognize its capacity to sharpen jawline definition without committing to a maintenance-heavy full beard. And the extended goatee — a goatee that flows naturally into a slightly longer chin beard — is the most technically demanding of the current styles but rewards the effort.',
      },
      {
        type: 'h2',
        heading: 'When to See a Barber vs. Maintain at Home',
        text: 'Home maintenance is for preservation. Professional work is for shaping and resetting. If your beard has lost its line, grown asymmetric, or you are experimenting with a new style, that is a barber conversation. The tools available at a professional level — straight razors, precise clippers, trained eye — produce a result that home trimming cannot replicate. Think of barber visits as establishing the architecture, and daily care as protecting it.',
      },
      {
        type: 'closing',
        text: 'A well-maintained beard signals something about a man\'s relationship to discipline and self-presentation. At SAVRON, our beard services include shaping, hot towel razor finishing, and conditioning treatment. The result is a line clean enough to maintain with confidence.',
      },
    ],
  },

  {
    slug: 'scalp-care-ritual',
    title: 'The Scalp Care Ritual: Why Most Men Skip the Most Important Step',
    subtitle: 'Your scalp is the foundation. Everything above it depends on what happens beneath.',
    excerpt:
      'Scalp care is the most consequential and least practiced element of men\'s grooming. It is also the simplest to get right once you understand what it actually requires.',
    category: 'Hair Health',
    readTime: '5 min read',
    publishedAt: 'June 3, 2026',
    publishedAtISO: '2026-06-03',
    keywords: [
      'scalp care for men',
      'scalp health routine men',
      'dandruff treatment men',
      'scalp serum men',
      'seborrheic dermatitis men',
      'scalp exfoliation men',
      'healthy scalp hair growth',
      'Minneapolis men grooming',
    ],
    content: [
      {
        type: 'intro',
        text: 'Scalp care is the most consequential and least practiced element of men\'s grooming. The logic is straightforward: hair grows from the scalp. A compromised scalp produces compromised hair. Yet most men\'s routines end at the hair shaft — conditioner, styler, done — while the skin beneath receives nothing.',
      },
      {
        type: 'h2',
        heading: 'What Is Actually Happening on Your Scalp',
        text: 'The scalp produces sebum — a natural oil that coats and protects the hair shaft. Too little, and the shaft becomes brittle and prone to breakage. Too much, and follicles become congested, creating a low-grade inflammatory environment that impairs the growth cycle. Most scalp issues — dandruff, flakiness, excess oiliness, itching — are symptoms of an imbalanced sebaceous system, not separate conditions that require separate solutions.',
      },
      {
        type: 'h2',
        heading: 'The Most Damaging Habits',
        text: 'Daily shampooing is the single most common driver of scalp imbalance. Hot water strips sebum, triggering the scalp to overproduce in response. The result is an oilier scalp than before — not cleaner. Washing with water that is too hot, using shampoos with sulfates, and applying conditioner directly to the scalp rather than the mid-shaft-to-end are the three habits most worth addressing immediately.',
      },
      {
        type: 'list',
        heading: 'A Minimal, Effective Scalp Routine',
        items: [
          'Wash two to three times per week with cool or lukewarm water — never hot',
          'Use a sulfate-free shampoo matched to your scalp type: clarifying for oily, moisturizing for dry',
          'Exfoliate once per week with a scalp scrub or salicylic acid treatment to clear buildup',
          'Apply a lightweight scalp serum (caffeine or niacinamide-based) on wash days before styling',
          'Perform a four-minute scalp massage daily — fingertips only, firm circular pressure',
        ],
      },
      {
        type: 'h2',
        heading: 'Dandruff: Fungal, Not Dry Skin',
        text: 'The persistent misconception about dandruff is that it is caused by dryness. In most cases, it is not. Dandruff — and the related condition seborrheic dermatitis — is driven by an overgrowth of the Malassezia yeast, which is naturally present on all scalps. When it proliferates beyond balance, it triggers inflammation and accelerated skin cell turnover, producing the visible flaking. Zinc pyrithione, selenium sulfide, and ketoconazole shampoos are clinically effective treatments. Use them twice weekly for four weeks, then taper to once weekly for maintenance.',
      },
      {
        type: 'h2',
        heading: 'Scalp Serums: The Category Worth Exploring',
        text: 'The scalp serum market has matured significantly in the last two years. Formulations containing caffeine, peptides, and niacinamide show measurable benefit in clinical settings — caffeine by blocking DHT at the follicle level, peptides by stimulating growth factor activity, niacinamide by reducing sebum overproduction and calming inflammation. Apply to a clean, damp scalp. Let absorb before styling. It takes thirty seconds.',
      },
      {
        type: 'closing',
        text: 'The condition of your scalp is visible in your hair. If the foundation is healthy, the results show. Our barbers at SAVRON can assess your scalp type during your appointment and recommend a routine that fits your specific situation — not a generic one-size approach.',
      },
    ],
  },

  {
    slug: 'fade-mastery-guide',
    title: 'Fade Mastery: Every Variation, Explained',
    subtitle: 'The fade is not one haircut — it is a family. Knowing the difference changes every conversation you have with your barber.',
    excerpt:
      'The fade has become the defining technical element of modern barbering. But the vocabulary around it remains loose and often misunderstood. Here is the precise language.',
    category: 'Barbering',
    readTime: '6 min read',
    publishedAt: 'June 3, 2026',
    publishedAtISO: '2026-06-03',
    keywords: [
      'types of fades haircut',
      'low fade vs high fade',
      'skin fade haircut',
      'drop fade haircut',
      'taper fade vs fade',
      'burst fade',
      'fade haircut guide men',
      'best barbershop Minneapolis fade',
    ],
    content: [
      {
        type: 'intro',
        text: 'The fade has become the defining technical element of modern barbering. What separates a good fade from a great one is gradient precision — the seamless graduation from skin or near-skin at the perimeter to full length at the top. But not all fades are the same, and the vocabulary matters. Knowing exactly what to ask for changes every conversation you have with your barber.',
      },
      {
        type: 'h2',
        heading: 'Taper vs. Fade: The Foundational Distinction',
        text: 'A taper leaves hair at the perimeter — it graduates shorter but does not reach skin. A fade graduates down to skin, or to a guard so short the difference is negligible. Tapers are generally more conservative and age well without maintenance. Fades are sharper, more defined, and require regular upkeep to maintain their line. The choice between them is a lifestyle question as much as an aesthetic one.',
      },
      {
        type: 'h2',
        heading: 'Low Fade',
        text: 'The fade begins just above the natural hairline — approximately one to two inches above the ear. This is the most understated of the fade family. It provides clean definition at the perimeter while preserving density through the sides and back. It suits formal environments and works well with longer tops, pompadours, and side parts. The low fade is the entry point for men who want structure without commitment.',
      },
      {
        type: 'h2',
        heading: 'Mid Fade',
        text: 'The fade begins at the level of the temple — roughly midway between the ear and the top of the head. It is the most versatile entry point, working across textures and lengths. The mid fade provides strong contrast without the severity of a high fade and photographs cleanly at any angle. Most modern textured crops and wolf cuts are built on a mid fade.',
      },
      {
        type: 'h2',
        heading: 'High Fade',
        text: 'The fade begins at or near the temple\'s upper edge, leaving only the crown and topmost section at length. It creates the highest contrast of any fade variation — dramatic, aggressive, and attention-demanding. High fades work best with clean, geometric tops: box cuts, hard-parted styles, and flat tops. They require the most frequent maintenance to stay sharp.',
      },
      {
        type: 'h2',
        heading: 'Skin Fade (Bald Fade)',
        text: 'Any of the above fades can be taken to skin — where the gradient reaches zero guard and bare skin is visible at the perimeter. The skin fade elevates the contrast of any style significantly. The technique demands a high level of precision from the barber, as any inconsistency in the gradient is immediately visible. At SAVRON, skin fades are blended through multiple guard sizes before a final pass with a straight razor along the hairline.',
      },
      {
        type: 'h2',
        heading: 'Drop Fade',
        text: 'Rather than following a straight horizontal line around the head, the drop fade curves downward behind the ear — dropping toward the neckline before rising back up. The effect adds a sculptural quality to the silhouette and pairs particularly well with French crops and medium-length styles. It softens the sharpness of a standard fade and works well for rounder face shapes by elongating the visual line of the jaw.',
      },
      {
        type: 'h2',
        heading: 'Burst Fade',
        text: 'The burst fade radiates outward from behind the ear in a semicircular pattern — literally bursting open from a single point. It is the most stylistically distinctive of the fade family, associated with mohawks, faux hawks, and afro-textured styles. The burst creates a focal point at the ear that draws the eye upward toward the topline. It is a committed aesthetic choice — there is nothing subtle about a burst fade.',
      },
      {
        type: 'callout',
        text: 'When booking, use the precise term and specify whether you want a skin finish or a short guard (e.g., #0.5 or #1). Providing a reference image removes ambiguity entirely.',
      },
      {
        type: 'h2',
        heading: 'Temple Fade (Edgar Fade)',
        text: 'The temple fade focuses specifically on the hairline at the temples — creating a sharp, defined line that frames the forehead. Often paired with a hard part and a flat, horizontal fringe, this style has significant roots in Latino barbering culture and is currently being adopted broadly across demographics. The key feature is the razor-sharp line at the temple, which requires both precision clippers and a practiced eye.',
      },
      {
        type: 'closing',
        text: 'Understanding what you are asking for is the first step toward getting it. Every barber at SAVRON is trained across the full fade spectrum — we work with your head shape, hair texture, and lifestyle to execute the right version. Not just a technically correct one.',
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
