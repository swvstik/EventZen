import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion';
import { HiArrowRight, HiCalendar, HiClock, HiSparkles, HiUsers } from 'react-icons/hi';
import eventPicA from '@/assets/optimized-webp/landing/event-a.webp';
import eventPicB from '@/assets/optimized-webp/landing/event-b.webp';
import eventPicC from '@/assets/optimized-webp/landing/event-c.webp';
import eventPicD from '@/assets/optimized-webp/landing/event-d.webp';
import eventPicE from '@/assets/optimized-webp/landing/why-eventzen.webp';
import eventPicF from '@/assets/optimized-webp/landing/event-b.webp';
import whyImage from '@/assets/optimized-webp/landing/why-eventzen.webp';
import testimonialRandomImage from '@/assets/optimized-webp/landing/random-optimized.webp';
import testimonialXabiImage from '@/assets/optimized-webp/testimonials/xabi-1.webp';
import testimonialGetoImage from '@/assets/optimized-webp/testimonials/geto.webp';
import noteA from '@/assets/svg-packs/music-note-svgrepo-com.svg';
import noteB from '@/assets/svg-packs/music-note-2-svgrepo-com.svg';
import noteC from '@/assets/svg-packs/music-note-4-svgrepo-com.svg';
import useAuthStore from '@/shared/store/authStore';

function useCounter(end, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  useEffect(() => {
    if (!inView) {
      return undefined;
    }

    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [duration, end, inView]);

  return [ref, count];
}

const HERO_ROTATION_IMAGES = [eventPicB, eventPicA, eventPicC, eventPicD, eventPicE, eventPicF];

const OFFER_CARDS = [
  {
    icon: HiSparkles,
    title: 'Find events that fit your vibe',
    desc: 'Filter by date, location, and category to find the right event fast.',
    accent: 'landing-accent-mint',
  },
  {
    icon: HiCalendar,
    title: 'Book in one smooth flow',
    desc: 'Choose your tier, confirm details, and keep your entry pass ready.',
    accent: 'landing-accent-teal',
  },
  {
    icon: HiClock,
    title: 'Stay updated without spam',
    desc: 'Get timely reminders and important event updates only.',
    accent: 'landing-accent-cyan',
  },
  {
    icon: HiUsers,
    title: 'Loved by attendees and vendors.',
    desc: 'Event management, optimized. For attendees and vendors alike.',
    accent: 'landing-accent-sky',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Discover',
    desc: 'Find the right event with clear filters and key details upfront.',
  },
  {
    step: '02',
    title: 'Reserve',
    desc: 'Pick your tier, confirm, and reserve your spot instantly.',
  },
  {
    step: '03',
    title: 'Check In',
    desc: 'Show your QR code at entry and skip the queue stress.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Kanye Southeast',
    role: 'Concert Addict',
    quote:
      'I opened EventZen once, picked an event in minutes, and never went back to any other service.',
    image: testimonialRandomImage,
  },
  {
    name: 'Xabi Alonso',
    role: 'Team Coach',
    quote: 'Players finally started attending trainings on time once we moved schedules through EventZen.',
    image: testimonialXabiImage,
  },
  {
    name: 'Suguru Geto',
    role: 'Tournament Host',
    quote: 'Thank you EventZen for helping me host Culling Games. It was a very fun experience. Shoutout Higuruma!',
    image: testimonialGetoImage,
  },
];

const STRIP_WORDS = ['EVENTZEN', 'DISCOVER', 'BOOK', 'CHECK IN', 'ENJOY'];
const NOTE_SVGS = [noteA, noteB, noteC];

function seededNotes(seed, count) {
  const items = [];
  let value = seed;

  for (let i = 0; i < count; i += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const x = (value % 10000) / 100;

    value = (value * 1664525 + 1013904223) >>> 0;
    const y = (value % 10000) / 100;

    value = (value * 1664525 + 1013904223) >>> 0;
    const rotate = (value % 80) - 40;

    value = (value * 1664525 + 1013904223) >>> 0;
    const size = 18 + (value % 22);

    items.push({
      id: `note-${i}`,
      left: `${x}%`,
      top: `${y}%`,
      rotate: `${rotate}deg`,
      size: `${size}px`,
      note: NOTE_SVGS[i % NOTE_SVGS.length],
    });
  }

  return items;
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const offerRef = useRef(null);
  const howRef = useRef(null);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const { isAuthenticated, user } = useAuthStore();

  const { scrollYProgress: pageScroll } = useScroll();
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const { scrollYProgress: offerProgress } = useScroll({
    target: offerRef,
    offset: ['start end', 'end start'],
  });

  const { scrollYProgress: howProgress } = useScroll({
    target: howRef,
    offset: ['start end', 'end start'],
  });

  const heroY = useTransform(heroProgress, [0, 1], [0, 75]);
  const heroCopyScale = useTransform(heroProgress, [0, 0.7, 1], [1, 0.94, 0.88]);
  const heroCopyOpacity = useTransform(heroProgress, [0, 0.8, 1], [1, 0.92, 0.84]);
  const stripX = useTransform(pageScroll, [0, 1], ['2%', '-36%']);
  const stripRotate = useTransform(pageScroll, [0, 1], [0, 0]);
  const offerNotesY = useTransform(offerProgress, [0, 1], [40, -40]);
  const howNotesY = useTransform(howProgress, [0, 1], [45, -45]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % HERO_ROTATION_IMAGES.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const heroMainImage = HERO_ROTATION_IMAGES[heroImageIndex % HERO_ROTATION_IMAGES.length];
  const heroSideImage = HERO_ROTATION_IMAGES[(heroImageIndex + 2) % HERO_ROTATION_IMAGES.length];
  const heroTopImage = HERO_ROTATION_IMAGES[(heroImageIndex + 4) % HERO_ROTATION_IMAGES.length];

  const [ticketsRef, ticketsCount] = useCounter(98420);
  const [usersRef, usersCount] = useCounter(36500);
  const [eventsRef, eventsCount] = useCounter(12400);
  const [venuesRef, venuesCount] = useCounter(780);

  const stats = [
    { ref: ticketsRef, value: ticketsCount, label: 'Bought Tickets', suffix: '+' },
    { ref: usersRef, value: usersCount, label: 'Active Users', suffix: '+' },
    { ref: eventsRef, value: eventsCount, label: 'Live Events', suffix: '+' },
    { ref: venuesRef, value: venuesCount, label: 'Partner Venues', suffix: '+' },
  ];

  const offerNotes = useMemo(() => seededNotes(20260322, 12), []);
  const howNotes = useMemo(() => seededNotes(20260323, 12), []);

  return (
    <div className="overflow-hidden landing-ocean-bg">
      <motion.section ref={heroRef} className="relative min-h-screen flex items-start md:items-center overflow-hidden pt-20 sm:pt-24 md:pt-0">
        <div className="absolute inset-0 landing-depth-grid" />

        <motion.div style={{ y: heroY }} className="neo-container relative z-10 py-8 sm:py-12 md:py-24">
          <motion.div
            style={{ scale: heroCopyScale, opacity: heroCopyOpacity }}
            className="landing-panel landing-hero-panel landing-hero-unified p-4 sm:p-6 md:p-8 lg:p-10"
          >
            <div className="grid items-center gap-12 lg:grid-cols-[1.06fr_0.94fr]">
              <motion.div>
                <span className="neo-badge bg-neo-black text-neo-yellow mb-5">
                  {isAuthenticated ? 'Welcome back' : 'Your next event, sorted'}
                </span>

                <h1 className="font-heading-shade text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[0.98] mb-4">
                  {isAuthenticated ? (
                    <>
                      Welcome back,
                      <br />
                      {(user?.name || 'EventZen user').split(' ')[0]}.
                      <br />
                      <span className="landing-hero-highlight">Pick your next plan.</span>
                    </>
                  ) : (
                    <>
                      Discover.
                      <br />
                      Book in minutes.
                      <br />
                      <span className="landing-hero-highlight">Enjoy.</span>
                    </>
                  )}
                </h1>

                <p className="font-body text-sm md:text-[15px] text-gray-700 max-w-xl mb-7 leading-relaxed">
                  {isAuthenticated
                    ? 'See what is coming up, keep your passes ready, and manage your plans in one place.'
                    : 'Discover events you actually care about, reserve your spot in a few clicks, and keep your QR check-in ready.'}
                </p>

                <div className="flex flex-wrap gap-4">
                  <Link to="/events" className="neo-btn neo-btn-lg landing-btn-main group">
                    Explore Events
                    <HiArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  {isAuthenticated ? (
                    <Link to="/dashboard" className="neo-btn neo-btn-lg bg-neo-white">
                      Open Dashboard
                    </Link>
                  ) : (
                    <Link to="/register" className="neo-btn neo-btn-lg bg-neo-white">
                      Create Account
                      <HiArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  )}
                </div>

                <div className="mt-8 grid grid-cols-3 gap-1.5 sm:gap-2 max-w-2xl">
                  <span className="neo-badge bg-neo-white text-neo-black justify-center whitespace-nowrap px-1.5 py-1 text-[8px] tracking-[0.08em] sm:px-3 sm:text-[10px] sm:tracking-widest">QR Entry</span>
                  <span className="neo-badge bg-neo-white text-neo-black justify-center whitespace-nowrap px-1.5 py-1 text-[8px] tracking-[0.08em] sm:px-3 sm:text-[10px] sm:tracking-widest">Reminders</span>
                  <span className="neo-badge bg-neo-white text-neo-black justify-center whitespace-nowrap px-1.5 py-1 text-[8px] tracking-[0.08em] sm:px-3 sm:text-[10px] sm:tracking-widest">Scheduling</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 28 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative w-full max-w-xl mx-auto lg:ml-auto"
              >
                <div className="neo-card p-2 bg-neo-white">
                  <div className="relative h-[340px] md:h-[420px] border-3 border-neo-black bg-black overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`hero-main-${heroImageIndex}`}
                        src={heroMainImage}
                        alt="Audience cheering at a live event"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        width="1200"
                        height="900"
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{ opacity: 0, filter: 'brightness(0)' }}
                        animate={{ opacity: 1, filter: 'brightness(1)' }}
                        exit={{ opacity: 0, filter: 'brightness(0)' }}
                        transition={{ duration: 0.62, ease: 'easeInOut' }}
                      />
                    </AnimatePresence>
                  </div>
                  {/* Move the "Real moments..." text to the right */}
                  <div className="flex justify-end">
                    <p className="font-heading text-[11px] uppercase tracking-[0.18em] mt-3 px-2 pb-1">
                      Real moments from EventZen events
                    </p>
                  </div>
                </div>

                <div className="hidden lg:block absolute -bottom-9 -left-9 w-40 md:w-44 neo-card p-2 bg-[#ffb347] rotate-[-6deg]">
                  <div className="relative h-28 md:h-32 border-3 border-neo-black bg-black overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`hero-side-${heroImageIndex}`}
                        src={heroSideImage}
                        alt="People socializing at an event venue"
                        loading="lazy"
                        fetchPriority="low"
                        decoding="async"
                        width="600"
                        height="400"
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{ opacity: 0, filter: 'brightness(0)' }}
                        animate={{ opacity: 1, filter: 'brightness(1)' }}
                        exit={{ opacity: 0, filter: 'brightness(0)' }}
                        transition={{ duration: 0.58, ease: 'easeInOut' }}
                      />
                    </AnimatePresence>
                  </div>
                </div>

                <div className="hidden lg:block absolute -top-9 -right-8 w-44 neo-card p-2 bg-[#ff944d] rotate-[7deg]">
                  <div className="relative h-32 border-3 border-neo-black bg-black overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`hero-top-${heroImageIndex}`}
                        src={heroTopImage}
                        alt="Stage lights over a packed event floor"
                        loading="lazy"
                        fetchPriority="low"
                        decoding="async"
                        width="600"
                        height="400"
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{ opacity: 0, filter: 'brightness(0)' }}
                        animate={{ opacity: 1, filter: 'brightness(1)' }}
                        exit={{ opacity: 0, filter: 'brightness(0)' }}
                        transition={{ duration: 0.58, ease: 'easeInOut' }}
                      />
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </motion.section>

      <section className="py-5 border-y-4 border-neo-black bg-neo-yellow overflow-hidden">
        <motion.div className="flex w-max" style={{ x: stripX, rotate: stripRotate }}>
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={`strip-${index}`}
              className="font-heading text-sm md:text-lg uppercase tracking-[0.24em] text-neo-black whitespace-nowrap mx-6"
            >
              {STRIP_WORDS[index % STRIP_WORDS.length]}
            </span>
          ))}
        </motion.div>
      </section>

      <section ref={offerRef} className="neo-section relative overflow-hidden">
        <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ y: offerNotesY }} aria-hidden="true">
          {offerNotes.map((note, index) => (
            <motion.img
              key={`offer-${note.id}`}
              src={note.note}
              alt=""
              className="landing-note-glyph"
              style={{
                left: note.left,
                top: note.top,
                rotate: note.rotate,
                width: note.size,
                height: note.size,
              }}
              animate={{ y: [0, -12, 0], opacity: [0.12, 0.32, 0.12] }}
              transition={{ duration: 5 + (index % 4), repeat: Infinity, ease: 'easeInOut', delay: index * 0.12 }}
            />
          ))}
        </motion.div>
        <div className="neo-container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-14"
          >
            <span className="neo-badge bg-neo-yellow text-neo-black mb-4 inline-flex">Why people choose EventZen</span>
            <h2 className="font-heading text-3xl md:text-4xl uppercase tracking-wider mb-4">
              Everything you need to go from maybe to booked
            </h2>
            <p className="font-body text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Start as an attendee, scale into organizer workflows when you need more control.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {OFFER_CARDS.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.36, delay: index * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="landing-panel p-7 md:p-8 flex gap-5"
                >
                  <div
                    className={`${feature.accent} w-14 h-14 md:w-16 md:h-16 flex-shrink-0 border-3 border-neo-black shadow-neo-sm flex items-center justify-center`}
                  >
                    <Icon size={28} className="text-neo-black" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base md:text-lg uppercase tracking-wider mb-2">
                      {feature.title}
                    </h3>
                    <p className="font-body text-sm md:text-base text-gray-700 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="neo-section bg-neo-cream border-y-4 border-neo-black landing-polka-bg landing-polka-divider-wave">
        <div className="neo-container">
          <div className="mb-10">
            <div className="landing-wavy-frame p-6 md:p-8 lg:p-10">
            <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.45 }}
            >
              <span className="neo-badge bg-neo-black text-neo-yellow mb-4 inline-flex">Why EventZen works</span>
              <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-wider mb-5">
                From discovery to entry, everything stays clear
              </h2>
              <p className="font-body text-gray-800 leading-relaxed mb-6">
                Most platforms feel complicated too early. EventZen keeps booking simple while still supporting advanced event operations.
              </p>

              <ul className="space-y-3 font-body text-sm md:text-base text-gray-800">
                <li>Venue-aware scheduling helps prevent avoidable clashes.</li>
                <li>Reminders are timed to be useful, not distracting.</li>
                <li>Organizer and vendor capabilities unlock when needed.</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.5 }}
              className="neo-card p-3 bg-neo-white"
            >
              <img
                src={whyImage}
                alt="City crowd at an evening event"
                loading="lazy"
                decoding="async"
                className="w-full h-[280px] md:h-[360px] object-cover border-3 border-neo-black"
              />
            </motion.div>
          </div>
          </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 min-[360px]:gap-3 sm:gap-4">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                ref={stat.ref}
                whileHover={{ y: -4, rotate: [-1, 1, 0] }}
                className="landing-panel p-2.5 min-[360px]:p-3 sm:p-5 text-center shadow-neo-sm md:shadow-neo-xl"
              >
                <p className="font-heading-shade text-[1.35rem] min-[360px]:text-[1.55rem] sm:text-3xl md:text-4xl mb-1 sm:mb-2 leading-none whitespace-nowrap">
                  {stat.value.toLocaleString()}
                  {stat.suffix}
                </p>
                <p className="font-heading text-[9px] min-[360px]:text-[10px] sm:text-[11px] md:text-xs uppercase tracking-[0.04em] min-[360px]:tracking-[0.08em] sm:tracking-wider text-gray-700 leading-tight">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section ref={howRef} className="neo-section relative overflow-hidden">
        <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ y: howNotesY }} aria-hidden="true">
          {howNotes.map((note, index) => (
            <motion.img
              key={`how-${note.id}`}
              src={note.note}
              alt=""
              className="landing-note-glyph"
              style={{
                left: note.left,
                top: note.top,
                rotate: note.rotate,
                width: note.size,
                height: note.size,
              }}
              animate={{ y: [0, -14, 0], x: [0, 4, 0], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 6 + (index % 4), repeat: Infinity, ease: 'easeInOut', delay: index * 0.1 }}
            />
          ))}
        </motion.div>
        <div className="neo-container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.45 }}
            className="text-center mb-14"
          >
            <span className="neo-badge bg-neo-yellow text-neo-black mb-4 inline-flex">How it works</span>
            <h2 className="font-heading text-3xl md:text-4xl uppercase tracking-wider mb-4">
              Three steps. No confusion.
            </h2>
            <p className="font-body text-gray-700 max-w-2xl mx-auto leading-relaxed">
              Find, book, and check in without the usual event-day friction.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {HOW_IT_WORKS.map((item, index) => (
              <motion.article
                key={item.step}
                initial={{ opacity: 0, y: 26, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.35, delay: index * 0.22 }}
                className="landing-panel p-7 md:p-8 text-center"
              >
                <div className="landing-accent-mint w-14 h-14 md:w-16 md:h-16 mx-auto mb-5 border-4 border-neo-black shadow-neo flex items-center justify-center font-heading-shade text-xl md:text-2xl">
                  {item.step}
                </div>
                <h3 className="font-heading text-lg md:text-xl uppercase tracking-wider mb-3">{item.title}</h3>
                <p className="font-body text-sm md:text-base text-gray-700 leading-relaxed">{item.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="neo-section bg-[#8e2f12] text-neo-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20" aria-hidden="true">
          <div className="absolute top-8 left-[8%] w-32 h-32 border-4 border-[#ffd94c] rotate-[11deg]" />
          <div className="absolute top-[44%] right-[12%] w-24 h-24 border-4 border-[#ffbc66] rounded-full" />
          <div className="absolute bottom-10 left-[22%] w-20 h-20 border-4 border-[#ffd94c] rotate-[24deg]" />
        </div>

        <div className="neo-container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.45 }}
            className="text-center mb-14"
          >
            <span className="neo-badge bg-neo-white text-neo-black mb-4 inline-flex">Testimonials</span>
            <h2 className="font-heading text-3xl md:text-4xl uppercase tracking-wider">
              People using EventZen every week
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((item, index) => (
              <motion.figure
                key={item.name}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="neo-card p-5 md:p-6 bg-neo-white text-neo-black"
              >
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={item.image}
                    alt={`${item.name} profile`}
                    loading="lazy"
                    decoding="async"
                    className="w-14 h-14 rounded-full object-cover border-3 border-neo-black"
                  />
                  <figcaption>
                    <p className="font-heading text-sm uppercase tracking-wider">{item.name}</p>
                    <p className="font-body text-xs text-gray-600">{item.role}</p>
                  </figcaption>
                </div>
                <blockquote className="font-body text-sm md:text-base text-gray-700 leading-relaxed">
                  "{item.quote}"
                </blockquote>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      <section className="neo-section bg-[#7d270f] text-neo-white border-t-2 border-[#ffd600]">
        <div className="neo-container text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.45 }}
          >
            <h2 className="font-heading text-4xl md:text-5xl uppercase tracking-wider mb-6">
              {isAuthenticated ? 'Ready for your next event?' : 'Your next great event starts on EventZen'}
            </h2>
            <p className="font-body text-base md:text-lg text-[#ffe9cf] max-w-2xl mx-auto mb-10 leading-relaxed">
              {isAuthenticated
                ? 'Open events now, reserve quickly, and keep your check-in flow smooth.'
                : 'Discover better events, book with confidence, and let EventZen handle check-in and updates behind the scenes.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {isAuthenticated ? (
                <Link to="/dashboard" className="neo-btn neo-btn-lg landing-btn-main text-neo-black">
                  Open Dashboard
                  <HiArrowRight />
                </Link>
              ) : (
                <Link to="/register" className="neo-btn neo-btn-lg landing-btn-main text-neo-black">
                  Create Account
                  <HiArrowRight />
                </Link>
              )}
              <Link
                to="/events"
                className="neo-btn neo-btn-lg bg-transparent text-neo-white border-neo-white hover:bg-neo-white hover:text-neo-black"
              >
                Explore Events
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
