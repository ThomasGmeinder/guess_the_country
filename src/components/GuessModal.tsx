import { useEffect, useRef, useState } from 'react';
import { getHint } from '../data/hints';
import type { GeoJSONFeature } from '../data/types';

export interface GuessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (guess: string) => void;
  result: 'pending' | 'correct' | 'wrong' | null;
  pointsEarned: number | null;
  selectedFeature: GeoJSONFeature | null;
}

export default function GuessModal({ isOpen, onClose, onSubmit, result, pointsEarned, selectedFeature }: GuessModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
      setShowHint(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value?.trim() ?? '';
    if (value) onSubmit(value);
  };

  const hint = selectedFeature ? getHint(selectedFeature.properties.ISO_A2) : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2e',
          color: '#eee',
          padding: '1.5rem 2rem',
          borderRadius: 12,
          minWidth: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 1rem', fontSize: 15 }}>
          Type the English name of the country you clicked.
        </p>
        {result === 'correct' && pointsEarned != null && (
          <p style={{ margin: '0 0 0.5rem', color: '#6ee7b7', fontWeight: 600 }}>
            Correct! +{pointsEarned} points
          </p>
        )}
        {result === 'wrong' && (
          <>
            <p style={{ margin: '0 0 0.5rem', color: '#fca5a5', fontWeight: 600 }}>
              Wrong. Try another country.
            </p>
            {!showHint ? (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  width: '100%',
                  fontWeight: 500,
                }}
              >
                Get a hint
              </button>
            ) : (
              <p style={{ margin: '0 0 1rem', color: '#fbbf24', fontStyle: 'italic', padding: '0.75rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 6 }}>
                💡 {hint}
              </p>
            )}
          </>
        )}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Country name"
            disabled={result === 'correct'}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              fontSize: 16,
              border: '1px solid #444',
              borderRadius: 8,
              background: '#0f0f1a',
              color: '#eee',
              marginBottom: '1rem',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                background: '#333',
                color: '#ccc',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            {result !== 'correct' && (
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Submit
              </button>
            )}
            {result === 'correct' && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
