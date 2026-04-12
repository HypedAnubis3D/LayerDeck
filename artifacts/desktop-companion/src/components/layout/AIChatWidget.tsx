import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Trash2, ChevronDown, Bot } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/use-collections';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

const SUGGESTIONS = [
  "What's the print queue looking like?",
  "Best slicer settings for creature balls on the P1S?",
  "How does 3MF auto-fill work when logging a print?",
  "My Etsy orders aren't importing — how does it work?",
  "How do I track remaining grams on a spool?",
  "P1 Closet MQTT — what topic shows print progress?",
];

function fmt() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMarkdown(text: string) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="anubis-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<div class="anubis-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="anubis-h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="anubis-h1">$1</div>')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>(\n)?)+/g, (m) => `<ul class="anubis-ul">${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function buildContext(metrics: Record<string, number> | null | undefined): string {
  if (!metrics) return 'No live metrics available.';
  const lines: string[] = [
    `3MF Library: ${metrics.libraryCount ?? 0} files`,
    `Catalog items: ${metrics.catalogCount ?? 0}`,
    `Open orders: ${metrics.openOrdersCount ?? 0}`,
    `Active print jobs in queue: ${metrics.activePrintJobs ?? 0}`,
    `Spools tracked: ${metrics.spoolCount ?? 0}`,
    `Upcoming conventions: ${metrics.upcomingConventions ?? 0}`,
  ];
  return lines.join('\n');
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([{
    role: 'assistant',
    content: "The scales are balanced. ANUBIS is online.\n\nI know your setup cold — A1, P1 Room, P1 Closet, the Pi Hub, every Discord webhook, every spool in your stash.\n\nWhat do you need?",
    time: fmt(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSug, setShowSug] = useState(true);
  const histRef = useRef<{ role: string; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { data: metrics } = useDashboardMetrics();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const send = useCallback(async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    setShowSug(false);
    setInput('');
    const userMsg: Message = { role: 'user', content: t, time: fmt() };
    setMsgs(p => [...p, userMsg]);
    histRef.current = [...histRef.current, { role: 'user', content: t }];
    setLoading(true);

    const context = buildContext(metrics as Record<string, number> | null | undefined);
    const assistantMsg: Message = { role: 'assistant', content: '', time: fmt() };
    setMsgs(p => [...p, assistantMsg]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: histRef.current, context }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string };
            if (parsed.text) {
              fullText += parsed.text;
              setMsgs(p => {
                const copy = [...p];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullText };
                return copy;
              });
            }
          } catch { /* partial chunk */ }
        }
      }

      histRef.current = [...histRef.current, { role: 'assistant', content: fullText }];
    } catch {
      setMsgs(p => {
        const copy = [...p];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: '⚠ Connection error. Try again.' };
        return copy;
      });
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [input, loading, metrics]);

  const clear = () => {
    histRef.current = [];
    setShowSug(true);
    setMsgs([{ role: 'assistant', content: 'Session cleared. Ready.', time: fmt() }]);
  };

  return (
    <>
      <style>{`
        .anubis-code { background: rgba(34,211,238,0.12); color: #22d3ee; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 12px; }
        .anubis-ul { margin: 6px 0; padding-left: 18px; }
        .anubis-ul li { margin: 2px 0; }
        .anubis-h1 { font-size: 14px; font-weight: 700; color: #C9A84C; margin: 10px 0 4px; }
        .anubis-h2 { font-size: 13px; font-weight: 700; color: #22d3ee; margin: 8px 0 4px; }
        .anubis-h3 { font-size: 12px; font-weight: 600; color: #7ec8d8; margin: 6px 0 3px; }
        @keyframes anubis-dot { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }
        @keyframes anubis-fadeup { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .anubis-msg { animation: anubis-fadeup 0.18s ease-out both; }
        .anubis-scrollbar::-webkit-scrollbar { width: 3px; }
        .anubis-scrollbar::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 2px; }
        .anubis-sug:hover { background: rgba(34,211,238,0.1) !important; border-color: rgba(34,211,238,0.4) !important; color: #22d3ee !important; }
        .anubis-textarea:focus { outline: none; }
        .anubis-textarea::placeholder { color: #1e3040; }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#0a0f1a' : 'linear-gradient(135deg,#C9A84C,#a07830)',
          border: '1px solid rgba(201,168,76,0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease', color: open ? '#C9A84C' : '#0a0f1a',
        }}
        title="ANUBIS — LayerDeck AI"
      >
        {open ? <ChevronDown size={20} /> : <Bot size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 9997,
          width: 380, height: 560, maxHeight: 'calc(100vh - 110px)',
          background: '#0a0f1a', border: '1px solid rgba(34,211,238,0.15)',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 60px rgba(0,0,0,0.8)',
          animation: 'anubis-fadeup 0.2s ease-out both',
          fontFamily: 'monospace',
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(34,211,238,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(201,168,76,0.04)', borderRadius: '16px 16px 0 0',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg,#C9A84C,#a07830)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#0a0f1a',
              }}>A</div>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 11, fontWeight: 700, letterSpacing: 3 }}>ANUBIS</div>
                <div style={{ color: '#1a3040', fontSize: 8, letterSpacing: 1.5 }}>LAYERDECK AI</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 5px #22d3ee' }} />
                <span style={{ color: '#1a4050', fontSize: 8, letterSpacing: 1 }}>ONLINE</span>
              </div>
              <button onClick={clear} title="Clear chat" style={{ background: 'none', border: 'none', color: '#2a3848', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <Trash2 size={12} />
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#2a3848', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="anubis-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 6px' }}>
            {msgs.map((m, i) => {
              const isU = m.role === 'user';
              return (
                <div key={i} className="anubis-msg" style={{
                  display: 'flex', flexDirection: isU ? 'row-reverse' : 'row',
                  alignItems: 'flex-start', gap: 7, marginBottom: 12,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    background: isU ? '#1e2435' : 'linear-gradient(135deg,#C9A84C,#a07830)',
                    border: isU ? '1px solid #2d3748' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: isU ? '#4a5568' : '#0a0f1a',
                  }}>{isU ? 'T' : 'A'}</div>
                  <div style={{
                    maxWidth: '82%',
                    background: isU ? '#1a1f2e' : '#111826',
                    border: isU ? '1px solid #2d3748' : '1px solid rgba(34,211,238,0.12)',
                    borderRadius: isU ? '12px 3px 12px 12px' : '3px 12px 12px 12px',
                    padding: '8px 11px',
                  }}>
                    {!isU && <div style={{ fontSize: 7, color: '#22d3ee', letterSpacing: 2, marginBottom: 3, opacity: 0.6 }}>ANUBIS</div>}
                    <div
                      style={{ color: isU ? '#7a8899' : '#9ab8c8', fontSize: 12.5, lineHeight: 1.65, fontFamily: isU ? 'monospace' : 'inherit' }}
                      dangerouslySetInnerHTML={{ __html: isU ? m.content.replace(/</g, '&lt;') : renderMarkdown(m.content) }}
                    />
                    <div style={{ fontSize: 8, color: '#1a2535', marginTop: 3, textAlign: 'right' }}>{m.time}</div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#22d3ee',
                    animation: 'anubis-dot 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.18}s`,
                  }} />
                ))}
                <span style={{ color: '#1a4050', fontSize: 9, letterSpacing: 1.5 }}>PROCESSING</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSug && !loading && (
            <div style={{ padding: '0 10px 6px', display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="anubis-sug" onClick={() => send(s)} style={{
                  background: 'rgba(34,211,238,0.03)', border: '1px solid rgba(34,211,238,0.1)',
                  color: '#1e4050', fontSize: 10, padding: '4px 9px', borderRadius: 20,
                  cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.15s ease',
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '8px 10px 10px', borderTop: '1px solid rgba(34,211,238,0.08)', flexShrink: 0, display: 'flex', gap: 7, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, border: '1px solid rgba(34,211,238,0.15)', borderRadius: 8, background: '#0c1018', overflow: 'hidden' }}>
              <textarea
                ref={inputRef}
                className="anubis-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask about printers, queue, filament, workflow…"
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'transparent',
                  border: 'none', color: '#6ab8c8', fontSize: 12, padding: '9px 11px',
                  resize: 'none', fontFamily: 'monospace', lineHeight: 1.5,
                }}
              />
            </div>
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                background: loading || !input.trim() ? 'rgba(34,211,238,0.06)' : 'linear-gradient(135deg,#22d3ee,#0891b2)',
                border: '1px solid rgba(34,211,238,0.2)',
                color: loading || !input.trim() ? '#1a3040' : '#061018',
                fontSize: 14, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
