import { useEffect, useState } from 'react';
import { usePowerUpClient } from '../hooks/usePowerUpClient';
import '../../styles/index.css';
import '../../pages/InnerPage.css';

const LogStreamPlaceholder = () => {
  const client = usePowerUpClient();
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLogs((prev) => [...prev, `[stub] log entry ${prev.length + 1}`]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="inner-page" style={{ gap: '1rem' }}>
      <header>
        <p className="eyebrow">Stream logs placeholder</p>
        <h1>Live logs modal shell</h1>
        <p className="lede">
          This iframe will stream pod logs via the OpenShift log follow API. For now it emits mock lines so engineers
          can validate Trello modal sizing and lifecycle hooks.
        </p>
      </header>
      <section
        style={{
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: '0.75rem',
          padding: '1rem',
          height: '420px',
          overflow: 'auto',
          fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
        }}
      >
        {logs.map((line) => (
          <pre key={line} style={{ margin: 0 }}>
            {line}
          </pre>
        ))}
      </section>
      {client ? null : <p className="eyebrow">Waiting for Trello iframe bootstrap…</p>}
    </main>
  );
};

export default LogStreamPlaceholder;
