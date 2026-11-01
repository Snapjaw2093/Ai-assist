import { dateTime, duration, phone } from "@/lib/crm/format";
import { listCalls } from "@/lib/crm/store";

export default async function Calls() {
  const calls = await listCalls();
  return (
    <>
      <h1>Calls</h1>
      <p className="sub">Every call the AI has answered, with its summary and transcript.</p>
      <div className="card tablecard">
        {calls.length === 0 ? <div className="empty">No calls yet. Once Retell&apos;s webhook is set up, calls show here after they end.</div> : (
          <table>
            <thead><tr><th>When</th><th>Caller</th><th>Length</th><th>Summary</th></tr></thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td>{dateTime(c.at)}</td>
                  <td>{phone(c.fromNumber)}</td>
                  <td>{duration(c.durationSec)}</td>
                  <td>
                    {c.summary ?? <span className="muted">Summary pending…</span>}
                    <div className="muted">{[c.sentiment, c.successful === true ? "successful" : c.successful === false ? "unsuccessful" : null].filter(Boolean).join(" · ")}</div>
                    {c.recordingUrl && <div><a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Recording</a></div>}
                    {c.transcript && <details><summary>Transcript</summary><pre>{c.transcript}</pre></details>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
