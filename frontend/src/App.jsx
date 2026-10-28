import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Shield, AlertCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [health, setHealth] = useState({ status: 'loading', gemini_configured: false });
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditGoal, setAuditGoal] = useState('Audit my transactions for subscription traps and silent price hikes.');
  const [session, setSession] = useState(null);

  useEffect(() => {
    fetchHealth();
    loadSampleData();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      if (res.ok) setHealth(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadSampleData = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/sample`);
      if (!res.ok) throw new Error('Could not load sample data. Is the backend running?');
      const data = await res.json();
      setTransactions(data.transactions);
      setSession(null);
    } catch (e) {
      setError(e.message);
      setHealth({ status: 'error', gemini_configured: false });
    }
  };

  const handleExtract = async () => {
    if (!inputText.trim() && !file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (inputText.trim()) formData.append('text', inputText);
      if (file) formData.append('file', file);

      const res = await fetch(`${API_URL}/api/extract`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Extraction failed');
      if (data.count === 0) throw new Error('No valid transactions were extracted. Check the input and try again.');
      setTransactions(data.transactions);
      setSession(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (transactions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, goal: auditGoal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Audit failed');
      setSession(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (decision) => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/audits/${session.session_id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval failed');
      setSession(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalOutflow = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const subTotal = transactions.filter(t => t.category === 'Subscriptions' && t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const uniqueMerchants = new Set(transactions.map(t => t.merchant)).size;

  const chartDataMap = transactions
    .filter(t => t.amount > 0 && t.date)
    .reduce((acc, t) => {
      const [year, month] = t.date.split('-');
      const date = new Date(year, month - 1);
      const label = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      acc[label] = (acc[label] || 0) + t.amount;
      return acc;
    }, {});
  const chartData = Object.entries(chartDataMap).map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) })).sort((a,b) => new Date(a.name) - new Date(b.name));

  const catMap = transactions.filter(t => t.amount > 0).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
  const categories = Object.entries(catMap).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6);
  const maxCat = categories.length ? categories[0].amount : 1;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '8px' }}><Activity size={20} /></div>
          <div><h2 style={{ margin: 0, fontSize: '1.1rem' }}>Finwise</h2><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>INTELLIGENCE AGENT</div></div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem' }}>WORKSPACE</div>
          <div style={{ color: 'var(--primary)', fontWeight: 500, marginBottom: '0.75rem' }}>Overview</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Transactions <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', float: 'right' }}>{transactions.length}</span></div>
          <div style={{ color: 'var(--text-muted)' }}>Agent audit</div>
        </div>
        <div className="card" style={{ padding: '1rem', marginBottom: 0 }}>
          <Shield size={16} color="var(--primary)" style={{ marginBottom: '8px' }} />
          <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>Demo-safe mode</h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sample data is fictional. Approval actions are simulated and never sent.</p>
        </div>
      </aside>

      <main className="main-column">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1px' }}>PERSONAL FINANCE / OVERVIEW</div>
            <h1 style={{ margin: '0.25rem 0' }}>Finance overview</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Understand your spending. Let your agent investigate the details.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: health.gemini_configured ? 'var(--success)' : 'var(--warning)' }}></div>
              {health.gemini_configured ? 'Gemini connected' : 'Demo mode available'}
            </div>
            <button className="btn btn-secondary" onClick={loadSampleData}><RefreshCw size={16} /></button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /> {error}</div>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={18}/></button>
          </div>
        )}

        <div className="metrics-grid">
          <div className="card metric-card">
            <h4>Total transactions</h4>
            <div className="value">{transactions.length}</div>
            <p>{uniqueMerchants} unique merchants</p>
          </div>
          <div className="card metric-card">
            <h4>Total outflow</h4>
            <div className="value">${totalOutflow.toFixed(2)}</div>
            <p>Across loaded transactions</p>
          </div>
          <div className="card metric-card">
            <h4>Subscription charges</h4>
            <div className="value">${subTotal.toFixed(2)}</div>
            <p>All visible periods combined</p>
          </div>
          <div className="card metric-card">
            <h4>Potential price hikes</h4>
            <div className="value">{session && session.findings ? session.findings.length : '—'}</div>
            <p>{session ? 'From last audit' : 'Run an agent audit'}</p>
          </div>
        </div>

        <div className="charts-row">
          <div className="card">
            <h3 style={{ margin: '0 0 1rem' }}>Spending activity</h3>
            <div style={{ height: '250px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                    <YAxis tickFormatter={(val) => `$${val}`} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                    <Tooltip formatter={(value) => [`$${value}`, "Amount"]} />
                    <Area type="monotone" dataKey="amount" stroke="var(--primary)" fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p style={{ color: 'var(--text-muted)' }}>Add dated transactions to see spending activity.</p>}
            </div>
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 1rem' }}>Spending by category</h3>
            <div>
              {categories.length > 0 ? categories.map(c => (
                <div key={c.name} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>{c.name}</span><strong>${c.amount.toFixed(2)}</strong>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max((c.amount / maxCat) * 100, 3)}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              )) : <p style={{ color: 'var(--text-muted)' }}>Category totals appear after transactions are loaded.</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>DAY 1 · GENAI EXTRACTION</div>
          <h3 style={{ margin: '0 0 1rem' }}>Bring in financial data</h3>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Paste raw transaction text</label>
              <textarea rows={4} value={inputText} onChange={e => setInputText(e.target.value)} placeholder="2026-09-14 TST* SPOTIFY USA 11.99" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Raw text is sent to Gemini when configured. <button onClick={() => setInputText("2026-09-14 TST* SPOTIFY USA 11.99\n2026-09-18 UPI/FOOD DELIVERY/8231 18.75\n2026-09-20 POS HPCL FUEL HYD 25.00")} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}>Use example</button>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Or choose a file</label>
              <input type="file" accept="image/*,.pdf,.csv,.txt" onChange={e => setFile(e.target.files[0])} />
              {file && <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>{file.name} ({(file.size/1024).toFixed(1)} KB) <button onClick={() => setFile(null)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button></div>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Structured output + Pydantic validation. Unclear fields should stay null.</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={loadSampleData}>Load sample data</button>
              <button className="btn btn-primary" onClick={handleExtract} disabled={loading || (!inputText && !file)}><Sparkles size={16}/> Extract transactions</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 1rem' }}>Transactions</h3>
          {transactions.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>MERCHANT</th><th>DATE</th><th>CATEGORY</th><th>RAW SOURCE</th><th>AMOUNT</th></tr></thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{t.merchant}</td>
                      <td>{t.date ? new Date(t.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Date unclear'}</td>
                      <td><span style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{t.category}</span></td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{t.raw_line}</td>
                      <td style={{ textAlign: 'right', color: t.amount < 0 ? 'var(--success)' : 'inherit' }}>
                        ${Math.abs(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>No transactions yet. Load sample data or extract a statement above.</p>}
        </div>

        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', marginTop: '3rem' }}>DAY 2 · AUTONOMOUS AGENT</div>
        <h2 style={{ margin: '0 0 1.5rem' }}>Run a finance audit</h2>

        <div className="agent-grid">
          <div className="card">
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Your audit goal</label>
            <textarea rows={3} value={auditGoal} onChange={e => setAuditGoal(e.target.value)} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '1rem 0' }}>Read-only analysis runs automatically. Cancellation / dispute actions are drafts and require your approval. Nothing is sent.</p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAudit} disabled={loading || transactions.length === 0}>Run agent audit</button>
            
            {session && session.findings && session.findings.map((f, i) => (
              <div key={i} className="card" style={{ marginTop: '1.5rem', background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ background: '#f59e0b', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>Price increase detected</div>
                <h4 style={{ margin: '0 0 4px' }}>{f.merchant}</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>${f.old_amount.toFixed(2)} &rarr; <strong>${f.new_amount.toFixed(2)}</strong>/month (+{f.change_pct}%)</p>
              </div>
            ))}

            {session && session.pending_action && (
              <div className="card" style={{ marginTop: '1.5rem', border: '1px solid var(--primary)' }}>
                <h4 style={{ margin: '0 0 1rem' }}>{session.status === 'awaiting_approval' ? 'Action needs your approval' : 'Action approved (simulation)'}</h4>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Annualized cost now</span><strong>${session.pending_action.annual_cost.toFixed(2)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Monthly difference</span><strong>+${session.pending_action.monthly_increase.toFixed(2)}</strong></div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>CANCELLATION / DISPUTE DRAFT <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>NOT SENT</span></div>
                <pre>{session.pending_action.draft}</pre>
                {session.status === 'awaiting_approval' && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => handleApproval('reject')} disabled={loading}>Reject</button>
                    <button className="btn btn-primary" onClick={() => handleApproval('approve')} disabled={loading}>Approve simulation</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 1rem' }}>Agent trace</h3>
            {session ? (
              <div>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{session.summary}</div>
                <div>
                  {session.audit_log.map((log, i) => (
                    <div key={i} className="trace-item">
                      <div className={`trace-dot ${log.type}`}></div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{log.message}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{log.type} &middot; {new Date(log.time).toLocaleTimeString()}</div>
                        {log.type === 'plan' && log.details.tool && (
                          <pre style={{ margin: '8px 0 0', padding: '8px', fontSize: '0.75rem' }}>{log.details.tool}({JSON.stringify(log.details.arguments)})</pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Your audit trace will appear here. Mini steps: Inspect &rarr; Calculate &rarr; Ask first.</p>
            )}
          </div>
        </div>

        <footer style={{ marginTop: '4rem', padding: '2rem 0', borderTop: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
          <div>FINWISE &middot; FINANCE INTELLIGENCE AGENT</div>
          <div>Built for learning &middot; Not financial advice</div>
        </footer>
      </main>
    </div>
  );
}