import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricCard } from '../../components/metric-card';

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="Revenue" value={42000} unit="USD" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('42000')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('renders fallback when value is null', () => {
    render(<MetricCard title="Empty" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows positive sentiment', () => {
    render(<MetricCard title="Sales" value={100} sentiment="positive" />);
    expect(screen.getByText('POSITIVE')).toBeInTheDocument();
  });

  it('shows negative sentiment', () => {
    render(<MetricCard title="Sales" value={100} sentiment="negative" />);
    expect(screen.getByText('NEGATIVE')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<MetricCard title="Clickable" value={1} onClick={onClick} />);
    fireEvent.click(screen.getByText('Clickable').closest('div')!);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
