import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const API = 'http://localhost:3000';

// ── 国际化文字 ─────────────────────────────────────────────
const I18N = {
  en: {
    title:      'CellVantage Agent',
    thinking:   'Thinking...',
    newChat:    'New conversation',
    historyBtn: 'Chat history',
    noHistory:  'No past conversations yet.',
    newBtn:     '+ New',
    historyLabel: 'HISTORY',
    placeholder:'analyze SIM-0081  or  query cutoff voltage...',
    langLabel:  'EN',
    fallback: "I can help you:\n• analyze <cell_code> — anomaly detection (lab_operator, Under Test only)\n• query <question> — search USABC spec\n• status <cell_code> — check current state\n• history <cell_code> — view test summary",
    welcome: (u) => `Hi${u ? ' ' + u : ''}! I'm your CellVantage Agent.\n\n⚡ What I can do:\n• analyze <cell_code> — anomaly detection (lab_operator only)\n• query <question> — search USABC spec\n• status <cell_code> — check cell state\n• history <cell_code> — view test summary\n\nExample: analyze SIM-0081`,
    statusResult: (code, state) => `Cell ${code} is currently in:\n\n📍 ${state}`,
    statusNotFound: (code) => `Cell ${code} not found.`,
    historyResult: (code, rows) => {
      if (!rows.length) return `No test data found for ${code}.`;
      const last = rows[rows.length - 1];
      return `Test summary for ${code} (${rows.length} records):\n\nLatest cycle: C${last.cycle_count ?? rows.length}\n• Voltage: ${last.voltage ?? '—'} V\n• Internal Resistance: ${last.internal_resistance ?? '—'} mΩ\n• Capacity: ${last.capacity ?? '—'} mAh\n• Temperature: ${last.temperature ?? '—'} °C`;
    },
    noSpec: 'No relevant results found in the spec.',
    specResult: (sim, text) => `Top result from USABC spec (similarity: ${sim}):\n\n"${text}"`,
    invalidState: (msg) => `⚠️ ${msg}\n\nWorkflow reminder:\nReceived → Incoming QC → Storage → Under Test → Agent can analyze here`,
    error: (msg) => `Error: ${msg}`,
    anomalyHeader: (code) => `Analysis complete for ${code}:`,
    noAnomalies: '✅ No anomalies detected.',
    specRef: '📖 Spec reference:',
    alreadyInState: (s) => `ℹ️ Cell is already in ${s} state. No change needed.`,
    actionBlocked: (role, from, to) => `🚫 Action blocked: your role (${role}) does not have permission to change state from ${from} to ${to}.`,
    actionTaken: (a) => `✅ Action: ${a}`,
    noChange: 'No state change was needed.',
  },
  zh: {
    title:      'CellVantage 智能助手',
    thinking:   '思考中...',
    newChat:    '新对话',
    historyBtn: '历史记录',
    noHistory:  '暂无历史对话',
    newBtn:     '+ 新建',
    historyLabel: '历史记录',
    placeholder:'分析 SIM-0081  或  查询截止电压...',
    langLabel:  '中',
    fallback: "我可以帮你：\n• 分析 <电池编号> — 异常检测（仅限 lab_operator，须为 Under Test 状态）\n• 查询 <问题> — 检索 USABC 说明书\n• 状态 <电池编号> — 查看当前状态\n• 历史 <电池编号> — 查看测试数据摘要",
    welcome: (u) => `你好${u ? ' ' + u : ''}！我是 CellVantage 智能助手。\n\n⚡ 我能做什么：\n• 分析 <电池编号> — 异常检测（仅限 lab_operator）\n• 查询 <问题> — 检索 USABC 说明书\n• 状态 <电池编号> — 查看电池当前状态\n• 历史 <电池编号> — 查看测试数据摘要\n\n示例：分析 SIM-0081`,
    statusResult: (code, state) => `电池 ${code} 当前状态：\n\n📍 ${state}`,
    statusNotFound: (code) => `未找到电池 ${code}。`,
    historyResult: (code, rows) => {
      if (!rows.length) return `未找到 ${code} 的测试数据。`;
      const last = rows[rows.length - 1];
      return `${code} 测试摘要（共 ${rows.length} 条记录）：\n\n最新循环：C${last.cycle_count ?? rows.length}\n• 电压：${last.voltage ?? '—'} V\n• 内阻：${last.internal_resistance ?? '—'} mΩ\n• 容量：${last.capacity ?? '—'} mAh\n• 温度：${last.temperature ?? '—'} °C`;
    },
    noSpec: '在说明书中未找到相关内容。',
    specResult: (sim, text) => `USABC 说明书检索结果（相似度：${sim}）：\n\n"${text}"`,
    invalidState: (msg) => `⚠️ ${msg}\n\n工作流提醒：\nReceived → Incoming QC → Storage → Under Test → 在此步骤可进行 Agent 分析`,
    error: (msg) => `错误：${msg}`,
    anomalyHeader: (code) => `${code} 分析完成：`,
    noAnomalies: '✅ 未检测到异常。',
    specRef: '📖 说明书依据：',
    alreadyInState: (s) => `ℹ️ 电池已处于 ${s} 状态，无需变更。`,
    actionBlocked: (role, from, to) => `🚫 操作被拦截：角色 ${role} 无权将状态从 ${from} 改为 ${to}。`,
    actionTaken: (a) => `✅ 操作：${a}`,
    noChange: '无需变更状态。',
  },
  de: {
    title:      'CellVantage Agent',
    thinking:   'Verarbeite...',
    newChat:    'Neues Gespräch',
    historyBtn: 'Gesprächsverlauf',
    noHistory:  'Noch keine Gespräche.',
    newBtn:     '+ Neu',
    historyLabel: 'VERLAUF',
    placeholder:'analysiere SIM-0081  oder  suche Abschlussspannung...',
    langLabel:  'DE',
    fallback: "Ich kann helfen:\n• analysiere <Zellcode> — Anomalieerkennung (nur lab_operator)\n• suche <Frage> — USABC-Spezifikation durchsuchen\n• status <Zellcode> — aktuellen Zustand prüfen\n• verlauf <Zellcode> — Testdaten anzeigen",
    welcome: (u) => `Hallo${u ? ' ' + u : ''}! Ich bin dein CellVantage Agent.\n\n⚡ Was ich kann:\n• analysiere <Zellcode> — Anomalieerkennung (nur lab_operator)\n• suche <Frage> — USABC-Spezifikation durchsuchen\n• status <Zellcode> — Zustand prüfen\n• verlauf <Zellcode> — Testdaten anzeigen\n\nBeispiel: analysiere SIM-0081`,
    statusResult: (code, state) => `Zelle ${code} hat aktuell den Zustand:\n\n📍 ${state}`,
    statusNotFound: (code) => `Zelle ${code} nicht gefunden.`,
    historyResult: (code, rows) => {
      if (!rows.length) return `Keine Testdaten für ${code} gefunden.`;
      const last = rows[rows.length - 1];
      return `Testzusammenfassung für ${code} (${rows.length} Datensätze):\n\nLetzter Zyklus: C${last.cycle_count ?? rows.length}\n• Spannung: ${last.voltage ?? '—'} V\n• Innenwiderstand: ${last.internal_resistance ?? '—'} mΩ\n• Kapazität: ${last.capacity ?? '—'} mAh\n• Temperatur: ${last.temperature ?? '—'} °C`;
    },
    noSpec: 'Keine relevanten Ergebnisse in der Spezifikation gefunden.',
    specResult: (sim, text) => `Bestes Ergebnis aus USABC-Spezifikation (Ähnlichkeit: ${sim}):\n\n"${text}"`,
    invalidState: (msg) => `⚠️ ${msg}\n\nWorkflow-Hinweis:\nReceived → Incoming QC → Storage → Under Test → Agent kann hier analysieren`,
    error: (msg) => `Fehler: ${msg}`,
    anomalyHeader: (code) => `Analyse abgeschlossen für ${code}:`,
    noAnomalies: '✅ Keine Anomalien erkannt.',
    specRef: '📖 Spezifikationsreferenz:',
    alreadyInState: (s) => `ℹ️ Zelle ist bereits im Zustand ${s}. Keine Änderung nötig.`,
    actionBlocked: (role, from, to) => `🚫 Aktion blockiert: Rolle ${role} hat keine Berechtigung, den Zustand von ${from} auf ${to} zu ändern.`,
    actionTaken: (a) => `✅ Aktion: ${a}`,
    noChange: 'Keine Zustandsänderung erforderlich.',
  }
};

// ── 意图识别 ───────────────────────────────────────────────
function extractCellCode(input) {
  const match = input.match(/([A-Z]{2,4}-[\w-]{4,})/i);
  return match ? match[1].toUpperCase() : null;
}

function detectIntent(input) {
  const lower = input.toLowerCase();
  if (/\b(analyze|analyse|analysiere|prüfe|分析|检查|检测|有问题吗|看看)\b/.test(lower)) return 'analyze';
  if (/\b(query|search|suche|was ist|what is|look up|find|查询|查找|什么是|说明书|规定|标准)\b/.test(lower)) return 'query';
  if (/\b(history|verlauf|历史|测试记录|测试历史|记录)\b/.test(lower)) return 'history';
  if (/\b(status|zustand|状态|现在是|是什么状态|当前状态)\b/.test(lower)) return 'status';
  return null;
}

function extractQuery(input) {
  return input
    .replace(/query|search|suche|what is|look up|find|查询|查找|什么是|说明书里|规定/gi, '')
    .trim() || input.trim();
}

// ── Agent 调用 ─────────────────────────────────────────────
async function runAgentAction(input, token, t) {
  const intent = detectIntent(input);
  const cellCode = extractCellCode(input);
  const headers = { Authorization: `Bearer ${token}` };

  // ── analyze ─────────────────────────────────────────────
  if (intent === 'analyze' && cellCode) {
    const res = await axios.post(`${API}/api/agent/analyze/${cellCode}`, {}, { headers });
    const r = res.data.report;
    const anomalyLines = r.anomalies.map(a => `• ${a.anomaly_type} — ${a.message} (${a.severity})`).join('\n');
    const ragLine = r.rag_references[0]
      ? `\n\n${t.specRef}\n"${r.rag_references[0].reference_text.slice(0, 120)}..."`
      : '';

    let actionLine;
    if (r.action_taken) {
      actionLine = `\n\n${t.actionTaken(r.action_taken)}`;
    } else {
      const step5 = r.steps.find(s => s.step === 5);
      const ec = step5?.result?.error_code;
      if (ec === 'INVALID_STATE_TRANSITION' && step5?.result?.current_state === step5?.result?.attempted_state) {
        actionLine = `\n\n${t.alreadyInState(step5.result.current_state)}`;
      } else if (ec === 'INVALID_STATE_TRANSITION') {
        actionLine = `\n\n${t.actionBlocked(step5.result.role, step5.result.current_state, step5.result.attempted_state)}`;
      } else {
        actionLine = `\n\n${t.noChange}`;
      }
    }
    return `${t.anomalyHeader(r.cell_code)}\n\n${anomalyLines || t.noAnomalies}${ragLine}${actionLine}`;
  }

  // ── query spec ──────────────────────────────────────────
  if (intent === 'query' || (!intent && !cellCode)) {
    const question = extractQuery(input);
    const res = await axios.post(`${API}/api/agent/query`, { question }, { headers });
    const results = res.data.results || [];
    if (!results.length) return t.noSpec;
    return t.specResult(results[0].similarity, results[0].text);
  }

  // ── status ──────────────────────────────────────────────
  if ((intent === 'status' || (!intent && cellCode)) && cellCode) {
    const res = await axios.get(`${API}/api/cells`, { headers });
    const cells = res.data.data || [];
    const found = cells.find(c => c.cell_code === cellCode);
    if (!found) return t.statusNotFound(cellCode);
    return t.statusResult(cellCode, found.current_state);
  }

  // ── history ─────────────────────────────────────────────
  if (intent === 'history' && cellCode) {
    const res = await axios.get(`${API}/api/metrics/${cellCode}`, { headers });
    const rows = res.data.data || [];
    return t.historyResult(cellCode, rows);
  }

  return null;
}

// ── 工具函数 ───────────────────────────────────────────────
function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function storageKey(userId) { return `agent_sessions_${userId}`; }
function loadSessions(userId) {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]'); } catch { return []; }
}
function saveSessions(userId, sessions) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(sessions.slice(-30))); } catch {}
}
function sessionTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New';
  return first.content.length > 40 ? first.content.slice(0, 40) + '...' : first.content;
}
function formatTime(ts) {
  const d = new Date(ts), now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── MessageBubble ──────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D1D1F', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' }}>✦</div>
      )}
      <div style={{
        maxWidth: '80%',
        background: isUser ? '#0A84FF' : '#F2F2F7',
        color: isUser ? 'white' : '#1D1D1F',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '9px 13px', fontSize: 13, lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text'
      }}>{msg.content}</div>
    </div>
  );
}

// ── 主组件 ─────────────────────────────────────────────────
export default function AgentCopilot() {
  const { token, user } = useAuth();
  const { lang } = useLang();  // 读全局语言，由导航栏统一切换

  const [mode, setMode] = useState('ball');
  const [view, setView] = useState('chat');
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
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

  const t = I18N[lang];

  // lang 变化时，如果当前 session 只有欢迎语（用户还没发消息），就更新欢迎语
  useEffect(() => {
    if (!user || !currentSession) return;
    const hasUserMsg = currentSession.messages.some(m => m.role === 'user');
    if (!hasUserMsg) {
      setCurrentSession(prev => ({
        ...prev,
        messages: [{ role: 'agent', content: t.welcome(user.username) }]
      }));
    }
  }, [lang]);

  useEffect(() => {
    if (!user) return;
    if (currentUserId.current === user.id) return;
    currentUserId.current = user.id;
    setSessions(loadSessions(user.id));
    startNewSession();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

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
    return () => { window.removeEventListener('mousemove', onBallMouseMove); window.removeEventListener('mouseup', onBallMouseUp); };
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
    return () => { window.removeEventListener('mousemove', onWinMouseMove); window.removeEventListener('mouseup', onWinMouseUp); };
  }, [onWinMouseMove, onWinMouseUp]);

  if (!user) return null;

  function startNewSession() {
    const newSession = {
      id: genId(),
      messages: [{ role: 'agent', content: t.welcome(user?.username) }],
      createdAt: Date.now()
    };
    setCurrentSession(newSession);
    setView('chat');
  }

  function saveCurrentSession(updatedSession) {
    if (!user?.id) return;
    if (!updatedSession.messages.some(m => m.role === 'user')) return;
    setSessions(prev => {
      const updated = [...prev.filter(s => s.id !== updatedSession.id), {
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

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !currentSession) return;

    const userMsg = { role: 'user', content: text };
    const updatedWithUser = { ...currentSession, messages: [...currentSession.messages, userMsg] };
    setCurrentSession(updatedWithUser);
    setInput('');
    setLoading(true);

    try {
      const actionResult = await runAgentAction(text, token, t);
      const agentMsg = { role: 'agent', content: actionResult || t.fallback };
      const final = { ...updatedWithUser, messages: [...updatedWithUser.messages, agentMsg] };
      setCurrentSession(final);
      saveCurrentSession(final);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      const errorCode = err.response?.data?.error_code;
      const content = errorCode === 'INVALID_CELL_STATE'
        ? t.invalidState(serverMsg)
        : t.error(serverMsg || err.message);
      const errMsg = { role: 'agent', content };
      const final = { ...updatedWithUser, messages: [...updatedWithUser.messages, errMsg] };
      setCurrentSession(final);
      saveCurrentSession(final);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const onBallMouseDown = (e) => {
    dragging.current = true; didDrag.current = false;
    dragOffset.current = { x: e.clientX - ballPos.x, y: e.clientY - ballPos.y };
    e.preventDefault();
  };
  const onWinMouseDown = (e) => {
    winDragging.current = true;
    winDragOffset.current = { x: e.clientX - winPos.x, y: e.clientY - winPos.y };
    e.preventDefault();
  };

  // ── 历史列表 ──────────────────────────────────────────
  const historyList = (small) => (
    <div style={{ flex: 1, overflowY: 'auto', padding: small ? '12px' : '0 8px 12px' }}>
      {sessions.length === 0 ? (
        <div style={{ color: '#AEAEB2', fontSize: 12, textAlign: 'center', marginTop: 24 }}>{t.noHistory}</div>
      ) : (
        [...sessions].reverse().map(s => (
          <div key={s.id} onClick={() => loadSession(s)}
            style={{
              padding: small ? '10px 12px' : '8px 10px', borderRadius: small ? 10 : 8, marginBottom: small ? 6 : 4,
              background: currentSession?.id === s.id ? '#EAF2FF' : (small ? '#F5F5F7' : 'transparent'),
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: small ? 13 : 12, color: '#1D1D1F', fontWeight: small ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
              <div style={{ fontSize: small ? 11 : 10, color: '#AEAEB2', marginTop: 2 }}>{formatTime(s.updatedAt || s.createdAt)}</div>
            </div>
            <span onClick={(e) => deleteSession(e, s.id)}
              style={{ color: '#AEAEB2', fontSize: small ? 16 : 14, marginLeft: 6, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</span>
          </div>
        ))
      )}
    </div>
  );

  // ── 聊天区域 ──────────────────────────────────────────
  const chatView = (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column' }}>
        {(currentSession?.messages || []).map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8C96AC', fontSize: 13 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D1D1F', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</div>
            {t.thinking}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #E5E5EA', display: 'flex', gap: 8, alignItems: 'center' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder={t.placeholder} rows={2}
          style={{ flex: 1, resize: 'none', border: '1px solid #E5E5EA', borderRadius: 10,
            padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#F5F5F7',
            color: '#1D1D1F', outline: 'none', lineHeight: 1.4, userSelect: 'text' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ width: 36, height: 36, borderRadius: 10,
            background: loading || !input.trim() ? '#E5E5EA' : '#0A84FF',
            border: 'none', color: 'white', fontSize: 16,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
      </div>
    </>
  );

  // ── 标题栏 ────────────────────────────────────────────
  const titleBar = (draggable, onDblClick) => (
    <div onMouseDown={draggable ? onWinMouseDown : undefined} onDoubleClick={onDblClick}
      style={{ background: '#1D1D1F', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: draggable ? 'grab' : 'default', flexShrink: 0, userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0A84FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'white' }}>✦</div>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{t.title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span onClick={(e) => { e.stopPropagation(); startNewSession(); }} title={t.newChat}
          style={{ color: '#8C96AC', fontSize: 16, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}>✏️</span>
        <span onClick={(e) => { e.stopPropagation(); setView(v => v === 'history' ? 'chat' : 'history'); }} title={t.historyBtn}
          style={{ color: view === 'history' ? '#0A84FF' : '#8C96AC', fontSize: 16, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}>🕐</span>
        <span onClick={(e) => { e.stopPropagation(); setMode(m => m === 'fullscreen' ? 'window' : 'fullscreen'); }}
          title={mode === 'fullscreen' ? 'Minimize' : 'Expand'}
          style={{ color: '#8C96AC', cursor: 'pointer', width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 'bold', lineHeight: 1,
            transform: mode === 'fullscreen' ? 'rotate(180deg)' : 'none' }}>⤢</span>
        <span onClick={(e) => { e.stopPropagation(); setMode('ball'); }}
          style={{ color: '#8C96AC', fontSize: 20, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</span>
      </div>
    </div>
  );

  // ── 浮球 ──────────────────────────────────────────────
  if (mode === 'ball') {
    return (
      <div onMouseDown={onBallMouseDown} onClick={() => { if (!didDrag.current) setMode('window'); }}
        style={{ position: 'fixed', left: ballPos.x, top: ballPos.y,
          width: 52, height: 52, borderRadius: '50%', background: '#1D1D1F', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, cursor: 'grab', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          zIndex: 9999, userSelect: 'none' }}>✦</div>
    );
  }

  // ── 小窗 ──────────────────────────────────────────────
  if (mode === 'window') {
    return (
      <div style={{ position: 'fixed', left: winPos.x, top: winPos.y, width: 400, height: 560,
        background: 'white', borderRadius: 16, border: '1px solid #E5E5EA',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)', zIndex: 9999,
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {titleBar(true, () => setMode('fullscreen'))}
        {view === 'history' ? historyList(true) : chatView}
      </div>
    );
  }

  // ── 全屏 ──────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '82vw', height: '82vh', maxWidth: 980, background: 'white', borderRadius: 20,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 80px rgba(0,0,0,0.3)' }}>
        {titleBar(false, () => setMode('window'))}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 240, borderRight: '1px solid #E5E5EA',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAFAFA' }}>
            <div style={{ padding: '12px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6E6E73', letterSpacing: '0.04em' }}>{t.historyLabel}</span>
              <button onClick={startNewSession}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E5EA',
                  background: 'white', color: '#1D1D1F', cursor: 'pointer', fontWeight: 500 }}>{t.newBtn}</button>
            </div>
            {historyList(false)}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {chatView}
          </div>
        </div>
      </div>
    </div>
  );
}
