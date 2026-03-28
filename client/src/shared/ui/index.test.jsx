import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '@/shared/ui';

describe('StatusBadge', () => {
  it('renders status text with underscore replacement', () => {
    render(<StatusBadge status="PENDING_APPROVAL" />);
    expect(screen.getByText('PENDING APPROVAL')).toBeInTheDocument();
  });

  it('renders fallback safely for unknown status', () => {
    render(<StatusBadge status="UNKNOWN_STATE" />);
    expect(screen.getByText('UNKNOWN STATE')).toBeInTheDocument();
  });
});
