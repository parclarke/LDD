import { STAGES } from '../lib/types';

interface Props {
  currentStage?: string;
  resolved?: boolean;
}

/** Chevron stage indicator: Initialization → Triage → Review → Recommendation and action. */
export function StageStepper({ currentStage, resolved }: Props) {
  const currentIndex = STAGES.findIndex((s) => s === currentStage);
  return (
    <div className="stepper" role="list">
      {STAGES.map((stage, i) => {
        const complete = resolved || (currentIndex >= 0 && i < currentIndex);
        const isCurrent = !resolved && i === currentIndex;
        return (
          <div key={stage} className={`step${isCurrent ? ' current' : ''}`} role="listitem">
            {complete && <span className="tick">✓</span>}
            <span>{stage}</span>
          </div>
        );
      })}
    </div>
  );
}
