import type { Asset, ImageRef } from '@/types/schema';
import type { MediaResult } from '@/media/resolver';
import { useEditor } from '@/stores/editor';
import { Modal } from '@/components/ui';
import { MediaPanel } from '../LeftPanels';

/** Pick an image from providers, uploads or URL. Uploaded files are stored as presentation assets. */
export function MediaPicker({ open, onClose, onPick, title = 'Choose image' }: { open: boolean; onClose: () => void; onPick: (ref: ImageRef) => void; title?: string }) {
  const handle = (r: MediaResult | Asset) => {
    if ('thumb' in r && 'provider' in r) { const m = r as MediaResult; onPick({ src: m.url, alt: m.alt, credit: m.credit, license: m.license, sourceUrl: m.sourceUrl }); return; }
    const a = r as Asset;
    useEditor.getState().commit('Add asset', (d) => { if (!d.assets.some((x) => x.id === a.id)) d.assets.push(a as never); });
    onPick({ src: `asset:${a.id}`, alt: a.name, license: a.license as string | undefined, credit: a.credit as string | undefined });
  };
  return (
    <Modal open={open} onClose={onClose} title={title} width={760} testId="media-picker">
      <div className="h-[60vh]"><MediaPanel onPick={handle} /></div>
    </Modal>
  );
}
