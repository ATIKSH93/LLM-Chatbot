import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from './services/api';

function App() {
  // Session ID is generated once per page load and kept in memory only.
  // It is deliberately not persisted across page reloads.
  const [sessionId] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, error]);

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }

    const trimmedMessage = input.trim();
    if (!trimmedMessage || loading) {
      return;
    }

    const userMessage = {
      id: 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      role: 'user',
      content: trimmedMessage,
    };

    // Append the user message immediately and clear the input
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      // The backend retrieves earlier conversation history from SQLite.
      // Frontend sends only the session ID and newly submitted message.
      const data = await sendChatMessage({
        sessionId,
        message: trimmedMessage,
      });

      const assistantMessage = {
        id: 'assistant-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        role: 'assistant',
        content: data.reply,
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Do not append failed requests as assistant messages.
      // Retain the error in UI state so the user can read and retry.
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      // Keep focus on input for fast follow-ups
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-600"></span>
            AI Chatbot
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Phase 4 — Frontend Client
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            Session: {sessionId.slice(0, 8)}...
          </span>
        </div>
      </header>

      {/* Conversation Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-2xl mb-4 border border-blue-100 dark:border-slate-700">
              💬
            </div>
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Start a Conversation
            </h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Send a message below. Each session tracks conversation turns automatically in SQLite.
            </p>
          </div>
        ) : (
          messages.map((msg) =>
            msg.role === 'assistant' ? (
              <div key={msg.id} className="flex justify-start">
                <div
                  data-testid="assistant-message"
                  className="max-w-2xl w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Assistant
                  </div>

                  <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {msg.metadata && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 font-mono">
                        <span>Source:</span>
                        <span data-testid="meta-source">{msg.metadata.resolution_source}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 font-mono">
                        <span>Model:</span>
                        <span data-testid="meta-model">{msg.metadata.model}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50 font-mono">
                        <span>Latency:</span>
                        <span data-testid="meta-latency">{msg.metadata.latency_ms}</span>
                        <span>ms</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 font-mono">
                        <span>In:</span>
                        <span data-testid="meta-input-tokens">{msg.metadata.input_tokens}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 font-mono">
                        <span>Out:</span>
                        <span data-testid="meta-output-tokens">{msg.metadata.output_tokens}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-xl p-4 rounded-xl bg-blue-600 text-white shadow-xs space-y-1">
                  <div className="text-xs font-medium text-blue-100">You</div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            )
          )
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-w-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>Assistant is typing...</span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start justify-between shadow-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-red-800 dark:text-red-200">Error</div>
              <div>{error}</div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 font-semibold ml-3 px-2 py-1 rounded bg-red-100/50 dark:bg-red-900/50 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Form */}
      <footer className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-sm">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
          />
          <button
            type="submit"
            data-testid="send-button"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center justify-center min-h-[44px]"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
