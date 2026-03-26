import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#FFF8E7] neo-dots-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 auth-ocean-grid" />
      {/* Decorative shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[5%] w-20 h-20 bg-neo-green border-3 border-neo-black
                     shadow-neo rotate-12 opacity-60"
        />
        <motion.div
          animate={{ y: [0, 15, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-[20%] right-[8%] w-16 h-16 bg-neo-blue border-3 border-neo-black
                     shadow-neo opacity-60"
        />
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[15%] left-[10%] w-24 h-12 bg-neo-yellow border-3 border-neo-black
                     shadow-neo opacity-40"
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute bottom-[25%] right-[12%] w-14 h-14 bg-neo-green border-3 border-neo-black
                     shadow-neo rotate-45 opacity-50"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md lg:max-w-lg xl:max-w-xl"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
