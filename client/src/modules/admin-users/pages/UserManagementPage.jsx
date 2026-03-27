import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiTrash, HiUsers, HiSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { usersApi } from '@/shared/api';
import { ROLES } from '@/shared/constants/enums';
import { StatusBadge, PageHeader, EmptyState, ConfirmDialog } from '@/shared/ui';

const PAGE_SIZE = 20;

export default function UserManagementPage() {
  const [deleteId, setDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['users', searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (searchQuery) params.q = searchQuery;
      const res = await usersApi.getAll(params);
      const payload = res?.data || {};
      return {
        users: Array.isArray(payload?.users) ? payload.users : (Array.isArray(payload) ? payload : []),
        totalPages: Number(payload?.totalPages || 1),
        currentPage: pageParam,
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.currentPage + 1 < lastPage.totalPages) {
        return lastPage.currentPage + 1;
      }
      return undefined;
    },
    initialPageParam: 0,
    refetchInterval: 60000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => usersApi.changeRole(id, role),
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries({ queryKey: ['users'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.deleteUser(id),
    onSuccess: () => { toast.success('User deleted'); queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });

  const users = data?.pages?.flatMap((page) => page.users) || [];
  const totalLoaded = users.length;
  const roleColors = { CUSTOMER: 'bg-neo-blue', VENDOR: 'bg-neo-green', ADMIN: 'bg-neo-pink' };

  const isUserVerified = (user) => {
    if (typeof user?.isEmailVerified === 'boolean') return user.isEmailVerified;
    if (typeof user?.isVerified === 'boolean') return user.isVerified;
    if (typeof user?.verified === 'boolean') return user.verified;
    return false;
  };

  const handleSearch = useCallback((e) => {
    e?.preventDefault?.();
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users loaded`} />

      <p className="font-body text-xs text-neo-black/70 mb-4">
        Manage platform access levels here. Use role changes carefully: ADMIN has full system control, VENDOR manages owned events, and CUSTOMER joins events.
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="neo-card neo-card-no-hover neo-toolbar-surface p-4 mb-4 space-y-3 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-xs uppercase tracking-wider">Search Users</h2>
            <p className="font-body text-xs text-neo-black/65 mt-1">Name and email search with lazy loading.</p>
          </div>
          <span className="neo-badge bg-neo-cream self-start sm:self-auto">Loaded {totalLoaded}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neo-black/55" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search users by name or email..."
              className="neo-input pl-9 w-full"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="neo-btn neo-btn-sm bg-neo-yellow">
              Search
            </button>
            {searchQuery && (
              <button type="button" onClick={handleClearSearch} className="neo-btn neo-btn-sm bg-neo-white">
                Clear
              </button>
            )}
          </div>
        </div>
      </form>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="neo-card h-16" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={HiUsers} title="No Users" description={searchQuery ? `No users matching "${searchQuery}"` : 'No users found'} />
      ) : (
        <div className="space-y-2">
          {users.map((user, i) => (
            <motion.div key={user._id || user.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="neo-card neo-card-no-hover neo-retroui-panel p-4 flex flex-col sm:flex-row sm:items-center gap-4 overflow-hidden">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 ${roleColors[user.role] || 'bg-neo-lavender'} border-3 border-neo-black
                              flex items-center justify-center font-heading text-sm text-white uppercase flex-shrink-0`}>
                  {user.name?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-xs uppercase tracking-wider truncate">{user.name}</p>
                  <p className="font-body text-[10px] text-neo-black/65 truncate">{user.email}</p>
                </div>
              </div>

              <div className="neo-card neo-card-no-hover neo-retroui-inset p-2 grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-3 sm:flex-shrink-0">
                <select
                  value={user.role}
                  onChange={(e) => roleMutation.mutate({ id: user._id || user.id, role: e.target.value })}
                  className="neo-select py-1.5 px-3 text-xs col-span-2 sm:col-span-1 sm:w-32"
                  aria-label={`Role for ${user.name || 'user'}`}
                >
                  {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className={`neo-badge ${isUserVerified(user) ? 'bg-neo-green' : 'bg-neo-lavender'} w-full justify-center sm:w-auto`}>
                  {isUserVerified(user) ? 'Verified' : 'Unverified'}
                </span>
                <button onClick={() => setDeleteId(user._id || user.id)} className="neo-btn neo-btn-sm bg-neo-white text-neo-red w-full justify-center sm:w-auto">
                  <HiTrash size={14} />
                </button>
              </div>
            </motion.div>
          ))}

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="neo-btn bg-neo-cream"
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More Users'}
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteMutation.mutate(deleteId); setDeleteId(null); }}
        title="Delete User" message="This will permanently remove the user." confirmLabel="Delete" danger />
    </div>
  );
}
