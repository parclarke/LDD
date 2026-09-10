import { useState } from 'react';
import { Icon } from '../components/Icon';

interface AgentScreenProps {
  appName: string;
}

interface Turn {
  id: number;
  from: 'agent' | 'user';
  text: string;
}

const OPENING =
  'Hi, I can help you find work, explain a case or summarise what is happening across the application. ' +
  'Ask me a question to get started.';

/** The in-app agent surface. Replies are local so the PoC needs no model endpoint. */
export function AgentScreen({ appName }: AgentScreenProps) {
  const [turns, setTurns] = useState<Turn[]>([{ id: 0, from: 'agent', text: OPENING }]);
  const [draft, setDraft] = useState('');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setTurns((prev) => [
      ...prev,
      { id: prev.length, from: 'user', text },
      {
        id: prev.length + 1,
        from: 'agent',
        text: `This prototype agent is not connected to a model yet. In the migrated application "${text}" would be answered from the case and record data in Dataverse.`,
      },
    ]);
  };

  return (
    <div className="agentwrap">
      <div className="ph">
        <div className="badge">
          <Icon name="spark" />
        </div>
        <div>
          <h1>{appName} Agent</h1>
          <div className="sub">Ask about cases, assignments and records in this application</div>
        </div>
      </div>

      <div className="agentbody">
        {turns.map((t) => (
          <div key={t.id} className={t.from === 'agent' ? 'turn agent' : 'turn user'}>
            {t.from === 'agent' ? (
              <span className="av">
                <Icon name="spark" />
              </span>
            ) : null}
            <p>{t.text}</p>
          </div>
        ))}
      </div>

      <div className="agentcompose">
        <input
          value={draft}
          placeholder="Ask a question…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button type="button" title="Dictate">
          <Icon name="mic" />
        </button>
        <button type="button" title="Send" onClick={send}>
          <Icon name="send" />
        </button>
      </div>
      <p className="agentnote">Responses are generated for demonstration and should be verified.</p>
    </div>
  );
}
