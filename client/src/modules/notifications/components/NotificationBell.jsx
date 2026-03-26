import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { HiBell } from 'react-icons/hi';
import { notificationsApi } from '@/shared/api';
import { formatRelative } from '@/shared/utils/formatters';
import useAuthStore from '@/shared/store/authStore';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { accessToken, user } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return undefined;

    const source = new EventSource(`/api/notifications/stream?accessToken=${encodeURIComponent(accessToken)}`);

    const refreshNotifications = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-applications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['my-application'] });
    };

    source.addEventListener('notification', refreshNotifications);
    source.addEventListener('connected', refreshNotifications);

    return () => {
      source.removeEventListener('notification', refreshNotifications);
      source.removeEventListener('connected', refreshNotifications);
      source.close();
    };
  }, [accessToken, queryClient]);

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: notifData, isFetching: isRefreshingList, refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll({ page: 0, limit: 10 }).then((r) => r.data),
    enabled: open,
    refetchInterval: open ? 20000 : false,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const unread = countData?.count || 0;
  const notifications = notifData?.notifications || [];

  const handleToggle = () => {
    setOpen(!open);
    if (!open && unread > 0) {
      markAllRead.mutate();
    }
  };

  const openNotification = (notif) => {
    if (!notif.isRead && (notif._id || notif.id)) {
      markRead.mutate(notif._id || notif.id);
    }

    if (notif.type === 'VENDOR_APPLICATION_APPROVED' || notif.type === 'VENDOR_APPLICATION_REJECTED') {
      navigate('/vendor/applications/me');
      setOpen(false);
      return;
    }

    if (notif.type === 'VENDOR_APPLICATION_SUBMITTED') {
      navigate('/admin/vendor-applications');
      setOpen(false);
      return;
    }

    if (notif.type === 'EVENT_PENDING_APPROVAL' && user?.role === 'ADMIN') {
      navigate('/admin/events');
      setOpen(false);
      return;
    }

    if ((notif.type === 'EVENT_APPROVED' || notif.type === 'EVENT_REJECTED') && user?.role === 'VENDOR') {
      navigate('/admin/events');
      setOpen(false);
      return;
    }

    if (notif.eventId) {
      navigate(`/events/${notif.eventId}`);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        aria-label={open ? 'Close notifications panel' : 'Open notifications panel'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative p-2 border-3 border-neo-black bg-neo-white shadow-neo-sm
                   hover:-translate-y-0.5 transition-all duration-200
                   active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
      >
        <HiBell size={20} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-neo-red text-white
                       text-[10px] font-heading flex items-center justify-center
                       border-2 border-neo-black"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed left-2 right-2 top-[72px] w-auto bg-neo-white border-3 border-neo-black
                       shadow-neo-lg z-50 max-h-[70vh] overflow-y-auto md:absolute md:right-0 md:left-auto
                       md:top-full md:mt-2 md:w-80 md:max-h-96"
            >
              <div className="p-3 border-b-3 border-neo-black bg-neo-cream">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-heading text-xs uppercase tracking-wider">
                    Notifications
                  </h4>
                  <button
                    type="button"
                    onClick={() => refetchNotifications()}
                    className="neo-btn neo-btn-sm bg-neo-white"
                    disabled={isRefreshingList}
                  >
                    {isRefreshingList ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-body text-sm text-neo-black/55">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-neo-black/10">
                  {notifications.map((notif) => (
                    <button
                      type="button"
                      key={notif._id || notif.id}
                      onClick={() => openNotification(notif)}
                      className={`p-3 hover:bg-neo-cream transition-colors ${
                        !notif.isRead ? 'bg-neo-yellow/10 border-l-4 border-neo-yellow' : ''
                      } w-full text-left`}
                    >
                      <p className="font-body text-sm leading-relaxed">{notif.message}</p>
                      <p className="font-body text-[10px] text-neo-black/55 mt-1">
                        {formatRelative(notif.sentAt || notif.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
