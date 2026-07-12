import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:3000';

// ── 工具函数 ──────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function storageKey(userId) {
  return `agent_sessions_${userId}`;
}

function loadSessions(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
  } catch {
    return [];
  }
}

function saveSessions(userId, sessions) {
  try {
    // 最多保留 30 条，超出删最旧的
    const trimmed = sessions.slice(-30);
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
  } catch {}
}

function sessionTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  return first.content.length > 40
    ? first.content.slice(0, 40) + '...'
    : first.content;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── RAG / Agent 调用 ──────────────────────────────────────

async function runAgentAction(input, token) {
  const analyzeMatch =
    input.match(/analyze\s+([\w-]+)/i) ||
    input.match(/分析\s*([\w-]+)/i);

  if (analyzeMatch) {
    const cellCode = analyzeMatch[1].toUpperCase();
    const res = await axios.post(
      `${API}/api/agent/analyze/${cellCode}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const r = res.data.report;
    const anomalyLines = r.anomalies.map(
      a => `• ${a.anomaly_type} — ${a.message} (${a.severity})`
    ).join('\n');
    const ragLine = r.rag_references[0]
      ? `\n\n📖 Spec reference:\n"${r.rag_references[0].reference_text.slice(0, 120)}..."`
      : '';

    let actionLine;
    if (r.action_taken) {
      actionLine = `\n\n✅ Action: ${r.action_taken}`;
    } else {
      const step5 = r.steps.find(s => s.step === 5);
      const errorCode = step5?.result?.error_code;
      if (errorCode === 'INVALID_STATE_TRANSITION' &&
          step5?.result?.current_state === step5?.result?.attempted_state) {
        actionLine = `\n\nℹ️ Cell is already in ${step5.result.current_state} state. No change needed.`;
      } else if (errorCode === 'INVALID_STATE_TRANSITION') {
        actionLine = `\n\n🚫 Action blocked: your role (${step5.result.role}) does not have permission to change state from ${step5.result.current_state} to ${step5.result.attempted_state}.`;
      } else {
        actionLine = `\n\nNo state change was needed.`;
      }
    }
    return `Analysis complete for ${r.cell_code}:\n\n${anomalyLines || '✅ No anomalies detected.'}${ragLine}${actionLine}`;
  }

  const queryMatch =
    input.match(/(?:query|search|what is|look up|find)\s+(.+)/i) ||
    input.match(/(?:查询|查找|什么是)\s*(.+)/i);

  if (queryMatch) {
    const res = await axios.post(
      `${API}/api/agent/query`,
      { question: queryMatch[1] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const results = res.data.results || [];
    if (!results.length) return 'No relevant results found in the spec.';
    return `Top result from USABC spec (similarity: ${results[0].similarity}):\n\n"${results[0].text}"`;
  }

  return null;
}

// ── 子组件 ────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#1D1D1F', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, marginRight: 8, flexShrink: 0, alignSelf: 'flex-end'
        }}>✦</div>
      )}
      <div style={{
        maxWidth: '80%',
        background: isUser ? '#0A84FF' : '#F2F2F7',
        color: isUser ? 'white' : '#1D1D1F',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '9px 13px', fontSize: 13, lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text'
      }}>
        {msg.content}
      </div>
    </div>
  );
}

function WELCOME_MSG(username) {
  return {
    role: 'agent',
    content: `Hi${username ? ' ' + username : ''}! I'm your CellVantage Agent.\n\n⚡ What I can do:\n• analyze <cell_code> — run anomaly detection (lab_operator only, cell must be Under Test)\n• query <spec question> — search the USABC battery spec\n\nExamples:\n  analyze SIM-0081\n  query safe temperature limits for cycle testing`
  };
}

// ── 主组件 ────────────────────────────────────────────────

export default function AgentCopilot() {
  const { token, user } = useAuth();

  const [mode, setMode] = useState('ball');           // 'ball' | 'window' | 'fullscreen'
  const [view, setView] = useState('chat');           // 'chat' | 'history'
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);  // { id, messages, createdAt }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [ballPos, setBallPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [winPos, setWinPos] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 580 });

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const winDragging = useRef(false);
  const winDragOffset = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const currentUserId = useRef(null);

  // 初始化：加载当前用户的历史，开一个新 session
  useEffect(() => {
    if (!user) return;
    if (currentUserId.current === user.id) return;  // 同一用户不重复初始化
    currentUserId.current = user.id;

    const saved = loadSessions(user.id);
    setSessions(saved);
    startNewSession();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // ── 拖动逻辑 ──────────────────────────────────────────
  const onBallMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    didDrag.current = true;
    setBallPos({
      x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.current.y))
    });
  }, []);
  const onBallMouseUp = useCallback(() => { dragging.current = false; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onBallMouseMove);
    window.addEventListener('mouseup', onBallMouseUp);
    return () => {
      window.removeEventListener('mousemove', onBallMouseMove);
      window.removeEventListener('mouseup', onBallMouseUp);
    };
  }, [onBallMouseMove, onBallMouseUp]);

  const onWinMouseMove = useCallback((e) => {
    if (!winDragging.current) return;
    setWinPos({
      x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - winDragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 560, e.clientY - winDragOffset.current.y))
    });
  }, []);
  const onWinMouseUp = useCallback(() => { winDragging.current = false; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  }, [onWinMouseMove, onWinMouseUp]);

  if (!user) return null;

  // ── Session 管理 ──────────────────────────────────────

  function startNewSession() {
    const newSession = {
      id: genId(),
      messages: [WELCOME_MSG(user?.username)],
      createdAt: Date.now()
    };
    setCurrentSession(newSession);
    setView('chat');
  }

  function saveCurrentSession(updatedSession) {
    if (!user?.id) return;
    // 只有有用户消息才存
    const hasUserMsg = updatedSession.messages.some(m => m.role === 'user');
    if (!hasUserMsg) return;

    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== updatedSession.id);
      const updated = [...filtered, {
        id: updatedSession.id,
        title: sessionTitle(updatedSession.messages),
        messages: updatedSession.messages,
        createdAt: updatedSession.createdAt,
        updatedAt: Date.now()
      }];
      saveSessions(user.id, updated);
      return updated;
    });
  }

  function loadSession(session) {
    // 先保存当前对话
    if (currentSession) saveCurrentSession(currentSession);
    setCurrentSession({ ...session });
    setView('chat');
  }

  function deleteSession(e, sessionId) {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveSessions(user.id, updated);
      return updated;
    });
  }

  // ── 发送消息 ──────────────────────────────────────────

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !currentSession) return;

    const userMsg = { role: 'user', content: text };
    const updatedWithUser = {
      ...currentSession,
      messages: [...currentSession.messages, userMsg]
    };
    setCurrentSession(updatedWithUser);
    setInput('');
    setLoading(true);

    try {
      const actionResult = await runAgentAction(text, token);
      const agentMsg = {
        role: 'agent',
        content: actionResult || "I can help you:\n• analyze <cell_code> — anomaly detection (lab_operator, Under Test cells only)\n• query <question> — search the USABC spec\n\nExample: analyze SIM-0081"
      };
      const final = { ...updatedWithUser, messages: [...updatedWithUser.messages, agentMsg] };
      setCurrentSession(final);
      saveCurrentSession(final);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      const errorCode = err.response?.data?.error_code;

      let content;
      if (errorCode === 'INVALID_CELL_STATE') {
        content = `⚠️ ${serverMsg}\n\nWorkflow reminder:\nReceived → Incoming QC → Storage → Under Test → Agent can analyze here`;
      } else {
        content = `Error: ${serverMsg || err.message}`;
      }
      const errMsg = { role: 'agent', content };
      const final = { ...updatedWithUser, messages: [...updatedWithUser.messages, errMsg] };
      setCurrentSession(final);
      saveCurrentSession(final);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const onBallMouseDown = (e) => {
    dragging.current = true;
    didDrag.current = false;
    dragOffset.current = { x: e.clientX - ballPos.x, y: e.clientY - ballPos.y };
    e.preventDefault();
  };

  const onWinMouseDown = (e) => {
    winDragging.current = true;
    winDragOffset.current = { x: e.clientX - winPos.x, y: e.clientY - winPos.y };
    e.preventDefault();
  };

  // ── 渲染区域 ──────────────────────────────────────────

  const historyView = (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {sessions.length === 0 ? (
        <div style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
          No past conversations yet.
        </div>
      ) : (
        [...sessions].reverse().map(s => (
          <div
            key={s.id}
            onClick={() => loadSession(s)}
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: currentSession?.id === s.id ? '#EAF2FF' : '#F5F5F7',
              marginBottom: 6, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#1D1D1F', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title}
              </div>
              <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>
                {formatTime(s.updatedAt || s.createdAt)}
              </div>
            </div>
            <span
              onClick={(e) => deleteSession(e, s.id)}
              style={{ color: '#AEAEB2', fontSize: 16, marginLeft: 8, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
              title="Delete"
            >×</span>
          </div>
        ))
      )}
    </div>
  );

  const chatView = (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column' }}>
        {(currentSession?.messages || []).map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8C96AC', fontSize: 13 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D1D1F', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</div>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #E5E5EA', display: 'flex', gap: 8, alignItems: 'center' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder='analyze SIM-0081  or  query cutoff voltage...'
          rows={2}
          style={{
            flex: 1, resize: 'none', border: '1px solid #E5E5EA',
            borderRadius: 10, padding: '8px 10px', fontSize: 13,
            fontFamily: 'inherit', background: '#F5F5F7',
            color: '#1D1D1F', outline: 'none', lineHeight: 1.4, userSelect: 'text'
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: loading || !input.trim() ? '#E5E5EA' : '#0A84FF',
            border: 'none', color: 'white', fontSize: 16,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >↑</button>
      </div>
    </>
  );

  const titleBar = (draggable, onDblClick) => (
    <div
      onMouseDown={draggable ? onWinMouseDown : undefined}
      onDoubleClick={onDblClick}
      style={{
        background: '#1D1D1F', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: draggable ? 'grab' : 'default', flexShrink: 0, userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0A84FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'white' }}>✦</div>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>CellVantage Agent</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* 新对话 */}
        <span
          onClick={(e) => { e.stopPropagation(); startNewSession(); }}
          title="New conversation"
          style={{ color: '#8C96AC', fontSize: 16, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}
        >✏️</span>
        {/* 历史记录 */}
        <span
          onClick={(e) => { e.stopPropagation(); setView(v => v === 'history' ? 'chat' : 'history'); }}
          title="Chat history"
          style={{ color: view === 'history' ? '#0A84FF' : '#8C96AC', fontSize: 16, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}
        >🕐</span>
        {/* 展开/缩小 */}
        <span
          onClick={(e) => { e.stopPropagation(); setMode(m => m === 'fullscreen' ? 'window' : 'fullscreen'); }}
          title={mode === 'fullscreen' ? 'Minimize' : 'Expand'}
          style={{
            color: '#8C96AC', cursor: 'pointer',
            width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 'bold', lineHeight: 1,
            transform: mode === 'fullscreen' ? 'rotate(180deg)' : 'none'
          }}
        >⤢</span>
        {/* 关闭 */}
        <span
          onClick={(e) => { e.stopPropagation(); setMode('ball'); }}
          style={{ color: '#8C96AC', fontSize: 20, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}
        >×</span>
      </div>
    </div>
  );

  // ── 浮球 ─────────────────────────────────────────────
  if (mode === 'ball') {
    return (
      <div
        onMouseDown={onBallMouseDown}
        onClick={() => { if (!didDrag.current) setMode('window'); }}
        style={{
          position: 'fixed', left: ballPos.x, top: ballPos.y,
          width: 52, height: 52, borderRadius: '50%',
          background: '#1D1D1F', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, cursor: 'grab',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          zIndex: 9999, userSelect: 'none'
        }}
      >✦</div>
    );
  }

  // ── 小窗 ─────────────────────────────────────────────
  if (mode === 'window') {
    return (
      <div style={{
        position: 'fixed', left: winPos.x, top: winPos.y,
        width: 400, height: 560,
        background: 'white', borderRadius: 16,
        border: '1px solid #E5E5EA',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {titleBar(true, () => setMode('fullscreen'))}
        {view === 'history' ? historyView : chatView}
      </div>
    );
  }

  // ── 全屏 ─────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '82vw', height: '82vh', maxWidth: 980,
        background: 'white', borderRadius: 20,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 80px rgba(0,0,0,0.3)'
      }}>
        {titleBar(false, () => setMode('window'))}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 全屏左侧：历史记录 sidebar */}
          <div style={{
            width: 240, borderRight: '1px solid #E5E5EA',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAFAFA'
          }}>
            <div style={{ padding: '12px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6E6E73', letterSpacing: '0.04em', textTransform: 'uppercase' }}>History</span>
              <button
                onClick={startNewSession}
                style={{
                  fontSize: 11, padding: '4px 8px', borderRadius: 6,
                  border: '1px solid #E5E5EA', background: 'white',
                  color: '#1D1D1F', cursor: 'pointer', fontWeight: 500
                }}
              >+ New</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              {sessions.length === 0 ? (
                <div style={{ color: '#AEAEB2', fontSize: 12, textAlign: 'center', marginTop: 24 }}>No history yet.</div>
              ) : (
                [...sessions].reverse().map(s => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s)}
                    style={{
                      padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                      background: currentSession?.id === s.id ? '#EAF2FF' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 2 }}>
                        {formatTime(s.updatedAt || s.createdAt)}
                      </div>
                    </div>
                    <span
                      onClick={(e) => deleteSession(e, s.id)}
                      style={{ color: '#AEAEB2', fontSize: 14, marginLeft: 6, cursor: 'pointer', flexShrink: 0 }}
                    >×</span>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* 全屏右侧：当前对话 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {chatView}
          </div>
        </div>
      </div>
    </div>
  );
}
