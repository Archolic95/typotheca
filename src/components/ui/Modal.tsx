'use client';

import { useEffect, useCallback } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] px-4 pb-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#141414] border border-neutral-800 shadow-2xl ${className || ''}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}
