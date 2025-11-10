import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './InnerPage.css';
const podSummary = [
    { status: 'Running', description: 'pods actively maintaining Trello automations', count: 3 },
    { status: 'Pending', description: 'pods warming up after redeploys', count: 1 },
    { status: 'Stopped', description: 'manual stops or failed health checks', count: 0 },
];
const InnerPage = () => {
    return (_jsxs("main", { className: "inner-page", children: [_jsxs("header", { children: [_jsx("p", { className: "eyebrow", children: "Card Agents \u00B7 Alpha build" }), _jsx("h1", { children: "Live roster staging shell" }), _jsx("p", { className: "lede", children: "This lightweight view proves out the React + TypeScript baseline that will evolve into the Trello Power-Up surfaces described in the spec. Future iterations will hydrate this UI with OpenShift data." }), _jsx("button", { type: "button", children: "Open Card Agents Prototype" })] }), _jsx("section", { className: "status-grid", children: podSummary.map((summary) => (_jsxs("article", { children: [_jsx("span", { className: "badge", children: summary.status }), _jsxs("h2", { children: [summary.count, " pods"] }), _jsx("p", { children: summary.description })] }, summary.status))) }), _jsxs("section", { className: "callouts", children: [_jsxs("div", { children: [_jsx("h3", { children: "Single watch stream" }), _jsx("p", { children: "Upcoming work: connect to the OpenShift watch API with reconnection-only logic and no polling fallback." })] }), _jsxs("div", { children: [_jsx("h3", { children: "Native settings page" }), _jsx("p", { children: "Ship the Trello Power-Up admin iframe that stores cluster URL, login label, token, and ignore-SSL toggle." })] }), _jsxs("div", { children: [_jsx("h3", { children: "Stop & Log actions" }), _jsx("p", { children: "Wire optimistic pod deletion plus log streaming modals with AbortController cleanup." })] })] })] }));
};
export default InnerPage;
