import { Link } from 'react-router-dom';

const FOOTER_LINKS = [
  { label: 'Browse Events', path: '/events' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Login', path: '/login' },
  { label: 'Register', path: '/register' },
];

export default function Footer() {
  return (
    <footer className="bg-neo-black text-neo-white border-t-4 border-neo-orange">
      {/* Marquee */}
      <div className="overflow-hidden border-b-3 border-neo-orange/35 py-3">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="font-heading text-sm uppercase tracking-[0.3em] text-neo-yellow/80 whitespace-nowrap mx-8"
            >
              * DISCOVER * BOOK * CHECK IN * EVENTZEN
            </span>
          ))}
        </div>
      </div>

      <div className="neo-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-neo-yellow border-3 border-neo-white
                            flex items-center justify-center font-heading text-neo-black text-lg">
                E
              </div>
              <span className="font-heading text-xl tracking-wider">
                EVENT<span className="text-neo-orange">ZEN</span>
              </span>
            </div>
            <p className="font-body text-sm text-neo-white/70 max-w-xs leading-relaxed">
              Discover events, reserve quickly, and manage everything from ticketing
              to operations in one place.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading text-sm uppercase tracking-wider text-neo-yellow mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="font-body text-sm text-neo-white/70 hover:text-neo-yellow
                             transition-colors duration-200"
                  >
                    -&gt; {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="font-heading text-sm uppercase tracking-wider text-neo-yellow mb-4">
              Platform Stack
            </h4>
            <div className="flex flex-wrap gap-2">
              {['React', 'Vite', 'Tailwind', 'Node.js', 'Spring Boot', '.NET'].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 text-xs font-heading uppercase
                           border-2 border-neo-orange/35 text-neo-white/80"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t-2 border-neo-white/10 text-center">
          <p className="font-body text-xs text-neo-white/40">
            (c) {new Date().getFullYear()} EventZen. Built for modern event experiences.
          </p>
        </div>
      </div>
    </footer>
  );
}
