import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectScopePicker, scopeLabel } from '../../components/project-scope-picker';
import type { Project } from '../../lib/dashboard-utils';

const projects: Project[] = [
  { id: 'p1', name: 'Acme Rebrand', archived: false, created_at: 1 },
  { id: 'p2', name: 'Q3 Warehouse Move', archived: false, created_at: 2 },
  { id: 'p3', name: 'Old Retainer', archived: true, created_at: 3 },
];

function renderPicker(overrides: Partial<React.ComponentProps<typeof ProjectScopePicker>> = {}) {
  const props = {
    value: null as string | null,
    projects,
    onChange: vi.fn(),
    ...overrides,
  };
  render(<ProjectScopePicker {...props} />);
  return props;
}

describe('scopeLabel', () => {
  it('names the business for a null scope and the project otherwise', () => {
    expect(scopeLabel(null, projects)).toBe('Entire business');
    expect(scopeLabel('p2', projects)).toBe('Q3 Warehouse Move');
  });

  it('falls back to the business when the project is gone', () => {
    expect(scopeLabel('deleted', projects)).toBe('Entire business');
  });
});

describe('ProjectScopePicker', () => {
  it('shows the current scope on the trigger', () => {
    renderPicker({ value: 'p1' });
    expect(screen.getByRole('button', { name: /scope: acme rebrand/i })).toBeInTheDocument();
  });

  it('lists the business and active projects, hiding archived ones', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    expect(screen.getByRole('option', { name: /entire business/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /acme rebrand/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /old retainer/i })).not.toBeInTheDocument();
  });

  it('still lists an archived project while it is the selected scope', () => {
    renderPicker({ value: 'p3' });
    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    expect(screen.getByRole('option', { name: /old retainer/i })).toBeInTheDocument();
  });

  it('reports the chosen project, then the business', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    fireEvent.click(screen.getByRole('option', { name: /q3 warehouse move/i }));
    expect(onChange).toHaveBeenCalledWith('p2');

    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    fireEvent.click(screen.getByRole('option', { name: /entire business/i }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('omits the create affordance when no onCreate is given', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    expect(screen.queryByText(/new project/i)).not.toBeInTheDocument();
  });

  it('creates a project and selects it immediately', async () => {
    const onCreate = vi.fn().mockResolvedValue('p9');
    const { onChange } = renderPicker({ onCreate });

    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    fireEvent.click(screen.getByText(/new project/i));
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Nova Launch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Nova Launch'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('p9'));
  });

  it('keeps the draft open and shows why when creation fails', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('A project called "Acme Rebrand" already exists'));
    const { onChange } = renderPicker({ onCreate });

    fireEvent.click(screen.getByRole('button', { name: /scope:/i }));
    fireEvent.click(screen.getByText(/new project/i));
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Acme Rebrand' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
  });
});
