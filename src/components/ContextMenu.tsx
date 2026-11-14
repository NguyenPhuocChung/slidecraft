import { useRef } from 'react';
import { useOutsideClick, cx } from './ui';

export type MenuItem = { sep: true } | { label: string; shortcut?: string; disabled?: boolean; action: () => void; sep?: false };

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose);
  return (
    <div ref={ref} data-ctx-menu className="absolute z-50 w-56 rounded-xl border border-ink-200 bg-white p-1 shadow-xl dark:border-ink-700 dark:bg-ink-900" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it, i) =>
        it.sep ? <div key={i} className="my-1 h-px bg-ink-100 dark:bg-ink-800" /> : (
          <button key={i} disabled={it.disabled} onClick={() => { it.action(); onClose(); }} className={cx('flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-800 hover:bg-ink-100 disabled:opacity-40 dark:text-ink-100 dark:hover:bg-ink-800')}>
            <span>{it.label}</span>
            {it.shortcut && <span className="text-[11px] text-ink-400">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
