import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className={`relative transform overflow-hidden rounded-3xl bg-white/85 backdrop-blur-2xl text-left shadow-2xl shadow-black/20 transition-all sm:my-8 w-full ${maxWidth} border border-white/70`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
            <h3 className="text-base font-medium tracking-tight text-black">{title}</h3>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:bg-black/5 hover:text-black transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 max-h-[78vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
