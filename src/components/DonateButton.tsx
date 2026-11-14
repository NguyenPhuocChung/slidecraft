import { useEffect, useState } from 'react';
import { Copy, Download, Heart } from 'lucide-react';
import { tr } from '@/i18n';
import { Modal, cx, toast } from './ui';

/**
 * Donation info — edit here to change the account shown in the app.
 * The QR picture is public/donate-qr.webp (VietQR / NAPAS, scannable by every Vietnamese bank app).
 */
export const DONATE = {
  qr: '/donate-qr.webp',
  name: 'NGUYEN PHUOC CHUNG',
  account: '7411034915',
  bank: 'BIDV — CN TP Cần Thơ',
};

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success(tr('Copied: {text}', { text })); }
  catch { toast.error(tr('Could not copy — please copy it by hand.')); }
}

export function DonateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Heart size={16} className="fill-rose-500 text-rose-500" />{tr('Support SlideCraft')}</span>} width={440} testId="donate-dialog">
      <div className="space-y-4 text-[13px] text-ink-700 dark:text-ink-200">
        <p className="leading-relaxed">{tr('SlideCraft is free for everyone. If it helps you and you would like to support the author, scan the QR code with any banking app to send a donation. Thank you very much!')}</p>
        <div className="mx-auto w-[240px] rounded-2xl bg-white p-1 shadow-sm ring-1 ring-ink-100">
          <img src={DONATE.qr} alt={tr('Donation QR code')} className="w-full" draggable={false} data-testid="donate-qr" />
        </div>
        <div className="space-y-1.5 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
          <Row label={tr('Account holder')} value={DONATE.name} />
          <Row label={tr('Account number')} value={DONATE.account} onCopy={() => copyText(DONATE.account)} />
          <Row label={tr('Bank')} value={DONATE.bank} />
        </div>
        <div className="flex justify-center">
          <a href={DONATE.qr} download="SlideCraft-donate-QR.webp" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"><Download size={14} />{tr('Save QR image')}</a>
        </div>
        <p className="text-center text-[11px] text-ink-400">{tr('Donating is completely optional — every feature stays free.')}</p>
      </div>
    </Modal>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-ink-500">{label}</span>
      <span className="flex-1 font-semibold text-ink-900 dark:text-white">{value}</span>
      {onCopy && <button onClick={onCopy} title={tr('Copy')} className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-brand-700 hover:bg-white dark:text-brand-300 dark:hover:bg-ink-700" data-testid="donate-copy"><Copy size={13} />{tr('Copy')}</button>}
    </div>
  );
}

/** Heart button that opens the donation QR. `compact` = icon only (editor top bar). */
export function DonateButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const o = () => setOpen(true); window.addEventListener('slidecraft:donate', o); return () => window.removeEventListener('slidecraft:donate', o); }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} title={tr('Support the author (donate)')} data-testid="donate-button"
        className={cx('flex h-8 items-center gap-1.5 rounded-lg text-[13px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10', compact ? 'w-8 justify-center' : 'px-2.5')}>
        <Heart size={15} className="fill-current" />{!compact && <span className="hidden sm:inline">{tr('Donate')}</span>}
      </button>
      <DonateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
