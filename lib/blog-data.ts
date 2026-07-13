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
    slug: 'best-barbershop-minneapolis',
    title: 'The Best Barbershop in Minneapolis: Why SAVRON Leads the North Loop',
    subtitle: 'Craft, atmosphere, and consistency. What separates a great barbershop from the best one in the city.',
    excerpt:
      'Minneapolis has no shortage of barbershops. SAVRON stands apart as a luxury barbershop and lounge built on precision, hospitality, and a North Loop address that matches the standard of the work.',
    category: 'Barbering',
    readTime: '9 min read',
    publishedAt: 'July 8, 2026',
    publishedAtISO: '2026-07-08',
    keywords: [
      'best barbershop Minneapolis',
      'best barbershop Minnesota',
      'luxury barbershop Minneapolis',
      'top barber Minneapolis MN',
      'North Loop barbershop',
      'best fade Minneapolis',
      'men grooming Minneapolis',
      'SAVRON barbershop',
    ],
    content: [
      {
        type: 'intro',
        text: 'Ask ten people in Minneapolis where to get a great haircut and you will hear ten different answers. Ask where to get the best barbershop and lounge experience in the city, and the conversation narrows quickly. SAVRON Barbershop & Lounge in the North Loop has earned that reputation through technical consistency, a refined environment, and barbers who treat every appointment as craft, not volume.',
      },
      {
        type: 'h2',
        heading: 'What "best barbershop" actually means',
        text: 'The best barbershop is not the cheapest or the fastest. It is the shop where technique, consultation, and finish align every time you sit in the chair. That means fades that blend cleanly, beard lines that respect your bone structure, and a team that listens before they cut. In Minneapolis, where winters are harsh and professional standards are high, men want a shop that delivers a sharp result and a space worth returning to.',
      },
      {
        type: 'h2',
        heading: 'Why the North Loop is the right home for SAVRON',
        text: 'The North Loop is Minneapolis at its most intentional: converted warehouses, independent restaurants, design studios, and a walkable grid between downtown and the river. SAVRON sits at 250 N Third Avenue, minutes from Target Field, Nicollet Mall, and the Warehouse District. Clients book on lunch breaks, before events, and on weekend mornings because the location and the result both fit a city that moves fast but cares how it looks doing it.',
      },
      {
        type: 'list',
        heading: 'What clients consistently praise at SAVRON',
        items: [
          'Skin fades and tapers executed with clean gradients and sharp perimeter work',
          'Beard shaping and hot towel razor finish that photographs as well as it wears in person',
          'Consultations that account for hair texture, face shape, and how much maintenance you will actually do',
          'A lounge atmosphere that feels elevated without being stiff',
          'Online booking plus walk-in availability for flexible schedules',
          'Digital membership passes that track visits through Apple Wallet and Google Wallet',
        ],
      },
      {
        type: 'h2',
        heading: 'Technical range matters',
        text: 'A shop can only be "the best" if its barbers are fluent across styles. SAVRON covers the full modern toolkit: low and mid skin fades, drop fades, textured crops, French crops, beard architecture, and scalp-focused grooming advice. Whether you need a conservative taper for the office or a sharper fade for the weekend, the vocabulary and the execution live in the same building.',
      },
      {
        type: 'h2',
        heading: 'Barbershop and lounge: two words, one experience',
        text: 'SAVRON is deliberately a barbershop and lounge. The cut is the core product, but the environment signals that grooming is part of how you move through the world. Good music, clean lines, and unhurried chair time turn a twenty-minute appointment into something you plan around, not squeeze in resentfully. That combination is rare in Minneapolis and it is central to why regulars call SAVRON their home shop.',
      },
      {
        type: 'callout',
        text: 'New to SAVRON? Book online at savronmn.com/booking or walk in during shop hours. Bring one or two reference photos and tell your barber how often you want to maintain the shape.',
      },
      {
        type: 'h2',
        heading: 'How SAVRON compares to typical Minneapolis options',
        text: 'Chain quick-cut shops optimize for speed. Budget salons optimize for price. SAVRON optimizes for outcome and experience. You are paying for barbers who can explain why a mid fade suits your crown pattern, who will reset a beard line that drifted at home, and who treat repeat visits as a long-term grooming relationship. In a city with strong taste and cold weather that punishes neglected hair, that level of care compounds.',
      },
      {
        type: 'closing',
        text: 'If you are searching for the best barbershop in Minneapolis, Minnesota, start with the shop that treats fades, beards, and scalp health as one system and the lounge as part of the product. SAVRON is in the North Loop, open to appointments and walk-ins, and built for men who want to look sharp without thinking about it twice. Book your chair and see why the standard here is higher.',
      },
    ],
  },

  {
    slug: 'north-loop-barbershop-guide',
    title: 'North Loop Minneapolis Barbershop Guide: Grooming in the Warehouse District',
    subtitle: 'Where to get a precision cut when you live, work, or spend weekends in Minneapolis\'s most design-forward neighborhood.',
    excerpt:
      'The North Loop rewards intention. Your barbershop should too. Here is how to get the right cut, maintain it between visits, and why SAVRON fits this neighborhood.',
    category: 'Style Guide',
    readTime: '8 min read',
    publishedAt: 'July 5, 2026',
    publishedAtISO: '2026-07-05',
    keywords: [
      'North Loop barbershop',
      'barbershop Warehouse District Minneapolis',
      'haircut downtown Minneapolis',
      'best barber North Loop',
      'men haircut Minneapolis MN',
      'grooming near Target Field',
      'SAVRON North Loop',
    ],
    content: [
      {
        type: 'intro',
        text: 'The North Loop built its reputation on conversion: old warehouses into lofts, factories into restaurants, industrial quiet into one of the most desirable ZIP codes in Minneapolis. Men who live and work here tend to care about details. That makes barber choice a neighborhood decision, not just a convenience stop. SAVRON Barbershop & Lounge was built for exactly this audience.',
      },
      {
        type: 'h2',
        heading: 'Who the North Loop groomer is',
        text: 'North Loop regulars range from creative directors and founders to attorneys, athletes, and hospitality staff. What they share is visibility. You are on foot, in meetings, at rooftop events, and on camera more than the average suburban schedule allows. Your haircut and beard line do more work here. That raises the bar for fade consistency, neckline discipline, and products that survive Minnesota humidity swings.',
      },
      {
        type: 'h2',
        heading: 'Timing your appointment around the neighborhood',
        text: 'Lunch-hour slots fill fast near downtown. If you work in the North Loop or central business district, mid-week late morning or mid-afternoon appointments are the smoothest. Event-driven clients often book 48 hours before a wedding, launch party, or photo shoot so the fade has time to settle. Walk-ins are welcome at SAVRON, but booking guarantees chair time when the neighborhood is busiest.',
      },
      {
        type: 'list',
        heading: 'North Loop grooming checklist',
        items: [
          'Book standing appointments every three to four weeks if you wear a skin fade',
          'Carry a travel-size texture product for midday refresh after walking the district',
          'Schedule beard resets before lines grow soft around the jaw',
          'Use sulfate-free shampoo two to three times weekly in dry winter months',
          'Ask your barber about eyebrow grooming if your portrait schedule is heavy',
        ],
      },
      {
        type: 'h2',
        heading: 'Styles that fit the Warehouse District aesthetic',
        text: 'Clean mid fades with textured tops remain the North Loop default: sharp enough for client meetings, relaxed enough for weekend brunch on Washington Avenue. Beard architecture stays close and defined rather than bulky. Longer styles work when they are deliberate, with clear perimeter control so they read intentional under a North Loop winter coat.',
      },
      {
        type: 'h2',
        heading: 'Why locals choose SAVRON over driving to the suburbs',
        text: 'Suburban shops can be excellent, but they optimize for parking-lot convenience and family schedules. SAVRON optimizes for urban rhythm: walk in from Third Avenue, get a lounge-level service, and return to your day without a twenty-minute drive. For North Loop residents, that friction difference is the whole point.',
      },
      {
        type: 'callout',
        text: 'Visiting Target Field or a downtown show? SAVRON is a short walk from much of the North Loop and central Minneapolis. Book before game day if you want a fresh line for the stands.',
      },
      {
        type: 'h2',
        heading: 'Making the most of your first North Loop visit',
        text: 'Tell your barber where you work and how often you are on camera or in client-facing meetings. Mention if you commute on foot in winter under hats and hoods. Those details change product recommendations and fade height. The best North Loop barbershop visits start with context, not just a photo.',
      },
      {
        type: 'closing',
        text: 'The Warehouse District expects a certain standard. SAVRON meets it with barbershop precision and lounge hospitality at 250 N Third Avenue. Whether you are new to the neighborhood or a longtime North Loop regular, book online or walk in and align your grooming with the place you already chose to spend your time.',
      },
    ],
  },

  {
    slug: 'luxury-barbershop-lounge-minneapolis',
    title: 'Luxury Barbershop and Lounge in Minneapolis: What SAVRON Does Differently',
    subtitle: 'Beyond a haircut. The lounge model, the technical bar, and why men across the Twin Cities make the drive.',
    excerpt:
      'Luxury in barbering is not marble alone. It is time, technique, and an environment that respects the appointment. Here is how SAVRON defines barbershop and lounge in Minneapolis.',
    category: 'Barbering',
    readTime: '10 min read',
    publishedAt: 'July 1, 2026',
    publishedAtISO: '2026-07-01',
    keywords: [
      'luxury barbershop Minneapolis',
      'barbershop lounge Minneapolis',
      'high end barber Minneapolis',
      'premium mens grooming Minnesota',
      'best mens haircut Twin Cities',
      'SAVRON lounge',
      'upscale barbershop MN',
    ],
    content: [
      {
        type: 'intro',
        text: 'Luxury barbershop is an overused phrase. Too many shops borrow the aesthetic without investing in the barbering. SAVRON Barbershop & Lounge in Minneapolis treats luxury as a full stack: skilled hands, intentional space, reliable booking, and follow-through on beard, scalp, and membership services that extend beyond the chair.',
      },
      {
        type: 'h2',
        heading: 'Barbershop plus lounge: what the second word changes',
        text: 'A standard barbershop optimizes throughput. A lounge-forward barbershop optimizes experience. That means chair time that does not feel rushed, audio and lighting that calm rather than distract, and a team culture oriented toward consultation. Clients from Edina, Uptown, Northeast, and across the Twin Cities drive to SAVRON because the lounge layer makes the appointment feel like part of their week, not an errand they tolerate.',
      },
      {
        type: 'h2',
        heading: 'The technical bar for a luxury shop',
        text: 'Atmosphere without skill is decoration. SAVRON holds a high technical bar: multi-guard fade blending, straight-razor perimeter work, hot towel preparation, and beard symmetry checked from every angle. Luxury, in practice, is when you stop worrying whether the back blend will hold up under office lighting. You trust it will, because it always has.',
      },
      {
        type: 'list',
        heading: 'Signature elements of the SAVRON lounge experience',
        items: [
          'Consultation-first appointments: style, maintenance, and product fit discussed before clippers start',
          'Precision fades from low skin to drop and burst variations',
          'Beard architecture with razor-defined cheek and neckline geometry',
          'Scalp assessment and routine recommendations tied to Minnesota seasons',
          'Digital membership passes with visit tracking via Apple Wallet and Google Wallet',
          'Online booking with calendar sync for busy professionals',
        ],
      },
      {
        type: 'h2',
        heading: 'Who luxury barbering is for',
        text: 'You do not need a title or a dress code to belong in a luxury barbershop. You need standards. Executives, creatives, grooms, performers, and first-time fade clients all sit in the same chairs when they want reliable outcomes. SAVRON is especially strong for men who value time: one appointment that replaces a week of second-guessing in the mirror.',
      },
      {
        type: 'h2',
        heading: 'Membership and the long game',
        text: 'Luxury grooming is cumulative. SAVRON\'s digital membership program turns repeat visits into a tracked relationship. Your pass lives on your phone, visit counts update automatically, and the shop learns your preferences over time. That is lounge thinking applied to loyalty: less friction, more continuity.',
      },
      {
        type: 'h2',
        heading: 'Minneapolis seasonality and your grooming plan',
        text: 'Twin Cities winters dry scalps and flatten styles under beanies. Summers expose hairlines and beard perimeters to sun and sweat. A luxury shop plans for both. SAVRON barbers adjust fade height, top weight, and product recommendations by season so you are not fighting the climate every morning.',
      },
      {
        type: 'callout',
        text: 'Trying SAVRON for the first time? Mention if you are coming from another shop with a different fade map. Transition appointments are easier when your barber knows what grew out and what you want reset.',
      },
      {
        type: 'h2',
        heading: 'How to book the lounge experience',
        text: 'Reserve at savronmn.com/booking or walk in when you are in the North Loop. Bring references, be honest about maintenance appetite, and ask questions. The lounge model only works when communication is as polished as the fade.',
      },
      {
        type: 'closing',
        text: 'If you want a luxury barbershop and lounge in Minneapolis, Minnesota, SAVRON is the reference point in the North Loop address, technical depth, and an environment that treats grooming as part of how you show up. Book your appointment and set the bar higher.',
      },
    ],
  },

  {
    slug: 'barber-craftsmanship-minneapolis',
    title: 'Barber Craftsmanship: Why Detail Beats Speed in a Minneapolis Barbershop',
    subtitle: 'High quality grooming is not a faster clipper. It is time, technique, and a barber who refuses to rush the finish.',
    excerpt:
      'The best barbershops in Minneapolis are built on craftsmanship, not turnover. Here is what that means in the chair: consultation, precision, and finishing work that separates a good cut from a great one.',
    category: 'Barbering',
    readTime: '9 min read',
    publishedAt: 'July 10, 2026',
    publishedAtISO: '2026-07-10',
    keywords: [
      'barber craftsmanship Minneapolis',
      'high quality mens haircut',
      'attention to detail barbershop',
      'luxury barber Minneapolis',
      'professional mens grooming MN',
      'SAVRON craftsmanship',
      'premium barbershop North Loop',
    ],
    content: [
      {
        type: 'intro',
        text: 'A barbershop can sound like a lawnmower and still produce something that passes from ten feet away. Up close, the story is different: uneven blend, rushed neckline, a top that was never shaped for your head. Craftsmanship is the opposite of that experience. At SAVRON Barbershop & Lounge in Minneapolis, every appointment is built around deliberate technique, not how many chairs can be turned in an hour.',
      },
      {
        type: 'h2',
        heading: 'What craftsmanship actually means in barbering',
        text: 'Craftsmanship is not a marketing word. It is a set of visible decisions: guard transitions that disappear into the top, cheek lines that follow your bone structure, and a finish that holds under office lighting and street photography. It also means saying no to shortcuts. No guessing on recession lines. No skipping the consultation because the next client is waiting. The best Minneapolis barbers treat each head as a unique project, not a template.',
      },
      {
        type: 'h2',
        heading: 'Speed culture vs. quality culture',
        text: 'Corporate barbershop models often reward volume. Artists under pressure move clients in and out, and small imperfections compound into a haircut that looks generic. Independent, craft-focused shops flip that incentive. Barbers are measured on repeat bookings, referrals, and the kind of work clients are proud to walk into a meeting with. SAVRON was designed around that quality culture: lounge pacing, consultation time, and technical standards that do not bend when the schedule fills up.',
      },
      {
        type: 'list',
        heading: 'Where craftsmanship shows up in your appointment',
        items: [
          'Consultation before clippers: head shape, hair texture, growth patterns, and maintenance honesty',
          'Fade work through multiple guard passes, not a single aggressive blend',
          'Scissor-over-comb and point cutting on top for movement, not blunt weight',
          'Beard and neckline geometry checked from front, side, and three-quarter angles',
          'Hot towel prep and razor finish where the style calls for it',
          'Final styling with product matched to your hair type and daily routine',
        ],
      },
      {
        type: 'h2',
        heading: 'The relationship between barber and client',
        text: 'Craftsmanship deepens when your barber knows how you actually live. Do you wear a hard hat, a helmet, or a beanie six months a year? Do you need a conservative line for client-facing work or a sharper fade for weekends? That context changes guard height, top weight, and product choice. Shops that prioritize craft build long-term relationships because the work improves every visit. Your barber learns what grew out well, what needed adjustment, and what you will realistically maintain.',
      },
      {
        type: 'callout',
        text: 'If your last haircut looked fine for two days and then fell apart, that is usually a craft issue, not a styling issue. Book a consultation-heavy appointment at SAVRON and compare the grow-out.',
      },
      {
        type: 'h2',
        heading: 'High quality service is all-inclusive, not upsell-driven',
        text: 'Premium barbering should not feel like a menu of hidden charges. A high quality service includes the full experience: wash when appropriate, precise cut, thoughtful styling, and clear aftercare guidance. You should leave knowing what products were used, why they were chosen, and when to come back. That transparency is part of craftsmanship. You are paying for outcomes and education, not surprise add-ons at checkout.',
      },
      {
        type: 'h2',
        heading: 'Why Minneapolis men notice the difference',
        text: 'Twin Cities professionals compete on presentation in ways that are subtle but real. A sharp fade, clean beard architecture, and healthy scalp read as discipline before you speak. Craftsmanship is how you signal that discipline without trying. In a North Loop barbershop and lounge built for that standard, the mirror test is the only marketing that matters.',
      },
      {
        type: 'closing',
        text: 'SAVRON exists for men who care how the details look on day seven, not just day one. If you want barber craftsmanship in Minneapolis, Minnesota, book at savronmn.com/booking or walk into our North Loop lounge. Bring your standards. We match them in the chair.',
      },
    ],
  },

  {
    slug: 'consultation-first-haircut-guide',
    title: 'The Consultation-First Haircut: How Top Barbers Customize Every Style',
    subtitle: 'Fade or scissor cut, short or medium length. The right answer starts with your head shape and lifestyle, not a trend photo.',
    excerpt:
      'A high quality haircut begins before the first clipper buzz. Here is what a real consultation covers and how SAVRON barbers tailor fades, tapers, and scissor work to you.',
    category: 'Style Guide',
    readTime: '8 min read',
    publishedAt: 'July 11, 2026',
    publishedAtISO: '2026-07-11',
    keywords: [
      'barber consultation mens haircut',
      'custom haircut Minneapolis',
      'fade vs scissor cut men',
      'haircut for head shape',
      'mens hairstyle consultation',
      'SAVRON barber consultation',
      'personalized mens grooming',
    ],
    content: [
      {
        type: 'intro',
        text: 'Walking in with a reference photo is smart. Walking in without a conversation is a gamble. The best barbershops in Minneapolis treat consultation as the product, not a preamble. Your head shape, hair density, cowlicks, and weekly routine matter as much as the image on your phone. SAVRON barbers start there every time.',
      },
      {
        type: 'h2',
        heading: 'Head shape and hair behavior',
        text: 'Round, oval, square, and diamond face shapes each favor different fade heights and top lengths. Cowlicks at the crown or temple can fight a clean part if they are ignored. Fine hair needs different weight removal than coarse hair. A consultation names these variables out loud so the cut is designed around your anatomy, not copied from someone with a different skull and strand type.',
      },
      {
        type: 'h2',
        heading: 'Not every great cut is a skin fade',
        text: 'Fades dominate social feeds, but scissor cuts and tapers remain some of the most wearable, professional styles in Minneapolis offices. A standard cut with a blended or disconnected undercut can look sharper than an over-faded silhouette on the wrong head shape. Medium length styles add options: layers, flow backs, textured tops, and controlled perimeters that grow out gracefully. Your barber should tell you when a fade is the right tool and when scissor architecture will serve you better.',
      },
      {
        type: 'list',
        heading: 'Questions a strong consultation should cover',
        items: [
          'How often will you realistically visit the shop for maintenance?',
          'Do you style at home daily, or do you need a low-effort default shape?',
          'What is your work dress code and social calendar this season?',
          'Are you growing length on top, or keeping it tight for the next three months?',
          'Do you wear hats, helmets, or headphones that affect how the sides sit?',
          'Are beard and eyebrow lines part of this appointment or a separate focus?',
        ],
      },
      {
        type: 'h2',
        heading: 'Fade customization: low, mid, high, and skin',
        text: 'If you choose a fade, precision language matters. How short should the bottom land: true skin, a #1, or a #2? How high should the transition start: low near the temple, mid at the ear, or high for maximum contrast? A low fade stretches the gradient and reads subtle under business attire. A high fade compresses contrast and pairs with bold tops. Your consultation should map those choices to your face and wardrobe, not just your Pinterest board.',
      },
      {
        type: 'h2',
        heading: 'Medium and longer lengths done with intention',
        text: 'Hair between the ears and shoulders opens real styling range when the cut is intentional. Layers create movement without bulk. Tapered sides keep the silhouette clean while the top grows. Undercuts let you tie back or push forward depending on the week. None of that works without a plan. Consultation-first barbers document the plan in how they section, clip, and texturize, so you leave with a style roadmap, not just shorter hair.',
      },
      {
        type: 'callout',
        text: 'Bring two or three photos, but let your SAVRON barber tell you which elements will actually work on your hair. Adaptation is customization. Replication is luck.',
      },
      {
        type: 'h2',
        heading: 'Aftercare as part of the consultation',
        text: 'A customized cut includes customized maintenance advice. Product type, blow-dry direction, brush choice, and re-booking interval should match the style you chose. That is the difference between a haircut that collapses on day four and one that still looks intentional at week three. High quality service ends with clarity, not confusion.',
      },
      {
        type: 'closing',
        text: 'The consultation-first approach is how SAVRON delivers luxury barbering in Minneapolis without guesswork. Book online or walk in to our North Loop shop, talk through your goals, and leave with a cut built for your head, not just the trend cycle.',
      },
    ],
  },

  {
    slug: 'hot-towel-barbershop-finish',
    title: 'The Hot Towel Finish: Traditional Barbershop Craft in a Modern Lounge',
    subtitle: 'Shampoo, hot towel, razor line, and styling. Why finishing separates premium barbershops from quick-cut shops.',
    excerpt:
      'Craftsmanship does not end when the clippers stop. The hot towel ritual, neckline detail, and professional styling are what make a Minneapolis barbershop visit feel complete.',
    category: 'Barbering',
    readTime: '8 min read',
    publishedAt: 'July 12, 2026',
    publishedAtISO: '2026-07-12',
    keywords: [
      'hot towel shave Minneapolis',
      'traditional barbershop finish',
      'beard line up barber',
      'premium barbershop service',
      'mens grooming ritual',
      'SAVRON hot towel',
      'luxury barbershop experience',
    ],
    content: [
      {
        type: 'intro',
        text: 'Anyone can shorten hair. Fewer shops finish it. The traditional barbershop sequence, hot towel, precise line work, cleanse, and style, is where craftsmanship becomes something you feel, not just see. SAVRON Barbershop & Lounge keeps that ritual alive inside a modern Minneapolis lounge because the finish is half the appointment.',
      },
      {
        type: 'h2',
        heading: 'Why the hot towel still matters',
        text: 'Heat softens the skin, opens pores, and relaxes the neck muscles that tighten under clippers. A proper hot towel pass calms irritation before razor work and makes perimeter lines sharper with less drag. It also signals pacing. You are not being rushed out mid-fluff. You are in a chair where the last ten minutes are protected for quality, the same way the first ten minutes are protected for consultation.',
      },
      {
        type: 'h2',
        heading: 'Line-ups, necklines, and beard architecture',
        text: 'Beard shaping is geometry. Cheek lines should follow growth, not fantasy. Necklines should sit two finger widths above the Adam\'s apple and curve naturally under the jaw. A hot towel straight-razor pass cleans the perimeter and removes the fuzzy edge that home trimmers leave behind. This is the craftsmanship clients notice in elevator mirrors and conference room cameras, even when they cannot name what changed.',
      },
      {
        type: 'list',
        heading: 'What a full-service finish includes at a premium shop',
        items: [
          'Removal of loose clippings and skin refresh after the cut',
          'Targeted shampoo when needed to clear residue and prep for styling',
          'Hot towel application before detailed razor or trimmer line work',
          'Beard and sideburn symmetry checked at multiple angles',
          'Styling with professional-grade product suited to your hair type',
          'Honest rebooking guidance based on your fade height and growth rate',
        ],
      },
      {
        type: 'h2',
        heading: 'Styling is not an afterthought',
        text: 'High quality barbershops do not hand you a mirror while your hair is still dusty with clippings. Styling proves the cut works in the real world. A matte clay on thick hair. A light cream on fine hair. A blow-dry direction that trains your recession the way you will repeat at home. The goal is to leave looking finished, not merely shorter. That is the lounge standard SAVRON clients expect from a North Loop appointment.',
      },
      {
        type: 'h2',
        heading: 'Craftsmanship you can maintain at home',
        text: 'The best finish includes teaching. Your barber should show you where the neckline was set, which product amount actually works, and which spots will need professional reset in three or four weeks. Maintenance is part of the service philosophy. Craftsmanship is not creating dependence. It is creating a standard you can recognize when it slips.',
      },
      {
        type: 'callout',
        text: 'Booking beard shaping or a fade at SAVRON? Ask for the full finish. The difference is visible in natural light and in how confident you feel walking back into the North Loop after the appointment.',
      },
      {
        type: 'h2',
        heading: 'Ambiance and craft belong together',
        text: 'A flickering fluorescent shop can still cut hair. It rarely inspires loyalty. Lounge ambiance, clean audio, intentional lighting, and unhurried chair time reinforce that your appointment is a craft service, not a commodity. Minneapolis has plenty of quick options. Men who choose SAVRON choose a barbershop and lounge where craftsmanship, hot towel finishing, and high quality service are the default, not the upgrade.',
      },
      {
        type: 'closing',
        text: 'Experience the full sequence at SAVRON Barbershop & Lounge, 250 N Third Avenue in Minneapolis. Book your appointment at savronmn.com/booking or walk in when you are ready for a cut that is finished the way traditional barbering intended.',
      },
    ],
  },

  {
    slug: 'scissor-cuts-and-medium-length-styles',
    title: 'Beyond the Fade: Scissor Cuts and Medium-Length Styles for Minneapolis Men',
    subtitle: 'Not every sharp look requires scalp exposure. Scissor architecture, tapers, and medium length cuts built with the same craft as a skin fade.',
    excerpt:
      'High quality barbering is more than fades. Learn when scissor cuts, tapers, and medium-length styles are the better choice for your head shape and professional life in Minneapolis.',
    category: 'Style Guide',
    readTime: '9 min read',
    publishedAt: 'July 13, 2026',
    publishedAtISO: '2026-07-13',
    keywords: [
      'scissor cut mens hair Minneapolis',
      'medium length mens haircut',
      'taper haircut men',
      'non fade mens haircut',
      'professional mens haircut Minneapolis',
      'undercut medium hair men',
      'SAVRON scissor cut',
    ],
    content: [
      {
        type: 'intro',
        text: 'Minneapolis barbershop culture talks a lot about fades. That makes sense: a clean gradient is one of the hardest technical skills to master. But craftsmanship also lives in scissor-only work, controlled tapers, and medium-length styles that grow out with dignity. SAVRON barbers spend equal care on clients who never want to show scalp and clients who want a razor-sharp skin fade.',
      },
      {
        type: 'h2',
        heading: 'When a scissor cut beats a fade',
        text: 'If your workplace is conservative, your hair is fine or thinning at the crown, or you dislike frequent touch-ups, a scissor cut with tapered sides may outperform a high skin fade. You keep more perimeter density, soften facial angles, and extend time between appointments. The craft shows in shear work: even weight, clean perimeter, and a top shaped to how your hair actually grows.',
      },
      {
        type: 'h2',
        heading: 'Short styles without maximum contrast',
        text: 'Short does not always mean bald. A #2 or #3 guard with scissor work on top delivers a disciplined look that survives Minneapolis winters under hats better than a fresh zero fade. Disconnected undercuts add edge when you want separation without shaving the sides clean. Your barber should recommend contrast level based on density and lifestyle, not default to the shortest option.',
      },
      {
        type: 'h2',
        heading: 'Medium length: layers, flow, and control',
        text: 'Medium hair, grazing the ears or collar, unlocks styles that fades cannot replicate. Layered texture for a natural finish. Tapered sides that narrow the silhouette while the top keeps movement. Growth toward a flow back or man bun with a shaped undercut foundation. These cuts demand consultation and sectioning discipline. They are not "just grow it out." They are architecture with a longer timeline.',
      },
      {
        type: 'list',
        heading: 'Popular medium-length directions at craft barbershops',
        items: [
          'Layered scissor cut with natural texture and soft fringe',
          'Tapered sides with longer top brushed back for business settings',
          'Undercut base preparing for tied-back or top knot styles',
          'Controlled mullet-influenced shape with clean temple work',
          'Scissor crop with blunt or point-cut fringe for fine hair',
        ],
      },
      {
        type: 'h2',
        heading: 'Professional polish without trendy extremes',
        text: 'Law firms, clinics, sales floors, and hospitality leadership roles still favor grooming that reads competent and calm. Medium and scissor-short styles signal that polish when they are cut with intention. Uneven perimeter, bulky crown weight, or undefined neckline reads sloppy within a week. Craftsmanship keeps the silhouette intentional through the grow-out phase, which is where cheap cuts fail.',
      },
      {
        type: 'h2',
        heading: 'Maintenance reality check',
        text: 'Medium styles need trimming every six to eight weeks to hold shape. Short scissor cuts often need four to five. Your barber should set that expectation in the consultation so you are not surprised when the style softens. High quality service includes that honesty. SAVRON books standing appointments so maintenance stays automatic, not a crisis fix before an event.',
      },
      {
        type: 'callout',
        text: 'Not sure whether to fade or scissor? Bring your calendar and your dress code to the consultation. The right cut fits both.',
      },
      {
        type: 'closing',
        text: 'SAVRON Barbershop & Lounge in Minneapolis builds fades, tapers, and scissor cuts with the same craftsmanship standard. Book at savronmn.com/booking and ask for the approach that fits your length goals, not just the trend of the month.',
      },
    ],
  },

  {
    slug: 'summer-2026-haircuts',
    title: 'Summer 2026 Haircuts: The Cuts Defining the Season',
    subtitle: 'From textured crops to modern fades: what to ask for at your next appointment.',
    excerpt:
      'Every summer rewrites the rule book. This one is no different. The cuts dominating chairs in 2026 share a common thread: structure with intention, volume with restraint.',
    category: 'Style Guide',
    readTime: '8 min read',
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
        heading: 'The Textured Crop: Reinvented',
        text: 'The crop has evolved. What started as a blunt, close-cropped style has matured into something more deliberate. This summer, expect to see textured tops with a slight forward fringe, weight taken out through the midsection, leaving movement on the surface. Paired with a low or mid fade, it reads modern without chasing trends.',
      },
      {
        type: 'callout',
        text: 'Ask your barber for: "textured crop with a low skin fade, disconnected at the sides, light point-cut on top."',
      },
      {
        type: 'h2',
        heading: 'The Wolf Cut: Tamed for 2026',
        text: 'Last season\'s wolf cut was raw and somewhat untamed. This summer it arrives refined. More layering through the crown, less bulk at the perimeter, and a defined recession-line trim that gives it an intentional silhouette. It works best on medium-to-thick hair and benefits enormously from quality texture cream.',
      },
      {
        type: 'h2',
        heading: 'Curtain Bangs: The Quiet Comeback',
        text: 'Curtain bangs on men have been quietly building momentum for two years. In 2026 they land squarely in the mainstream, but the version worth wearing is minimal. The bang should fall to the brow, part naturally in the center, and blend seamlessly into a longer top. Avoid the temptation to over-style it. The entire point is the ease.',
      },
      {
        type: 'h2',
        heading: 'The Modern Skin Fade',
        text: 'The skin fade is not new, but its current iteration is more precise than ever. Barbers are working lower, starting the fade from the neckline up and blending with a tighter gradient. The result is a cleaner line between skin and hair that photographs sharply and holds throughout the day. High skin fades are giving way to mid and low versions that feel less stark against natural hair growth.',
      },
      {
        type: 'h2',
        heading: 'The French Crop with Drop Fade',
        text: 'A perennial in European barbershops, the French crop with a drop fade is having its American moment. The drop fade, where the fade curves down behind the ear rather than maintaining a straight line, adds dimension and a slight aggression to what is otherwise a clean, contained look. The combination rewards regular maintenance, which is exactly why booking a standing appointment pays off.',
      },
      {
        type: 'h3',
        heading: 'What to Bring to Your Appointment',
        text: 'Reference images matter. Even for experienced barbers, a clear photo communicates proportion, texture preference, and finish better than any verbal description. Bring two or three images, not to replicate exactly, but to anchor the conversation.',
      },
      {
        type: 'h2',
        heading: 'Summer maintenance in Minneapolis',
        text: 'Humidity and sun exposure change how fine hair sits and how coarse hair expands. Plan on slightly shorter perimeter work in July and August, and ask your barber about a lighter top weight if you wear hats at Twins games or on the riverfront. A standing three-week rhythm keeps summer styles intentional instead of grown-out.',
      },
      {
        type: 'p',
        text: 'At SAVRON in the North Loop, summer appointments often pair a fade refresh with beard line cleanup and optional eyebrow grooming. Treat the season as a full presentation reset, not just a shorter guard on the sides.',
      },
      {
        type: 'closing',
        text: 'The best haircut is not always the trendiest one. It is the one built for your structure. Every cut at SAVRON begins with that conversation. Book your appointment and let\'s find the version that works for you.',
      },
    ],
  },

  {
    slug: 'science-of-hair-growth',
    title: 'The Science of Hair Growth: What Your Barber Wants You to Know',
    subtitle: 'Understanding your hair cycle changes how you care for it and how fast it actually grows.',
    excerpt:
      'Hair growth is not linear, and it is not passive. The scalp is a living ecosystem. Understanding its mechanics shifts you from reactive to proactive.',
    category: 'Hair Health',
    readTime: '9 min read',
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
        text: 'Hair growth is not linear, and it is not passive. The scalp is a living ecosystem that responds to what you eat, how you sleep, and how consistently you care for it. Understanding the mechanics shifts you from reactive maintenance to intentional growth.',
      },
      {
        type: 'h2',
        heading: 'The Three Phases Every Strand Goes Through',
        text: 'Each hair follicle operates on its own independent clock, cycling through three distinct phases. The anagen phase is the active growth period: lasting two to seven years, depending on genetics. The catagen phase is a brief two-week transition where growth stops. And telogen is the resting phase, lasting roughly three months before the follicle sheds and resets. At any given moment, roughly 85% of your hair is in anagen. When that percentage drops: due to stress, hormonal shifts, or poor nutrition: shedding accelerates noticeably.',
      },
      {
        type: 'h2',
        heading: 'DHT: The Hormone No One Talks About Enough',
        text: 'Dihydrotestosterone, or DHT, is the primary driver of male pattern hair loss. It is a derivative of testosterone that binds to receptors in the follicle, gradually miniaturizing it over successive cycles. Sensitivity to DHT is largely genetic, but sensitivity is not destiny. Topical minoxidil and oral finasteride remain the two clinically validated interventions. If you are seeing recession, speak to a dermatologist early. Early intervention preserves significantly more ground than late action.',
      },
      {
        type: 'h2',
        heading: 'The Scalp Microbiome',
        text: 'The scalp hosts a microbiome just as the gut does. When it is balanced, follicles function without interference. When it is disrupted: through harsh shampoos, over-washing, or product buildup: inflammation sets in at the follicle level. That inflammation shortens the anagen phase. The practical implication: wash with a sulfate-free shampoo two to three times per week. No more, no less.',
      },
      {
        type: 'list',
        heading: 'Nutrients That Directly Support Hair Growth',
        items: [
          'Biotin (Vitamin B7): supports keratin infrastructure; found in eggs, almonds, and sweet potatoes',
          'Iron: low ferritin is one of the most common and overlooked causes of excess shedding in men',
          'Zinc: regulates DHT production and supports follicle repair',
          'Vitamin D: follicle receptors depend on adequate levels to enter and sustain the anagen phase',
          'Omega-3 fatty acids: reduce follicle inflammation and improve scalp circulation',
        ],
      },
      {
        type: 'h2',
        heading: 'Does Cutting Your Hair Make It Grow Faster?',
        text: 'No. Hair grows from the follicle, not from the tip. Trimming has no biological effect on growth rate. What it does is remove split ends that would otherwise travel up the shaft, causing breakage that makes hair appear thinner and shorter over time. Regular trims maintain the integrity of what is already growing.',
      },
      {
        type: 'h2',
        heading: 'Scalp Massage: A Simple Practice With Real Evidence',
        text: 'A 2019 study published in Dermatology and Therapy found that consistent daily scalp massage, four minutes per day over twenty-four weeks, increased hair thickness in participants. The mechanism is mechanical stimulation of the dermal papilla cells at the follicle base. No product required. Just consistent, firm circular pressure with your fingertips.',
      },
      {
        type: 'h2',
        heading: 'What your barber sees before you do',
        text: 'Recession patterns, crown thinning, and breakage from over-styling show up in the chair before they feel urgent at home. SAVRON barbers flag these early and adjust cut shape to work with density changes. That might mean a slightly longer top for coverage, a softer fade transition, or a referral to a dermatologist when medical intervention makes sense.',
      },
      {
        type: 'p',
        text: 'Hair health is a partnership. Products and nutrition handle the biology. Your barber handles the architecture on top. Neglect either side and the mirror tells the story.',
      },
      {
        type: 'closing',
        text: 'The barbers at SAVRON approach grooming as a long game. A great haircut today is only part of the equation. The foundation beneath it matters just as much. Our team can recommend products and routines aligned with your specific hair type and goals.',
      },
    ],
  },

  {
    slug: 'beard-architecture',
    title: 'Beard Architecture: How to Grow, Shape, and Maintain a Beard Worth Keeping',
    subtitle: 'A beard is not an accident. It is a decision made every morning.',
    excerpt:
      'There is a point in every beard\'s life where it either becomes intentional or becomes neglect. The difference is maintenance and knowing what that actually means.',
    category: 'Beard Care',
    readTime: '10 min read',
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
        text: 'There is a point in every beard\'s life where it either becomes intentional or becomes neglect. The line between the two is thinner than most men realize. Architecture, understanding proportion, symmetry, and maintenance, is what separates a distinguished beard from an unfinished thought.',
      },
      {
        type: 'h2',
        heading: 'The First Eight Weeks: Resist the Urge to Trim',
        text: 'The most common mistake in beard growing is trimming too early. Beard hair grows at different rates across the face. The mustache tends to lead, the chin follows, the cheeks come last. The uneven phase at weeks three and four is temporary, not your final result. Commit to eight weeks before making any shaping decisions. This gives you the full canvas.',
      },
      {
        type: 'h2',
        heading: 'Understanding Your Beard Line',
        text: 'The neckline is where most home grooming goes wrong. Too high, and the beard appears to float without a base. Too low, and it loses definition entirely. The correct neckline sits two finger-widths above the Adam\'s apple and curves naturally behind the jaw. The cheek line should follow the natural edge of your beard growth, enhanced, not invented. Forcing a cheek line higher than your growth creates a geometric shape that reads artificial.',
      },
      {
        type: 'callout',
        text: 'A professional beard shaping at SAVRON takes 20–30 minutes and serves as a template you can maintain at home for the following four to six weeks.',
      },
      {
        type: 'h2',
        heading: 'Beard Oil vs. Beard Balm: When to Use Each',
        text: 'Both serve different functions and the best routines use both. Beard oil is a carrier oil blend (jojoba, argan, sweet almond) that hydrates the skin beneath the beard and conditions the hair shaft from root to tip. It absorbs fully and leaves no residue. Use it daily after washing. Beard balm adds a beeswax component that provides light hold and definition. It is not a styling product per se. It tames flyaways and seals the conditioning work the oil started. Use it after the oil, on towel-dried beard.',
      },
      {
        type: 'list',
        heading: 'The Daily Beard Maintenance Stack',
        items: [
          'Wash two to three times per week with a dedicated beard wash, not face soap or shampoo',
          'Apply beard oil daily, massaging into the skin beneath',
          'Follow with beard balm on days when shape and flyaway control are needed',
          'Brush daily with a boar bristle brush to train direction and distribute product evenly',
          'Trim weekly along the neckline with a precision trimmer to maintain the boundary',
        ],
      },
      {
        type: 'h2',
        heading: 'The Best Beard Styles Carrying Into 2026',
        text: 'The heavy, full beard that dominated the 2010s has given way to more sculpted, considered shapes. The medium boxed beard: full but trimmed to a consistent length with sharp neckline and cheek lines: remains the most versatile option for professional settings. The short stubble at five to seven millimeters is experiencing renewed interest as men recognize its capacity to sharpen jawline definition without committing to a maintenance-heavy full beard. And the extended goatee: a goatee that flows naturally into a slightly longer chin beard: is the most technically demanding of the current styles but rewards the effort.',
      },
      {
        type: 'h2',
        heading: 'When to See a Barber vs. Maintain at Home',
        text: 'Home maintenance is for preservation. Professional work is for shaping and resetting. If your beard has lost its line, grown asymmetric, or you are experimenting with a new style, that is a barber conversation. The tools available at a professional level, straight razors, precise clippers, trained eye, produce a result that home trimming cannot replicate. Think of barber visits as establishing the architecture, and daily care as protecting it.',
      },
      {
        type: 'h2',
        heading: 'Minneapolis winters and beard density',
        text: 'Dry indoor heat and cold outdoor air pull moisture from coarse facial hair faster than most men realize. Increase beard oil frequency from November through March, reduce harsh soaps, and book a mid-winter shape reset at SAVRON so lines stay intentional under scarves and collars.',
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
    readTime: '7 min read',
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
        text: 'Scalp care is the most consequential and least practiced element of men\'s grooming. The logic is straightforward: hair grows from the scalp. A compromised scalp produces compromised hair. Yet most men\'s routines end at the hair shaft (conditioner, styler, done) while the skin beneath receives nothing.',
      },
      {
        type: 'h2',
        heading: 'What Is Actually Happening on Your Scalp',
        text: 'The scalp produces sebum: a natural oil that coats and protects the hair shaft. Too little, and the shaft becomes brittle and prone to breakage. Too much, and follicles become congested, creating a low-grade inflammatory environment that impairs the growth cycle. Most scalp issues: dandruff, flakiness, excess oiliness, itching: are symptoms of an imbalanced sebaceous system, not separate conditions that require separate solutions.',
      },
      {
        type: 'h2',
        heading: 'The Most Damaging Habits',
        text: 'Daily shampooing is the single most common driver of scalp imbalance. Hot water strips sebum, triggering the scalp to overproduce in response. The result is an oilier scalp than before, not cleaner. Washing with water that is too hot, using shampoos with sulfates, and applying conditioner directly to the scalp rather than the mid-shaft-to-end are the three habits most worth addressing immediately.',
      },
      {
        type: 'list',
        heading: 'A Minimal, Effective Scalp Routine',
        items: [
          'Wash two to three times per week with cool or lukewarm water: never hot',
          'Use a sulfate-free shampoo matched to your scalp type: clarifying for oily, moisturizing for dry',
          'Exfoliate once per week with a scalp scrub or salicylic acid treatment to clear buildup',
          'Apply a lightweight scalp serum (caffeine or niacinamide-based) on wash days before styling',
          'Perform a four-minute scalp massage daily: fingertips only, firm circular pressure',
        ],
      },
      {
        type: 'h2',
        heading: 'Dandruff: Fungal, Not Dry Skin',
        text: 'The persistent misconception about dandruff is that it is caused by dryness. In most cases, it is not. Dandruff and the related condition seborrheic dermatitis are driven by an overgrowth of the Malassezia yeast, which is naturally present on all scalps. When it proliferates beyond balance, it triggers inflammation and accelerated skin cell turnover, producing the visible flaking. Zinc pyrithione, selenium sulfide, and ketoconazole shampoos are clinically effective treatments. Use them twice weekly for four weeks, then taper to once weekly for maintenance.',
      },
      {
        type: 'h2',
        heading: 'Scalp Serums: The Category Worth Exploring',
        text: 'The scalp serum market has matured significantly in the last two years. Formulations containing caffeine, peptides, and niacinamide show measurable benefit in clinical settings. Caffeine may help at the follicle level, peptides stimulate growth factor activity, and niacinamide reduces sebum overproduction and calms inflammation. Apply to a clean, damp scalp. Let absorb before styling. It takes thirty seconds.',
      },
      {
        type: 'h2',
        heading: 'Bring scalp care into the barber chair',
        text: 'Ask for a scalp check during your fade appointment. Flaking at the perimeter, redness at the part, or oily buildup at the crown all change how your barber approaches the cut and what they recommend between visits. SAVRON treats scalp health as part of the service, not an afterthought.',
      },
      {
        type: 'closing',
        text: 'The condition of your scalp is visible in your hair. If the foundation is healthy, the results show. Our barbers at SAVRON can assess your scalp type during your appointment and recommend a routine that fits your specific situation, not a generic one-size approach.',
      },
    ],
  },

  {
    slug: 'fade-mastery-guide',
    title: 'Fade Mastery: Every Variation, Explained',
    subtitle: 'The fade is not one haircut. It is a family. Knowing the difference changes every conversation you have with your barber.',
    excerpt:
      'The fade has become the defining technical element of modern barbering. But the vocabulary around it remains loose and often misunderstood. Here is the precise language.',
    category: 'Barbering',
    readTime: '8 min read',
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
        text: 'The fade has become the defining technical element of modern barbering. What separates a good fade from a great one is gradient precision: the seamless graduation from skin or near-skin at the perimeter to full length at the top. But not all fades are the same, and the vocabulary matters. Knowing exactly what to ask for changes every conversation you have with your barber.',
      },
      {
        type: 'h2',
        heading: 'Taper vs. Fade: The Foundational Distinction',
        text: 'A taper leaves hair at the perimeter. It graduates shorter but does not reach skin. A fade graduates down to skin, or to a guard so short the difference is negligible. Tapers are generally more conservative and age well without maintenance. Fades are sharper, more defined, and require regular upkeep to maintain their line. The choice between them is a lifestyle question as much as an aesthetic one.',
      },
      {
        type: 'h2',
        heading: 'Low Fade',
        text: 'The fade begins just above the natural hairline: approximately one to two inches above the ear. This is the most understated of the fade family. It provides clean definition at the perimeter while preserving density through the sides and back. It suits formal environments and works well with longer tops, pompadours, and side parts. The low fade is the entry point for men who want structure without commitment.',
      },
      {
        type: 'h2',
        heading: 'Mid Fade',
        text: 'The fade begins at the level of the temple: roughly midway between the ear and the top of the head. It is the most versatile entry point, working across textures and lengths. The mid fade provides strong contrast without the severity of a high fade and photographs cleanly at any angle. Most modern textured crops and wolf cuts are built on a mid fade.',
      },
      {
        type: 'h2',
        heading: 'High Fade',
        text: 'The fade begins at or near the temple\'s upper edge, leaving only the crown and topmost section at length. It creates the highest contrast of any fade variation: dramatic, aggressive, and attention-demanding. High fades work best with clean, geometric tops: box cuts, hard-parted styles, and flat tops. They require the most frequent maintenance to stay sharp.',
      },
      {
        type: 'h2',
        heading: 'Skin Fade (Bald Fade)',
        text: 'Any of the above fades can be taken to skin, where the gradient reaches zero guard and bare skin is visible at the perimeter. The skin fade elevates the contrast of any style significantly. The technique demands a high level of precision from the barber, as any inconsistency in the gradient is immediately visible. At SAVRON, skin fades are blended through multiple guard sizes before a final pass with a straight razor along the hairline.',
      },
      {
        type: 'h2',
        heading: 'Drop Fade',
        text: 'Rather than following a straight horizontal line around the head, the drop fade curves downward behind the ear, dropping toward the neckline before rising back up. The effect adds a sculptural quality to the silhouette and pairs particularly well with French crops and medium-length styles. It softens the sharpness of a standard fade and works well for rounder face shapes by elongating the visual line of the jaw.',
      },
      {
        type: 'h2',
        heading: 'Burst Fade',
        text: 'The burst fade radiates outward from behind the ear in a semicircular pattern: literally bursting open from a single point. It is the most stylistically distinctive of the fade family, associated with mohawks, faux hawks, and afro-textured styles. The burst creates a focal point at the ear that draws the eye upward toward the topline. It is a committed aesthetic choice. There is nothing subtle about a burst fade.',
      },
      {
        type: 'callout',
        text: 'When booking, use the precise term and specify whether you want a skin finish or a short guard (e.g., #0.5 or #1). Providing a reference image removes ambiguity entirely.',
      },
      {
        type: 'h2',
        heading: 'Temple Fade (Edgar Fade)',
        text: 'The temple fade focuses specifically on the hairline at the temples, creating a sharp, defined line that frames the forehead. Often paired with a hard part and a flat, horizontal fringe, this style has significant roots in Latino barbering culture and is currently being adopted broadly across demographics. The key feature is the razor-sharp line at the temple, which requires both precision clippers and a practiced eye.',
      },
      {
        type: 'h2',
        heading: 'Choosing a fade for your face shape',
        text: 'Round faces often benefit from height on top and mid or high fades that elongate the profile. Long faces balance well with lower fades and slightly more weight on the sides. Strong jawlines can carry high contrast skin fades. Your SAVRON barber maps these proportions in the consultation before choosing guard paths.',
      },
      {
        type: 'p',
        text: 'Minneapolis clients often commute between climates, office heat, outdoor wind, helmet or hat use on bikes. Mention those habits so fade height and top length survive your actual week, not just the ten minutes after the appointment.',
      },
      {
        type: 'closing',
        text: 'Understanding what you are asking for is the first step toward getting it. Every barber at SAVRON is trained across the full fade spectrum: we work with your head shape, hair texture, and lifestyle to execute the right version. Not just a technically correct one.',
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
