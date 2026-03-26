import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiCalendar, HiLocationMarker, HiUsers,
  HiCurrencyDollar, HiChartBar,
  HiDocumentText, HiMenu, HiHome, HiX, HiChevronDown, HiQrcode, HiViewGrid, HiRefresh,
} from 'react-icons/hi';
import useAuthStore from '@/shared/store/authStore';
import NotificationBell from '@/modules/notifications/components/NotificationBell';

const MENU_ITEMS = [
  {
    label: 'Overview',
    path: '/admin',
    icon: HiViewGrid,
    roles: ['VENDOR', 'ADMIN'],
    color: 'bg-neo-lavender',
  },
  {
    label: 'Events',
    icon: HiCalendar,
    roles: ['VENDOR', 'ADMIN'],
    color: 'bg-neo-yellow',
    children: [
      {
        label: 'Events',
        path: '/admin/events',
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: 'Check-In',
        path: '/admin/check-in',
        icon: HiQrcode,
        roles: ['VENDOR', 'ADMIN'],
      },
    ],
  },
  {
    label: 'Venues',
    icon: HiLocationMarker,
    roles: ['VENDOR', 'ADMIN'],
    color: 'bg-neo-blue',
    children: [
      {
        label: 'View Venues',
        path: '/admin/venues/view',
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: 'Venue Management',
        path: '/admin/venues',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: HiUsers,
    roles: ['ADMIN'],
    color: 'bg-neo-pink',
  },
  {
    label: 'Applications',
    path: '/admin/vendor-applications',
    icon: HiDocumentText,
    roles: ['ADMIN'],
    color: 'bg-neo-orange',
  },
  {
    label: 'Reports',
    icon: HiCurrencyDollar,
    roles: ['VENDOR', 'ADMIN'],
    color: 'bg-neo-white',
    children: [
      {
        label: 'Event Reports',
        path: '/admin/reports/events',
        icon: HiChartBar,
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: 'Financial Overview',
        path: '/admin/reports/vendor-overview',
        roles: ['VENDOR'],
      },
      {
        label: 'Financial Overview',
        path: '/admin/reports/admin-overview',
        roles: ['ADMIN'],
      },
    ],
  },
];

function SidebarContent({ user, visibleItems, pathname, onNavigate }) {
  const [openGroups, setOpenGroups] = useState({ venues: true, events: true, reports: true });

  const toggleGroup = (label) => {
    const key = String(label || '').toLowerCase();
    setOpenGroups((state) => ({ ...state, [key]: !state[key] }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="p-4 border-b-3 border-neo-black">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-neo-yellow border-3 border-neo-black shadow-neo-sm
                        flex items-center justify-center font-heading text-lg text-neo-black">
            E
          </div>
          <div>
            <span className="font-heading text-lg text-neo-white tracking-wider">
              EVENT<span className="text-neo-orange">ZEN</span>
            </span>
            <p className="text-[10px] font-heading text-neo-white/50 uppercase tracking-widest">
              {user?.role} Panel
            </p>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isOverviewPath = item.path === '/admin';
          const isActive = item.path
            ? (isOverviewPath ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`))
            : item.children?.some((child) => pathname === child.path || pathname.startsWith(`${child.path}/`));
          const Icon = item.icon;

          if (Array.isArray(item.children) && item.children.length > 0) {
            const groupKey = String(item.label || '').toLowerCase();
            const isOpen = openGroups[groupKey] ?? false;

            return (
              <div key={item.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5
                              font-heading text-xs uppercase tracking-wider border-3 transition-all duration-200
                              ${isActive
                                ? `${item.color} text-neo-black border-neo-black shadow-neo-sm`
                                : 'text-neo-white/70 border-transparent hover:text-neo-white hover:bg-neo-white/10 hover:border-neo-white/20'
                              }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </span>
                  <HiChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="ml-2 pl-2 border-l-2 border-neo-white/20 space-y-1">
                    {item.children.map((child) => {
                      const childActive = pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={onNavigate}
                          className={`block px-3 py-2 font-heading text-[10px] uppercase tracking-wider border-2 transition-all
                                      ${childActive
                                        ? 'bg-neo-white text-neo-black border-neo-black'
                                        : 'text-neo-white/70 border-transparent hover:text-neo-white hover:bg-neo-white/10 hover:border-neo-white/20'
                                      }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 
                         font-heading text-xs uppercase tracking-wider
                         border-3 transition-all duration-200
                         ${isActive
                           ? `${item.color} text-neo-black border-neo-black shadow-neo-sm`
                           : 'text-neo-white/70 border-transparent hover:text-neo-white hover:bg-neo-white/10 hover:border-neo-white/20'
                         }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t-3 border-neo-white/10 space-y-2">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 
                   font-heading text-xs uppercase tracking-wider
                   text-neo-white/50 hover:text-neo-white transition-colors"
        >
          <HiHome size={18} />
          Back to Site
        </Link>
        <div className="px-3 py-2 bg-neo-white/5 border-2 border-neo-white/10">
          <p className="font-heading text-[10px] text-neo-white/40 uppercase tracking-widest">
            Logged in as
          </p>
          <p className="font-body text-sm text-neo-white/80 truncate">
            {user?.name}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setTimeout(() => setRefreshingAll(false), 250);
    }
  };

  const visibleItems = MENU_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  ).map((item) => {
    if (!Array.isArray(item.children)) return item;
    const filteredChildren = item.children.filter((child) => user && child.roles.includes(user.role));
    return { ...item, children: filteredChildren };
  });

  return (
    <div className="min-h-screen flex bg-[#FFF8E7] neo-dots-bg">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 bg-neo-black border-r-3 border-neo-black
                       fixed top-0 left-0 h-screen overflow-y-auto">
        <SidebarContent
          user={user}
          visibleItems={visibleItems}
          pathname={location.pathname}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 left-0 w-64 h-screen bg-neo-black 
                       border-r-3 border-neo-black z-50"
            >
              <div className="flex items-center justify-end p-3 border-b-3 border-neo-white/10">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 border-3 border-neo-white text-neo-white bg-transparent"
                  aria-label="Close sidebar"
                >
                  <HiX size={16} />
                </button>
              </div>
              <SidebarContent
                user={user}
                visibleItems={visibleItems}
                pathname={location.pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-neo-white border-b-3 border-neo-black">
          <div className="flex items-center justify-between px-4 md:px-6 h-16">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 border-3 border-neo-black bg-neo-white shadow-neo-sm
                       active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              <HiMenu size={20} />
            </button>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={refreshingAll}
                className="neo-btn neo-btn-sm bg-neo-white"
                aria-label="Refresh admin data"
              >
                <HiRefresh size={14} />
                {refreshingAll ? 'Refreshing...' : 'Refresh'}
              </button>
              <NotificationBell />
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2 py-1.5 font-heading text-[10px] uppercase tracking-wider
                         bg-neo-lavender border-3 border-neo-black shadow-neo-sm
                         hover:-translate-y-0.5 transition-all"
                aria-label="Open profile"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Profile"
                    className="w-7 h-7 rounded-full border-2 border-neo-black object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full border-2 border-neo-black bg-neo-cream
                                   flex items-center justify-center text-[10px]">
                    {user?.name?.trim()?.[0] || 'U'}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 md:p-6 lg:p-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
