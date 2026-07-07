import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const onCopy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        if (timer.current != null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy item name'}
      title={copied ? 'Copied' : 'Copy item name'}
      onClick={onCopy}
      className={`text-muted hover:text-ink cursor-pointer ${className ?? ''}`}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  );
}
