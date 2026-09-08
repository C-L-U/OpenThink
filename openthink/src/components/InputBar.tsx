import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';

export default function InputBar({ centered }: { centered?: boolean }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const status = useStore((s) => s.status);
  const participants = useStore((s) => s.participants);
  const startDebate = useStore((s) => s.startDebate);
  const inputFocusToken = useStore((s) => s.inputFocusToken);
  const [hint, setHint] = useState<string | null>(null);
  const t = useT();

  const running = status === 'running';

  // Global shortcuts ("/", Ctrl+K) bump the token to focus this textarea.
  useEffect(() => {
    if (inputFocusToken > 0) textareaRef.current?.focus();
  }, [inputFocusToken]);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  const submit = () => {
    const query = value.trim();
    if (!query) return;
    if (participants.length === 0) {
      setHint(t('input.noModels'));
      return;
    }
    setHint(null);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    void startDebate(query);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!running) submit();
    }
  };

  return (
    <div className={centered ? 'w-full max-w-2xl' : 'w-full max-w-3xl mx-auto'}>
      <div className="relative flex items-end rounded-2xl border border-edge bg-raised shadow-lg focus-within:border-faint transition-colors">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHint(null);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          placeholder={t('input.placeholder')}
          disabled={running}
          className="w-full resize-none bg-transparent px-4 py-4 pr-14 text-[15px] leading-6 text-strong placeholder-faint outline-none disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={running || !value.trim()}
          aria-label={t('input.send')}
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-strong text-[rgb(var(--c-bg))] transition hover:opacity-90 active:scale-90 disabled:opacity-30 disabled:hover:opacity-30 disabled:active:scale-100"
        >
          {running ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-base/40 border-t-base" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="mt-2 text-center text-sm text-amber-400">{hint}</p>}
    </div>
  );
}
