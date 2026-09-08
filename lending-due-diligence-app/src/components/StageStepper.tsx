import { primaryStages } from '../lib/engine';
import type { LddStage } from '../lib/types';

interface Props {
  stages: LddStage[];
  currentStageCode?: string | null;
  resolved?: boolean;
}

/**
 * Chevron stage indicator built from the case type's configured primary stages.
 * When the case sits on an alternate stage (escalation, rework) that stage is
 * appended so the user can see where the case actually is.
 */
export function StageStepper({ stages, currentStageCode, resolved }: Props) {
  const primary = primaryStages(stages);
  const current = stages.find((s) => s.ava_stagecode === currentStageCode);
  const onAlternate = current && current.ava_stagetype === 'Alternate';

  const shown = onAlternate ? [...primary, current] : primary;
  const currentIndex = shown.findIndex((s) => s.ava_stagecode === currentStageCode);

  return (
    <div className="stepper" role="list">
      {shown.map((stage, i) => {
        const complete = resolved || (currentIndex >= 0 && i < currentIndex);
        const isCurrent = !resolved && i === currentIndex;
        return (
          <div
            key={stage.ava_lddstageid}
            className={`step${isCurrent ? ' current' : ''}`}
            role="listitem"
            title={stage.ava_processname ?? undefined}
          >
            {complete && <span className="tick">✓</span>}
            <span>{stage.ava_name}</span>
          </div>
        );
      })}
    </div>
  );
}
