"use client";
import Image from "next/image";
import { useState } from "react";
import { Music2 } from "lucide-react";
import { playlistCoverUrl } from "@/lib/playlists/cover";
import styles from "./artwork.module.css";

export function Artwork({ url, className = "" }: { url?: string; className?: string }) {
  const source = playlistCoverUrl(url);
  const [failure, setFailure] = useState({ source: "", attempt: 0 });
  const attempt = failure.source === source ? failure.attempt : 0;
  const direct = url?.replace(/^http:/, "https:");
  // Try the same-origin proxy first, then the original CDN URL if a transient proxy
  // failure occurs. A changed URL starts fresh rather than keeping a stale error.
  const sources = [...new Set([source, direct].filter((value): value is string => Boolean(value)))];
  const current = sources[attempt];
  return <span className={`${styles.artwork} ${className}`}>
    {current ? <Image key={current} src={current} width={400} height={400} alt="" unoptimized referrerPolicy="no-referrer" onError={() => setFailure({ source: source ?? "", attempt: attempt + 1 })} /> : <Music2 size={24} strokeWidth={1.3} />}
  </span>;
}
