"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
export type TemplateFilter = { id: string; label: string; allowAll?: boolean; options: { id: string; label: string }[] };
import styles from "./filter-row.module.css";

export default function FilterRow({ group, value, onChange }: { group: TemplateFilter; value: string; onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false), [count, setCount] = useState(0), [overflows, setOverflows] = useState(true);
  const row = useRef<HTMLDivElement>(null), measure = useRef<HTMLDivElement>(null), choices = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState({ collapsed: 0, expanded: 0 });
  const options = [...(group.allowAll === false ? [] : [{ id: "", label: "全部" }]), ...group.options];
  useLayoutEffect(() => {
    const update = () => {
      if (!row.current || !measure.current) return;
      const width = row.current.clientWidth;
      if (!width) return;
      const buttons = [...measure.current.children] as HTMLElement[];
      const gap = parseFloat(getComputedStyle(measure.current).columnGap) || 0;
      const total = buttons.reduce((sum, button) => sum + button.getBoundingClientRect().width, 0) + gap * (buttons.length - 1);
      const overflow = total > width;
      const available = width - (overflow ? 60 : 0);
      let used = 0, fits = 0;
      for (const button of buttons) { const next = button.getBoundingClientRect().width + (fits ? gap : 0); if (used + next > available) break; used += next; fits++; }
      setCount(Math.max(1, fits)); setOverflows(overflow);
      const collapsed = choices.current?.firstElementChild?.getBoundingClientRect().height || 0;
      const expandedHeight = choices.current?.getBoundingClientRect().height || 0;
      setHeights(previous => previous.collapsed === collapsed && previous.expanded === expandedHeight ? previous : { collapsed, expanded: expandedHeight });
    };
    update(); const observer = new ResizeObserver(update); if (row.current) observer.observe(row.current); if (measure.current) observer.observe(measure.current); if (choices.current) observer.observe(choices.current);
    document.fonts.ready.then(update);
    return () => observer.disconnect();
  }, [group, value]);
  return <div className={styles.filterRow}><span className={styles.filterLabel} id={`filter-label-${group.id}`}>{group.label}</span><div ref={row} className={styles.filterArea}>
    <div ref={measure} className={`${styles.filterChoices} ${styles.measure}`} aria-hidden="true">{options.map(option => <button tabIndex={-1} key={option.id} aria-pressed={value === option.id}>{option.label}</button>)}</div>
    <div className={styles.filterOptionsViewport} style={{ height: (expanded ? heights.expanded : heights.collapsed) || undefined }}><div ref={choices} className={styles.filterChoices} id={`filter-options-${group.id}`} role="group" aria-labelledby={`filter-label-${group.id}`}>
      {options.map((option, index) => <button key={option.id} data-concealed={!expanded && index >= count ? "true" : undefined} aria-hidden={!expanded && index >= count} tabIndex={!expanded && index >= count ? -1 : 0} aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}
    </div></div>
    <button hidden={!overflows} className={`text-button ${styles.more}`} aria-label={`${expanded ? "收起" : "展开"}${group.label}选项`} aria-expanded={expanded} aria-controls={`filter-options-${group.id}`} onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "更多"}<ChevronDown size={13} className={expanded ? styles.filterChevronExpanded : undefined} /></button>
  </div></div>;
}
