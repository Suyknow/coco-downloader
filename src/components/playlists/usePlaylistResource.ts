"use client";

import { useEffect, useState } from "react";
import { notifyPlaylistError } from "./PlaylistCards";

export function usePlaylistResource<T>(load: (signal: AbortSignal) => Promise<T>, errorKey: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    load(controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : "资料读取失败");
      notifyPlaylistError(error, errorKey);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, errorKey, revision]);
  return { data, loading, error, retry: () => setRevision(value => value + 1) };
}
