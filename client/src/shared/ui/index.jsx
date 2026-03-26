import { cn } from '@/shared/utils/cn';

export function StatusBadge({ status, className }) {
  const colors = {
    // Event statuses
    DRAFT: 'bg-neo-lavender text-neo-black',
    PENDING_APPROVAL: 'bg-neo-orange text-white',
    PUBLISHED: 'bg-neo-blue text-white',
    ONGOING: 'bg-neo-green text-neo-black',
    COMPLETED: 'bg-neo-purple text-white',
    CANCELLED: 'bg-neo-red text-white',
    // Registration statuses
    REGISTERED: 'bg-neo-green text-neo-black',
    CHECKED_IN: 'bg-neo-blue text-white',
    WAITLISTED: 'bg-neo-yellow text-neo-black',
    // Assignment
    PENDING: 'bg-neo-lavender text-neo-black',
    CONFIRMED: 'bg-neo-green text-neo-black',
    // Application
    APPROVED: 'bg-neo-green text-neo-black',
    REJECTED: 'bg-neo-red text-white',
    WITHDRAWN: 'bg-neo-cream text-neo-black/70',
  };

  return (
    <span
      className={cn(
        'neo-badge',
        colors[status] || 'bg-neo-lavender text-neo-black',
        className
      )}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

export function PageHeader({ title, subtitle, action, children }) {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl uppercase tracking-wider text-neo-black">
            {title}
          </h1>
          {subtitle && (
            <p className="text-body mt-1">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="neo-card bg-neo-cream p-8 md:p-10 text-center">
      {Icon && <Icon className="mx-auto text-4xl text-neo-orange mb-4" size={48} />}
      <h3 className="font-heading text-lg uppercase tracking-wider mb-2">{title}</h3>
      {description && (
        <p className="text-body mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="neo-card bg-neo-red/10 border-neo-red p-8 text-center">
      <p className="font-heading text-lg uppercase tracking-wider text-neo-red mb-4">
        Something went wrong
      </p>
      <p className="text-body mb-6">{message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="neo-btn-primary neo-btn-sm">
          Try Again
        </button>
      )}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('neo-card p-6 animate-pulse', className)}>
      <div className="h-40 bg-neo-lavender/60 mb-4" />
      <div className="h-4 bg-neo-lavender/60 w-3/4 mb-2" />
      <div className="h-3 bg-neo-lavender/50 w-1/2 mb-4" />
      <div className="h-8 bg-neo-lavender/70 w-1/3" />
    </div>
  );
}

export function NeoCard({ children, className, color, ...props }) {
  return (
    <div
      className={cn('neo-card', color && `border-l-8 ${color}`, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative neo-card bg-neo-white p-6 w-full max-w-md animate-pop-in">
        <h3 className="font-heading text-lg uppercase tracking-wider mb-3">{title}</h3>
        <p className="text-body mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="neo-btn neo-btn-sm bg-neo-white">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn('neo-btn neo-btn-sm', danger ? 'bg-neo-red text-white' : 'bg-neo-yellow')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, description, children, footer }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:p-6">
      <button
        type="button"
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div className="relative w-full max-w-2xl neo-card bg-neo-white p-6 animate-slide-up">
        <div className="mx-auto mb-4 h-1.5 w-14 bg-neo-black/20" />
        {title ? <h3 className="font-heading text-lg uppercase tracking-wider mb-2">{title}</h3> : null}
        {description ? <p className="text-body mb-5">{description}</p> : null}
        {children}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
