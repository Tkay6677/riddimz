"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, Mic, Music, Pause, Play, SkipForward, StopCircle, Trash2, Plus, Menu, X, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import { supabase } from "@/lib/supabase";

/* ---------- Types & Dummy Data ---------- */
interface Song {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  lyrics: string; // LRC-like string
}

/* ---------- Helper functions ---------- */
const parseTime = (token: string): number => {
  const m = token.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
  if (!m) return 0;
  const [, mm, ss, cs] = m;
  return +mm * 60 + +ss + +cs / 100;
};

const parseLyrics = (raw: string) =>
  raw.split("\n")
    .map((l) => {
      const t = l.match(/\[\d{2}:\d{2}\.\d{2}\]/);
      if (!t) return null;
      return { time: parseTime(t[0]), text: l.replace(t[0], "").trim() };
    })
    .filter(Boolean) as { time: number; text: string }[];

/* ---------- Component ---------- */
export default function QuickKaraokeRoom() {
  const { toast } = useToast();

  // Debug state
  const [debugInfo, setDebugInfo] = useState<string>("");



  // Fetch songs directly from public bucket
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSongs = async () => {
    setLoading(true);
    setDebugInfo("Starting to fetch songs...");
    
    try {
      const { data: files, error } = await supabase.storage.from('karaoke-songs').list('quick_karaoke', { limit: 100 });
      setDebugInfo(`Fetched ${files?.length || 0} files from bucket`);
      console.log('DEBUG client list:', files, error);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Fetch error', description: error.message });
        setLoading(false);
        return;
      }

      if (!files || files.length === 0) {
        setDebugInfo("No files found in storage bucket");
        setSongs([]);
        setLoading(false);
        return;
      }

      // Group files by their base name (without extension)
      const map: Record<string, { mp3?: string; lrc?: string }> = {};
      files.forEach((file) => {
        if (!file.name.includes('.')) {
          console.warn(`Skipping file without extension: ${file.name}`);
          return;
        }
        
        const parts = file.name.split('.');
        const ext = parts[parts.length - 1].toLowerCase();
        const id = parts.slice(0, -1).join('.');
        
        if (!map[id]) map[id] = {};
        
        if (ext === 'mp3' || ext === 'wav' || ext === 'm4a') {
          map[id].mp3 = file.name;
        } else if (ext === 'lrc' || ext === 'txt') {
          map[id].lrc = file.name;
        }
      });

      setDebugInfo(`Processed ${Object.keys(map).length} unique song IDs`);

      const list: Song[] = [];
      
      for (const id in map) {
        const entry = map[id];
        
        // Skip if no audio file
        if (!entry.mp3) {
          console.warn(`No audio file found for ${id}`);
          continue;
        }

        try {
          // Construct public URL for audio
          const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/quick_karaoke/${entry.mp3}`;

          let lyricsText = '';
          
          // Load lyrics via public URL if exists
          if (entry.lrc) {
            const { data } = supabase.storage.from('karaoke-songs').getPublicUrl(`quick_karaoke/${entry.lrc}`);
            const lrcUrl = data.publicUrl;
            try {
              const res = await fetch(lrcUrl);
              if (res.ok) {
                lyricsText = await res.text();
              } else {
                console.warn(`Failed to fetch lyrics for ${id}: HTTP ${res.status}`);
              }
            } catch (err) {
              console.warn(`Error fetching lyrics for ${id}:`, err);
            }
          }

          // Create song object
          const song: Song = {
            id,
            title: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Format title
            artist: '', // You might want to extract this from metadata or filename
            audioUrl: publicUrl,
            lyrics: lyricsText
          };

          list.push(song);
          console.log(`Added song: ${song.title}`);
          
        } catch (songError) {
          console.error(`Error processing song ${id}:`, songError);
        }
      }

      setSongs(list);
      setDebugInfo(`Successfully loaded ${list.length} songs`);
      
    } catch (err: any) {
      console.error('Error fetching songs:', err);
      setDebugInfo(`Error: ${err.message}`);
      toast({ variant: 'destructive', title: 'Fetch error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // Queue state
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const currentSong = currentIdx >= 0 ? queue[currentIdx] : null;

  // Lyrics
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("");
  const [nextLyrics, setNextLyrics] = useState<string[]>([]);

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const duration = audioRef.current?.duration ?? 0;
  const progressPercent = duration ? (time / duration) * 100 : 0;

  // Recording
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [ctx, setCtx] = useState<AudioContext | null>(null);

  /* ----- Song queue helpers ----- */
  
  const addSong = (id: string) => {
    const s = songs.find((x: Song) => x.id === id);
    if (!s) return;
    setQueue((q) => [...q, s]);
    if (currentIdx === -1) setCurrentIdx(0);
    toast({ title: `${s.title} added` });
  };
  const removeSong = (idx: number) => {
    setQueue((q) => q.filter((_, i) => i !== idx));
    if (idx === currentIdx) {
      audioRef.current?.pause();
      setCurrentIdx(-1);
    } else if (idx < currentIdx) setCurrentIdx((i) => i - 1);
  };

  /* ----- Setup new song ----- */
  useEffect(() => {
    if (!currentSong) return;

    // Load lyrics for current song
    const loadLyrics = async () => {
      try {
        const { data: lrcBlob, error: lrcErr } = await supabase.storage.from('karaoke-songs').download(`quick_karaoke/${currentSong.id}.lrc`);
        let raw = '';
        if (!lrcErr && lrcBlob) raw = await lrcBlob.text();
        const parsed = parseLyrics(raw);
        setLyrics(parsed);
      } catch (err) {
        console.error('Error loading lyrics:', err);
        setLyrics([]);
      }
    };
    loadLyrics();
    setCurrentLyric("");
    setNextLyrics([]);


    // audio
    const a = audioRef.current!;
    a.src = currentSong.audioUrl;
    a.crossOrigin = "anonymous";
    a.load();
    const onTime = () => setTime(a.currentTime);
    const onEnd = () => currentIdx < queue.length - 1 && setCurrentIdx(currentIdx + 1);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);

    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  /* ----- Lyric progress ----- */
  useEffect(() => {
    if (!lyrics.length) return;
    const i = lyrics.findIndex((l, idx) => time >= l.time && (!lyrics[idx + 1] || time < lyrics[idx + 1].time));
    if (i !== -1) {
      setCurrentLyric(lyrics[i].text);
      setNextLyrics(lyrics.slice(i + 1, i + 3).map((l) => l.text));
    }
  }, [time, lyrics]);

  /* ----- Recording ----- */
  const startRec = async () => {
    if (recording || !audioRef.current) return;
    try {
      const audioCtx = ctx || new AudioContext();
      setCtx(audioCtx);
      const dest = audioCtx.createMediaStreamDestination();
      // mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx.createMediaStreamSource(mic).connect(dest);
      // backing
      const trackNode = audioCtx.createMediaElementSource(audioRef.current);
      trackNode.connect(dest);
      trackNode.connect(audioCtx.destination);

      const rec = new MediaRecorder(dest.stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        setRecordedUrl(URL.createObjectURL(new Blob(chunks, { type: "audio/webm" })));
        setRecording(false);
        mic.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Rec error", description: err.message });
    }
  };
  const stopRec = () => recorderRef.current?.stop();

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.error(err);
        toast({ variant: "destructive", title: "Playback error", description: err.message });
      });
    }
  };

  const pauseAudio = () => {
    audioRef.current?.pause();
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ----- Render ----- */
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-background border-r border-neutral-700 flex flex-col pt-16 md:pt-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`} >
        <Tabs orientation="vertical" defaultValue="songs" className="flex-1">
          <TabsList className="border-b border-border">
            <TabsTrigger value="songs" className="text-foreground data-[state=active]:bg-clip-text data-[state=active]:text-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-purple-600">Songs</TabsTrigger>
            <TabsTrigger value="queue" className="text-foreground data-[state=active]:bg-clip-text data-[state=active]:text-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-purple-600">Queue</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1 p-4">
            <TabsContent value="songs">
              <ul className="space-y-2">
                {songs.map((s) => (
                  <li key={s.id} className="flex justify-between items-center p-2 hover:bg-neutral-700 rounded">
                    <span>{s.title}</span>
                    <Button size="icon" variant="ghost" onClick={() => addSong(s.id)}>
                      <Plus className="h-4 w-4 text-accent-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="queue">
              <ul className="space-y-2">
                {queue.map((s, i) => (
                  <li key={`${s.id}-${i}`} className="flex justify-between items-center p-2 hover:bg-neutral-700 rounded">
                    <span>{i + 1}. {s.title}</span>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setCurrentIdx(i)}>
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeSong(i)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>
      <main className="flex-1 flex flex-col px-6 pb-6 pt-16 md:pt-6 overflow-auto relative">
        <Button variant="ghost" className={`md:hidden fixed top-20 z-50 ${sidebarOpen ? 'left-64' : 'left-4'}`} onClick={() => setSidebarOpen(prev => !prev)}>
          {sidebarOpen ? <X className="h-6 w-6 text-foreground" /> : <Menu className="h-6 w-6 text-foreground" />}
        </Button>
      {/* <h1 className="text-5xl font-bold text-center text-green-500 mb-6">Quick Karaoke</h1> */}



      {/* Refresh button */}
      <Button onClick={fetchSongs} disabled={loading} size="icon" variant="ghost" className="fixed top-20 right-4 z-50 text-foreground border border-neutral-700 hover:bg-foreground/20">
        {loading ? <RefreshCw className="h-6 w-6 animate-spin" /> : <RefreshCw className="h-6 w-6" />}
      </Button>



      {/* Song list for debugging */}
      {/* {songs.length > 0 && (
        <div className="bg-neutral-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Available Songs:</h3>
          {songs.map((song) => (
            <div key={song.id} className="text-sm mb-1">
              <strong>{song.title}</strong> - {song.artist}
              <br />
              <span className="text-muted-foreground">ID: {song.id}</span>
              <br />
              <span className="text-muted-foreground">Lyrics: {song.lyrics ? `${song.lyrics.length} chars` : 'None'}</span>
            </div>
          ))}
        </div>
      )} */}

      {/* Selector */}
      {/* <div className="flex gap-2 items-center">
        <select
          className="flex-1 bg-neutral-800 text-white border border-neutral-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">-- Choose a song --</option>
          {songs.map((s: Song) => (
            <option key={s.id} value={s.id}>
              {s.title} – {s.artist}
            </option>
          ))}
        </select>
        <Button
          disabled={!selectedId}
          onClick={addSong}
          variant="ghost"
          className="text-green-500 hover:bg-green-600 hover:text-white"
        >
          Add to Queue
        </Button>
      </div> */}

      {/* Queue */}
      {/* {queue.length > 0 && (
        <ul className="space-y-1 bg-neutral-800 p-4 rounded-lg">
          {queue.map((s, i) => (
            <li
              key={`${s.id}-${i}`}
              className={`flex items-center justify-between px-4 py-2 rounded-lg hover:bg-neutral-700 ${i === currentIdx ? "bg-neutral-700 text-green-500" : ""}`}
            >
              <span>
                {i + 1}. {s.title}
              </span>
              <div className="flex gap-1">
                {i !== currentIdx && (
                  <Button size="icon" variant="ghost" onClick={() => setCurrentIdx(i)}>
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => removeSong(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )} */}

      {/* Player & lyrics */}
      {currentSong && (
        <>
          <h2 className="text-2xl font-bold text-center mb-4">{currentSong.title} – {currentSong.artist}</h2>
            <input
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              readOnly
              className="w-full accent-accent mb-6"
            />
        

          {/* Lyrics */}
          {lyrics.length > 0 && (
            <div className="relative w-full h-64 mt-6">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/40 via-red-500/20 to-purple-600/40 backdrop-blur-md rounded-2xl shadow-2xl"></div>
              <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 space-y-4 text-center">
                <p className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-purple-600 animate-pulse">{currentLyric}</p>
                <div className="flex flex-col space-y-2">
                  {nextLyrics.map((l, i) => (
                    <p key={i} className="text-gray-400 text-lg opacity-80">{l}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="p-6 bg-card/50 rounded-2xl shadow-md mb-6 flex items-center justify-center space-x-12">
            <div className="flex items-center justify-center space-x-4">
              {audioRef.current?.paused ? (
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-foreground/10 hover:bg-foreground/20" onClick={playAudio}>
                  <Play className="h-6 w-6 text-foreground" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-foreground/10 hover:bg-foreground/20" onClick={pauseAudio}>
                  <Pause className="h-6 w-6 text-foreground" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-foreground/10 hover:bg-foreground/20" onClick={() => currentIdx < queue.length - 1 && setCurrentIdx(currentIdx + 1)} disabled={currentIdx >= queue.length - 1}>
                <SkipForward className="h-6 w-6 text-foreground" />
              </Button>
            </div>
            <div>
              {!recording ? (
                <Button onClick={startRec} variant="ghost" className="flex items-center gap-2 border border-neutral-700 rounded px-4 py-2 hover:bg-neutral-800">
                  <Mic className="h-4 w-4" /> Record
                </Button>
              ) : (
                <Button onClick={stopRec} variant="destructive" className="flex items-center gap-2 border border-red-600 rounded px-4 py-2 hover:bg-red-700">
                  <StopCircle className="h-4 w-4" /> Stop
                </Button>
              )}
            </div>
          </div>
        </>
      )}



      {recordedUrl && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <audio controls src={recordedUrl} className="w-full" />
          <a href={recordedUrl} download="karaoke-recording.webm">
            <Button variant="ghost" className="flex items-center gap-2 border border-neutral-700 rounded px-4 py-2 hover:bg-neutral-800">
              <Download className="h-4 w-4" /> Download
            </Button>
          </a>
        </div>
      )}
    </main>
    </div>
  );
}