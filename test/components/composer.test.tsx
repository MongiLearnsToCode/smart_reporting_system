import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Composer } from '../../components/composer';

function renderComposer(overrides: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const props = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    files: [] as File[],
    onFilesAdded: vi.fn(),
    onFileRemove: vi.fn(),
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

describe('Composer', () => {
  it('renders the textarea with placeholder', () => {
    renderComposer();
    expect(screen.getByPlaceholderText(/log an expense/i)).toBeInTheDocument();
  });

  it('disables send when input is empty, enables it with text', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('enables send with non-empty text', () => {
    renderComposer({ value: 'Spent $50 on stock photos' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('enables send with a file even when text is empty', () => {
    renderComposer({ files: [new File(['x'], 'receipt.pdf', { type: 'application/pdf' })] });
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('forwards typing to onChange', () => {
    const { onChange } = renderComposer();
    fireEvent.change(screen.getByPlaceholderText(/log an expense/i), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('submits on Enter but not on Shift+Enter', () => {
    const { onSubmit } = renderComposer({ value: 'a log entry' });
    const textarea = screen.getByPlaceholderText(/log an expense/i);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('renders file chips with name, size, and working remove buttons', () => {
    const files = [
      new File(['abc'], 'notes.txt', { type: 'text/plain' }),
      new File([new ArrayBuffer(2048)], 'photo.png', { type: 'image/png' }),
    ];
    const { onFileRemove } = renderComposer({ files });
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText('3B')).toBeInTheDocument();
    expect(screen.getByText('2.0KB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo.png' }));
    expect(onFileRemove).toHaveBeenCalledWith(1);
  });

  it('adds files picked through the attach input and resets it', () => {
    const { onFilesAdded } = renderComposer();
    const input = screen.getByLabelText('Attach files').querySelector('input[type="file"]')!;
    const file = new File(['data'], 'expenses.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesAdded).toHaveBeenCalledWith([file]);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('shows a stop button instead of send while processing', () => {
    const onStop = vi.fn();
    renderComposer({ isProcessing: true, onStop, value: 'processing…' });
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('renders the mic button only when onMicClick is provided', () => {
    renderComposer();
    expect(screen.queryByRole('button', { name: 'Dictate' })).not.toBeInTheDocument();
  });

  it('invokes onMicClick from the mic button', () => {
    const onMicClick = vi.fn();
    renderComposer({ onMicClick });
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));
    expect(onMicClick).toHaveBeenCalledOnce();
  });

  it('disables the textarea and send button when disabled', () => {
    renderComposer({ disabled: true, value: 'text present' });
    expect(screen.getByPlaceholderText(/log an expense/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
