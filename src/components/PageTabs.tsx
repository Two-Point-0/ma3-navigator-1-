import type { ElementType } from "react";

export interface PageTabOption {
  id: string;
  label: string;
  Icon?: ElementType;
}

interface PageTabsProps {
  label: string;
  active: string;
  tabs: readonly PageTabOption[];
  onChange: (id: string) => void;
}

export default function PageTabs({ label, active, tabs, onChange }: PageTabsProps) {
  const tones = ["stop", "ready", "go"] as const;
  const traffic = tabs.length === 3;
  return (
    <nav className="page-tabs" aria-label={label} role="tablist">
      {tabs.map(({ id, label: text, Icon }, index) => (
        <button
          key={id}
          data-tone={traffic ? tones[index] : "ready"}
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
