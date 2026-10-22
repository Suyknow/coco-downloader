import { Triangle } from "lucide-react";
import type { RankTrend } from "@/types/playlist";
import styles from "./discovery.module.css";

export function RankIndicator({ trend }: { trend?: RankTrend }) {
  const type = trend?.type ?? "unknown";
  if (type === "new") return <span className={styles.rankNew} title="新上榜">新</span>;
  if (type === "up" || type === "down") return <span className={type === "up" ? styles.rankUp : styles.rankDown} title={`${type === "up" ? "上升" : "下降"}${trend?.value ?? ""}位`}><Triangle size={8} fill="currentColor" strokeWidth={0} /></span>;
  if (type === "heat" && trend?.value !== undefined) return <span className={trend.value < 0 ? styles.rankDown : styles.rankUp} title={`热度变化 ${trend.value}%`}>{trend.value > 0 ? "+" : ""}{trend.value}%</span>;
  return <span className={styles.rankSame} title={type === "same" ? "排名不变" : "源站未提供趋势"}>—</span>;
}
