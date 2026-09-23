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
  /** True while an async run/compress is in flight — step dots become
   * unclickable so the user can't navigate away from work that's still
   * processing (the in-flight operation isn't cancelled by navigating,
   * only by an explicit clear/reset). */
  readonly locked?: boolean;
}

// Shared step indicator for both tools' Upload -> Configure -> Result flow.
// Same visual language as the rest of the app (accent color, Inter,
// existing motion timing) rather than a separate design.
export function Stepper({ steps, currentIndex, maxReachedIndex, onStepClick, locked }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isReachable = index <= maxReachedIndex && !locked;
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
