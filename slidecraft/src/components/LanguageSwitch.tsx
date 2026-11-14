import { Languages } from 'lucide-react';
import { LANGS, useLang, useT } from '@/i18n';
import { MenuButton, Popover, cx } from './ui';

/** Language switcher (Tiếng Việt / English). `compact` = icon + code only. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const t = useT();
  return (
    <Popover align="right" width={180} trigger={(_o, toggle) => (
      <button onClick={toggle} title={t('Language')} aria-label={t('Language')} data-testid="lang-switch"
        className={cx('inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white')}>
        <Languages size={15} />{compact ? LANGS.find((l) => l.id === lang)?.flag : LANGS.find((l) => l.id === lang)?.label}
      </button>
    )}>
      {(close) => <>{LANGS.map((l) => (
        <MenuButton key={l.id} onClick={() => { setLang(l.id); close(); }} testId={`lang-${l.id}`} icon={l.id === lang ? '✓' : ''}>{l.label}</MenuButton>
      ))}</>}
    </Popover>
  );
}
