import './InnerPage.css';

const podSummary = [
  { status: 'Running', description: 'pods actively maintaining Trello automations', count: 3 },
  { status: 'Pending', description: 'pods warming up after redeploys', count: 1 },
  { status: 'Stopped', description: 'manual stops or failed health checks', count: 0 },
];

const InnerPage = () => {
  return (
    <main className="inner-page">
      <header>
        <p className="eyebrow">Card Agents · Alpha build</p>
        <h1>Live roster staging shell</h1>
        <p className="lede">
          This lightweight view proves out the React + TypeScript baseline that will evolve into the Trello
          Power-Up surfaces described in the spec. Future iterations will hydrate this UI with OpenShift data.
        </p>
        <button
          type="button"
          onClick={() => window.open('./preview.html', '_blank', 'noopener')}
        >
          Open Card Agents Prototype
        </button>
      </header>

      <section className="status-grid">
        {podSummary.map((summary) => (
          <article key={summary.status}>
            <span className="badge">{summary.status}</span>
            <h2>{summary.count} pods</h2>
            <p>{summary.description}</p>
          </article>
        ))}
      </section>

      <section className="callouts">
        <div>
          <h3>Single watch stream</h3>
          <p>Upcoming work: connect to the OpenShift watch API with reconnection-only logic and no polling fallback.</p>
        </div>
        <div>
          <h3>Native settings page</h3>
          <p>Ship the Trello Power-Up admin iframe that stores cluster URL, login label, token, and ignore-SSL toggle.</p>
        </div>
        <div>
          <h3>Stop & Log actions</h3>
          <p>Wire optimistic pod deletion plus log streaming modals with AbortController cleanup.</p>
        </div>
      </section>
    </main>
  );
};

export default InnerPage;
