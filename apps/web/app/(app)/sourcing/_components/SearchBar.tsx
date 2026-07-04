/**
 * SearchBar — query input for the sourcing workspace.
 *
 * Fires onQueryChange on every keystroke (debounced at the WorkspaceClient
 * level via the parent's handleSearch). Design: design/sourcing-workspace.html
 * "Query Builder" search input, §10 zinc/emerald tokens.
 *
 * Accessibility: labeled search input, focus ring, keyboard-operable.
 */

'use client';

import { useRef } from 'react';

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  isSearching: boolean;
}

export function SearchBar({ query, onQueryChange, isSearching }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: 'relative', maxWidth: '480px', width: '100%' }}>
      {/* Search icon or spinner */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
          color: '#9ca3af',
        }}
      >
        {isSearching ? <SpinnerIcon /> : <SearchIcon />}
      </span>

      <input
        ref={inputRef}
        type="search"
        aria-label="Search companies by name or domain"
        placeholder="Search companies by name or domain…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        style={{
          width: '100%',
          height: '36px',
          paddingLeft: '36px',
          paddingRight: query ? '36px' : '12px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor: '#ffffff',
          fontSize: '14px',
          color: '#111827',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
          (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
          (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
        }}
      />

      {/* Clear button */}
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onQueryChange('');
            inputRef.current?.focus();
          }}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#e5e7eb',
            color: '#6b7280',
            cursor: 'pointer',
            padding: 0,
            fontSize: '12px',
            lineHeight: 1,
          }}
        >
          <XSmallIcon />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icons
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
