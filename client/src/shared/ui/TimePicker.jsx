export default function TimePicker({ value, onChange, id, disabled = false, className = '' }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 w-full ${className}`}>
      <input
        id={id}
        type="time"
        step={60}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value || '')}
        disabled={disabled}
        className="neo-input py-2 px-3 text-sm w-full min-h-[42px]"
        aria-label="Time"
      />
    </div>
  );
}
