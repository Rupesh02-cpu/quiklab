"use client";

import { Icon } from "@/components/Icon";

export interface StepDef {
  readonly key: string;
  readonly label: string;
}

interface StepperProps {
  readonly steps: readonly StepDef[];
  readonly currentIndex: number;
  /** Highest step index the user has actually reached, so completed steps
   * stay clickable to go back without allowing a jump past what's ready. */
  readonly maxReachedIndex: number;
  readonly onStepClick: (index: number) => void;
}

// Shared step indicator for both tools' Upload -> Configure -> Result flow.
// Same visual language as the rest of the app (accent color, Inter,
// existing motion timing) rather than a separate design.
export function Stepper({ steps, currentIndex, maxReachedIndex, onStepClick }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isReachable = index <= maxReachedIndex;
        return (
          <div className="stepper-item" key={step.key}>
            <button
              type="button"
              className={`stepper-dot${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`}
              disabled={!isReachable}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => isReachable && onStepClick(index)}
            >
              {isDone ? <Icon name="check" className="icon icon-sm" /> : <span className="mono">{index + 1}</span>}
            </button>
            <span className={`stepper-label${isCurrent ? " is-current" : ""}`}>{step.label}</span>
            {index < steps.length - 1 && <span className={`stepper-line${isDone ? " is-done" : ""}`} aria-hidden="true" />}
          </div>
        );
      })}
    </nav>
  );
}
