import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '@/shared/ui/Navbar';
import Footer from '@/shared/ui/Footer';

export default function PublicLayout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className={`min-h-screen flex flex-col ${isLanding ? '' : 'bg-[#FFF8E7] neo-dots-bg'}`}>
      <Navbar />
      <main className={`flex-1 ${isLanding ? 'pt-0' : 'pt-20 md:pt-24'}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
