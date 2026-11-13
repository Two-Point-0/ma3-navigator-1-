import type { ElementType } from "react";

export interface PageTabOption {
  id: string;
  label: string;
  Icon?: ElementType;
}

/**
 * idle  = neutral (nothing is happening)
 * go    = green  (moving / ready / all good)
 * ready = amber  (slow / loading / needs attention soon)
 * stop  = red    (stopped / problem)
 */
export type TabTone = "idle" | "go" | "ready" | "stop";

interface PageTabsProps {
  label: string;
  active: string;
  tabs: readonly PageTabOption[];
  onChange: (id: string) => void;
  /** The colour the active tab glows. Every tab looks the same; only the app's state changes this. */
  tone?: TabTone;
}

export default function PageTabs({ label, active, tabs, onChange, tone = "idle" }: PageTabsProps) {
  return (
    <nav className="page-tabs" aria-label={label} role="tablist" data-tone={tone}>
      {tabs.map(({ id, label: text, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`page-tab${active === id ? " active" : ""}`}
          onClick={() => onChange(id)}
        >
          {Icon && <Icon size={14} aria-hidden="true" />}
          <span>{text}</span>
        </button>
      ))}
    </nav>
  );
}
