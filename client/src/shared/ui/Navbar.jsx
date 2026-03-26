import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMenu, HiX } from 'react-icons/hi';
import { authApi } from '@/shared/api';
import useAuthStore from '@/shared/store/authStore';
import NotificationBell from '@/modules/notifications/components/NotificationBell';
import logoMark from '@/assets/svg-packs/logo.svg';

const NAV_LINKS = [
  { label: 'Events', path: '/events' },
  { label: 'Dashboard', path: '/dashboard', auth: true },
  { label: 'Admin', path: '/admin', role: ['VENDOR', 'ADMIN'] },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // logout anyway
    }
    logout();
    navigate('/');
  };

  const visibleLinks = NAV_LINKS.filter((link) => {
    if (link.auth && !isAuthenticated) return false;
    if (link.role && (!user || !link.role.includes(user.role))) return false;
    return true;
  });

  return (
    <motion.nav
      initial={false}
      animate={{
        y: scrolled ? -2 : 0,
      }}
      transition={{ duration: 0.22 }}
      className="fixed top-2 left-0 right-0 z-50 px-2 sm:px-4"
    >
      <div
        className={`mx-auto max-w-6xl rounded-xl border-3 border-neo-black transition-all duration-200 ${
          scrolled ? 'bg-[#FFFDF7] shadow-[0_3px_0_#1A1A2E]' : 'bg-[#FFFCF0]/95 shadow-[0_6px_0_#1A1A2E]'
        }`}
      >
        <div className="px-2.5 sm:px-5 md:px-6">
          <div className="flex items-center justify-between h-[56px] md:h-[64px] gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group min-w-0 flex-1 md:flex-none">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, -5, 0] }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 bg-neo-white border-3 border-neo-black shadow-neo-sm
                         flex items-center justify-center p-1"
            >
              <img
                src={logoMark}
                alt="EventZen logo"
                className="w-full h-full object-contain"
                loading="eager"
                decoding="async"
              />
            </motion.div>
            <span className="font-heading text-base sm:text-lg md:text-xl tracking-wide truncate">
              EVENT<span className="text-neo-orange">ZEN</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            {visibleLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.14em]
                           border-3 border-neo-black rounded-lg transition-all duration-200 shadow-neo-sm
                           ${location.pathname.startsWith(link.path)
                             ? 'bg-neo-green text-neo-black'
                             : 'bg-neo-white text-neo-black hover:bg-neo-cream'
                           }`}
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated && <NotificationBell />}

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/profile"
                  aria-label="Open profile"
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Profile avatar"
                      className="w-9 h-9 rounded-full border-3 border-neo-black shadow-neo object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-neo-lavender border-3 border-neo-black shadow-neo flex items-center justify-center font-heading text-sm uppercase">
                      {user?.name?.[0] || '?'}
                    </div>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="neo-btn-sm neo-btn bg-neo-white hover:bg-neo-red hover:text-white"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="neo-btn-sm neo-btn bg-neo-white rounded-xl">
                  Login
                </Link>
                <Link to="/register" className="neo-btn-sm neo-btn bg-neo-yellow rounded-xl">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated && (
              <Link
                to="/profile"
                aria-label="Open profile"
                className="p-1 border-3 border-neo-black bg-neo-white shadow-neo-sm rounded-lg"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Profile avatar"
                    className="w-7 h-7 rounded-full border-2 border-neo-black object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neo-lavender border-2 border-neo-black flex items-center justify-center font-heading text-[10px] uppercase">
                    {user?.name?.[0] || '?'}
                  </div>
                )}
              </Link>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-site-nav"
              className="p-1.5 border-3 border-neo-black bg-neo-white shadow-neo-sm rounded-lg
                       active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              {isOpen ? <HiX size={20} /> : <HiMenu size={20} />}
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-site-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden mt-2 mx-auto max-w-6xl rounded-lg border-3 border-neo-black bg-neo-white overflow-hidden shadow-[0_6px_0_#1A1A2E]"
          >
            <div className="p-4 space-y-3">
              {visibleLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 font-heading text-sm uppercase tracking-wider
                             border-3 border-neo-black transition-all
                             ${location.pathname.startsWith(link.path)
                               ? 'bg-neo-green shadow-neo-sm'
                               : 'bg-neo-white'
                             }`}
                >
                  {link.label}
                </Link>
              ))}

              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="w-full px-4 py-3 font-heading text-sm uppercase
                               bg-neo-white border-3 border-neo-black text-left rounded-lg
                             hover:bg-neo-red hover:text-white"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 font-heading text-sm uppercase
                             bg-neo-white border-3 border-neo-black rounded-lg"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 font-heading text-sm uppercase
                             bg-neo-green border-3 border-neo-black rounded-lg"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
