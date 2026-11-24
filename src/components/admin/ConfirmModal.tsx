'use client';

import React from 'react';
import { AlertTriangle, Rocket, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'انصراف',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isDanger
                  ? 'bg-[#DC4444]/10 text-[#DC4444]'
                  : 'bg-[#20A36B]/10 text-[#20A36B]'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Rocket className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <h2 id="confirm-modal-title" className="text-base font-bold text-[#142B4A]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="بستن"
            disabled={busy}
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F2F7FC] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#1E293B]">{message}</p>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[42px] rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F2F7FC] cursor-pointer whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-[42px] rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer whitespace-nowrap ${
              isDanger
                ? 'bg-[#DC4444] hover:bg-[#B91C1C]'
                : 'bg-[#20A36B] hover:bg-[#198758]'
            }`}
          >
            {busy ? 'در حال انجام...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
