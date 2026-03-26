const PASSWORD_CHECKS = [
  (password) => password.length >= 8,
  (password) => /[A-Z]/.test(password),
  (password) => /[a-z]/.test(password),
  (password) => /\d/.test(password),
  (password) => /[^A-Za-z0-9]/.test(password),
  (password) => password.length >= 12,
];

export function getPasswordStrength(password) {
  const value = String(password || '');

  if (!value) {
    return {
      score: 0,
      label: 'No password',
      colorClass: 'bg-neo-lavender',
      textClass: 'text-neo-black/65',
    };
  }

  const score = PASSWORD_CHECKS.reduce((total, check) => total + (check(value) ? 1 : 0), 0);

  if (score <= 2) {
    return {
      score,
      label: 'Weak',
      colorClass: 'bg-neo-red',
      textClass: 'text-neo-red',
    };
  }

  if (score <= 4) {
    return {
      score,
      label: 'Medium',
      colorClass: 'bg-neo-orange',
      textClass: 'text-neo-orange',
    };
  }

  return {
    score,
    label: 'Strong',
    colorClass: 'bg-neo-green',
    textClass: 'text-neo-green',
  };
}
