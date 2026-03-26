import { useId, useState } from 'react';
import eyeClosedIcon from '@/assets/eye-closed-svgrepo-com.svg';
import eyeScanIcon from '@/assets/eye-scan-svgrepo-com.svg';
import { getPasswordStrength } from '@/shared/utils/passwordStrength';

export default function PasswordInput({
  label,
  registration,
  error,
  placeholder = '••••••••',
  showStrength = false,
  passwordValue = '',
  id,
  name,
  autoComplete = 'current-password',
}) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId().replace(/:/g, '');
  const inputName = name || registration?.name;
  const inputId = id || inputName || `password-${generatedId}`;
  const strength = getPasswordStrength(passwordValue);

  return (
    <div>
      <label className="neo-label" htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          {...registration}
          name={inputName}
          autoComplete={autoComplete}
          className="neo-input pr-14"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-2 my-auto h-10 w-10 border-2 border-neo-black
                     bg-neo-white shadow-neo-sm flex items-center justify-center
                     hover:bg-neo-cream transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <img
            src={visible ? eyeClosedIcon : eyeScanIcon}
            alt=""
            aria-hidden="true"
            className="h-5 w-5"
            loading="lazy"
            decoding="async"
          />
        </button>
      </div>

      {showStrength && (
        <div className="mt-2">
          <div className="h-2 w-full border-2 border-neo-black bg-neo-white">
            <div
              className={`h-full ${strength.colorClass} transition-all duration-300`}
              style={{ width: `${(strength.score / 6) * 100}%` }}
            />
          </div>
          <p className={`font-body text-xs mt-1 ${strength.textClass}`}>
            Strength: {strength.label}
          </p>
        </div>
      )}

      {error && (
        <p className="font-body text-xs text-neo-red mt-1">{error}</p>
      )}
    </div>
  );
}
