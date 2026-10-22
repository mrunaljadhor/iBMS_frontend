'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * "How is this calculated?" button + pop-up used on every dashboard card.
 *
 * sections: [{
 *   heading:  'Uphill grade',                       // what the number is called on the card
 *   value:    '4.13 %',                              // the number shown on the card (optional)
 *   meaning:  'How steep the route is on average…',  // plain-language definition
 *   formula:  ['Uphill grade (%) = 100 × total climb (m) ÷ route length (m)'],
 *   steps:    ['= 100 × 1,375 ÷ 33,300', '= 4.13 %'], // the same formula with today's numbers
 *   source:   'backend/server.js → /api/feasibility'  // where it lives in the code
 * }]
 */
export default function ExplainButton({ title, intro, sections = [], label = 'View Math', disabled = false, compact = false }) {
  const [open, setOpen] = useState(false);

  // close with Escape
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          title="How is this graph calculated?"
          aria-label="How is this graph calculated?"
          style={{
            width: '20px', height: '20px', borderRadius: '9999px', flexShrink: 0,
            border: '1px solid #60a5fa', background: 'rgba(59, 130, 246, 0.25)', color: '#bfdbfe',
            fontSize: '12px', fontWeight: 'bold', lineHeight: '18px', padding: 0, cursor: 'pointer'
          }}
        >
          i
        </button>
      ) : (
      <button
          onClick={() => setOpen(true)}
          disabled={disabled}
          style={{
            fontSize: '11px',
            color: '#fff',
            backgroundColor: 'rgba(59, 130, 246, 0.55)',
            border: '1px solid #60a5fa',
            padding: '4px 9px',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap'
          }}
        >
          ⓘ {label}
        </button>
      )}

      {open && typeof document !== 'undefined' && createPortal((
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)', padding: '24px'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.97) 0%, rgba(2, 6, 23, 0.97) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '780px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', color: '#f8fafc', maxHeight: '90vh', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(51, 65, 85, 0.6)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#60a5fa' }}>{title}</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}>&times;</button>
            </div>

            {intro && <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '18px' }}>{intro}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sections.map((section) => (
                <div key={section.heading} style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(51, 65, 85, 0.55)', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#f8fafc' }}>{section.heading}</h4>
                    {section.value !== undefined && (
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8', whiteSpace: 'nowrap' }}>{section.value}</span>
                    )}
                  </div>
                  {section.meaning && (
                    <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.55, marginBottom: '8px' }}>{section.meaning}</p>
                  )}
                  {section.formula && section.formula.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <p style={{ fontSize: '10px', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Formula</p>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#fde68a', display: 'grid', gap: '3px' }}>
                        {section.formula.map((line) => <div key={line}>{line}</div>)}
                      </div>
                    </div>
                  )}
                  {section.steps && section.steps.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <p style={{ fontSize: '10px', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>With the current values</p>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#a7f3d0', display: 'grid', gap: '3px' }}>
                        {section.steps.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
                      </div>
                    </div>
                  )}
                  {section.source && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                      <span style={{ color: '#64748b' }}>Where in the code: </span>
                      <span style={{ fontFamily: 'monospace' }}>{section.source}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
