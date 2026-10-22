"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { LayoutGroup, MotionConfig } from "framer-motion";
import { Search, ListMusic } from "lucide-react";
import type { PlaylistDetail } from "@/types/playlist";
import { SegmentedControl } from "./SegmentedControl";

const ModeContext = createContext<{
  discovery: boolean;
  setDiscovery: (value: boolean) => void;
  searchSlot: HTMLDivElement | null;
  setSearchSlot: (value: HTMLDivElement | null) => void;
  importedPlaylist: PlaylistDetail | null;
  setImportedPlaylist: (value: PlaylistDetail | null) => void;
} | null>(null);

export function DiscoveryModeProvider({ children }: { children: ReactNode }) {
  const [discovery, setDiscovery] = useState(false);
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  const [importedPlaylist, setImportedPlaylist] = useState<PlaylistDetail | null>(null);
  return <ModeContext.Provider value={{ discovery, setDiscovery, searchSlot, setSearchSlot, importedPlaylist, setImportedPlaylist }}>
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 280, damping: 32 }}>
      <LayoutGroup id="music-mode">{children}</LayoutGroup>
    </MotionConfig>
  </ModeContext.Provider>;
}

export function useDiscoveryMode() {
  const value = useContext(ModeContext);
  if (!value) throw new Error("DiscoveryModeProvider is required");
  return value;
}

export function ModeSwitch() {
  const { discovery, setDiscovery } = useDiscoveryMode();
  return <SegmentedControl<"search" | "playlists"> value={discovery ? "playlists" : "search"} onChange={value => setDiscovery(value === "playlists")} label="浏览模式" options={[
    { label: "歌曲搜索", value: "search", icon: <Search size={15} /> },
    { label: "发现歌单", value: "playlists", icon: <ListMusic size={15} /> },
  ]} />;
}
