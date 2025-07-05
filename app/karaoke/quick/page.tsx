"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { 
  Download, Mic, Music, Pause, Play, SkipForward, StopCircle, Trash2, Plus, 
  Menu, X, RefreshCw, Volume2, VolumeX, Clock, ListMusic, Headphones,
  Sparkles, Star, Heart, Share2, Repeat, Shuffle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

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
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const duration = audioRef.current?.duration ?? 0;
  const progressPercent = duration ? (time / duration) * 100 : 0;

  // Recording
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [ctx, setCtx] = useState<AudioContext | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [destinationNode, setDestinationNode] = useState<MediaStreamAudioDestinationNode | null>(null);
  const [micSource, setMicSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const [musicSource, setMusicSource] = useState<MediaElementAudioSourceNode | null>(null);
  const [micGain, setMicGain] = useState<GainNode | null>(null);
  const [musicGain, setMusicGain] = useState<GainNode | null>(null);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [micVolume, setMicVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.7);

  /* ----- Song queue helpers ----- */
  
  const addSong = (id: string) => {
    const s = songs.find((x: Song) => x.id === id);
    if (!s) return;
    setQueue((q) => [...q, s]);
    if (currentIdx === -1) setCurrentIdx(0);
    toast({ title: `${s.title} added to queue` });
  };
  
  const removeSong = (idx: number) => {
    setQueue((q) => q.filter((_, i) => i !== idx));
    if (idx === currentIdx) {
      audioRef.current?.pause();
      setCurrentIdx(-1);
    } else if (idx < currentIdx) setCurrentIdx((i) => i - 1);
  };

  const loadLyrics = async () => {
    if (!currentSong?.lyrics) return;
    
    const parsed = parseLyrics(currentSong.lyrics);
    setLyrics(parsed);
  };

  useEffect(() => {
    if (currentSong) {
      loadLyrics();
      // Set the audio source
      if (audioRef.current) {
        audioRef.current.src = currentSong.audioUrl;
        audioRef.current.load();
        // Reset time when song changes
        setTime(0);
      }
    }
  }, [currentSong]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setTime(a.currentTime);
    const onEnd = () => currentIdx < queue.length - 1 && setCurrentIdx(currentIdx + 1);

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);

    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, [currentIdx, queue.length]);

  useEffect(() => {
    if (!lyrics.length) return;

    const current = lyrics.find(l => l.time > time);
    const currentIndex = current ? lyrics.indexOf(current) - 1 : lyrics.length - 1;
    
    if (currentIndex >= 0) {
      setCurrentLyric(lyrics[currentIndex].text);
      setNextLyrics(lyrics.slice(currentIndex + 1, currentIndex + 4).map(l => l.text));
    }
  }, [time, lyrics]);

  const startRec = async () => {
    try {
      // Check if we have a current song
      if (!currentSong) {
        toast({ 
          variant: 'destructive', 
          title: 'No Song Selected', 
          description: 'Please select a song to record with' 
        });
        return;
      }

      // Check if audio is playing
      if (audioRef.current?.paused) {
        toast({ 
          variant: 'destructive', 
          title: 'Audio Not Playing', 
          description: 'Please start playing the song before recording' 
        });
        return;
      }

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Create audio context for mixing
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(audioCtx);

      // Create destination node for recording
      const destination = audioCtx.createMediaStreamDestination();
      setDestinationNode(destination);

      // Create microphone source and gain
      const micSourceNode = audioCtx.createMediaStreamSource(micStream);
      const micGainNode = audioCtx.createGain();
      micGainNode.gain.value = micVolume; // Use current mic volume setting
      setMicSource(micSourceNode);
      setMicGain(micGainNode);

      // Create a separate audio element for recording to avoid disconnecting the main one
      const recordingAudio = new Audio();
      recordingAudio.crossOrigin = 'anonymous';
      recordingAudio.currentTime = audioRef.current!.currentTime; // Sync with main audio
      recordingAudioRef.current = recordingAudio;
      
      // Create recorder from mixed stream
      const mixedStream = destination.stream;
      const recorder = new MediaRecorder(mixedStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        console.log('Recording data available:', e.data.size, 'bytes');
        chunks.push(e.data);
      };
      recorder.onstop = () => {
        console.log('Recording stopped, total chunks:', chunks.length);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        
        // Clean up audio context
        audioCtx.close();
        setAudioContext(null);
        setDestinationNode(null);
        setMicSource(null);
        setMusicSource(null);
        setMicGain(null);
        setMusicGain(null);
        
        // Stop microphone stream
        micStream.getTracks().forEach(track => track.stop());
        
        // Clean up recording audio element
        if (recordingAudioRef.current) {
          recordingAudioRef.current.pause();
          recordingAudioRef.current.src = '';
          recordingAudioRef.current = null;
        }
      };

      recorderRef.current = recorder;
      
      // Set the source and load the recording audio
      recordingAudio.src = currentSong.audioUrl;
      
      // Set up the recording audio and start recording
      let setupComplete = false;
      const setupRecording = () => {
        if (setupComplete) return;
        setupComplete = true;
        
        console.log('Setting up audio graph...');
        
        // Resume audio context if needed
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        
        // Create music source and gain from the recording audio element
        const musicSourceNode = audioCtx.createMediaElementSource(recordingAudio);
        const musicGainNode = audioCtx.createGain();
        musicGainNode.gain.value = musicVolume; // Use current music volume setting
        setMusicSource(musicSourceNode);
        setMusicGain(musicGainNode);

        // Connect the audio graph
        micSourceNode.connect(micGainNode);
        micGainNode.connect(destination);

        musicSourceNode.connect(musicGainNode);
        musicGainNode.connect(destination);

        console.log('Audio graph connected:', {
          micConnected: micSourceNode.numberOfOutputs > 0,
          musicConnected: musicSourceNode.numberOfOutputs > 0,
          destinationStream: destination.stream.getTracks().length,
          audioCtxState: audioCtx.state
        });

        // Start the recording audio at the same time as the main audio
        recordingAudio.play();
        
        // Start recording
        recorder.start();
      setRecording(true);
        
        console.log('Recording started with mixed audio');
      };
      
      // Try to set up immediately, and also listen for loadeddata as backup
      recordingAudio.addEventListener('loadeddata', setupRecording);
      recordingAudio.addEventListener('canplay', setupRecording);
      
      // Load the recording audio
      recordingAudio.load();
      
      // If audio is already loaded, set up immediately
      if (recordingAudio.readyState >= 2) {
        setupRecording();
      }
      
      toast({ 
        title: "Recording Started", 
        description: "Recording karaoke with background music and microphone" 
      });
      
      console.log('Recording started with audio mixing');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Recording Error', 
        description: 'Could not access microphone or start recording' 
      });
    }
  };

  const stopRec = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      toast({ 
        title: "Recording Stopped", 
        description: "Your karaoke recording is ready!" 
      });
    }
  };

  const playAudio = async () => {
    try {
    if (audioRef.current) {
        await audioRef.current.play();
        console.log('Audio started playing');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Playback Error', 
        description: 'Could not play audio. Please try again.' 
      });
    }
  };

  const pauseAudio = () => {
    audioRef.current?.pause();
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const handleMicVolumeChange = (newVolume: number) => {
    setMicVolume(newVolume);
    if (micGain) {
      micGain.gain.value = newVolume;
    }
  };

  const handleMusicVolumeChange = (newVolume: number) => {
    setMusicVolume(newVolume);
    if (musicGain) {
      musicGain.gain.value = newVolume;
    }
  };

  /* ----- Render ----- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      <audio 
        ref={audioRef} 
        className="hidden" 
        crossOrigin="anonymous"
        onError={(e) => console.error('Audio error:', e)}
        onLoadStart={() => console.log('Audio loading started')}
        onCanPlay={() => console.log('Audio can play')}
      />
      <audio 
        ref={recordingAudioRef} 
        className="hidden" 
        crossOrigin="anonymous"
      />
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <aside className={`fixed top-20 bottom-0 left-0 z-30 w-80 transform bg-black/20 backdrop-blur-xl border-r border-white/10 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:top-0 md:translate-x-0`}>
          <div className="p-4 md:p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                  <Headphones className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Quick Karaoke
                  </h1>
                  <p className="text-xs md:text-sm text-gray-400">Practice your vocals</p>
                </div>
              </div>
              
              {/* Mobile Close Button */}
              <Button 
                variant="ghost" 
                size="icon"
                className="md:hidden h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                {songs.length} Songs
              </Badge>
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                {queue.length} in Queue
              </Badge>
            </div>
          </div>

        <Tabs orientation="vertical" defaultValue="songs" className="flex-1">
            <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-white/10">
              <TabsTrigger value="songs" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                <Music className="h-4 w-4 mr-2" />
                Songs
              </TabsTrigger>
              <TabsTrigger value="queue" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                <ListMusic className="h-4 w-4 mr-2" />
                Queue
              </TabsTrigger>
          </TabsList>
            
          <ScrollArea className="flex-1 p-4">
              <TabsContent value="songs" className="mt-0">
                <div className="space-y-2">
                  {songs.map((song) => (
                    <Card key={song.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-200 group">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{song.title}</h3>
                            <p className="text-sm text-gray-400 truncate">{song.artist || 'Unknown Artist'}</p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => addSong(song.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                          >
                            <Plus className="h-4 w-4" />
                    </Button>
                        </div>
                      </CardContent>
                    </Card>
                ))}
                </div>
            </TabsContent>
              
              <TabsContent value="queue" className="mt-0">
                <div className="space-y-2">
                  {queue.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No songs in queue</p>
                      <p className="text-sm">Add songs from the Songs tab</p>
                    </div>
                  ) : (
                    queue.map((song, i) => (
                      <Card key={`${song.id}-${i}`} className={`bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-200 group ${i === currentIdx ? 'ring-2 ring-purple-500 bg-purple-500/20' : ''}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-purple-400">#{i + 1}</span>
                                <h3 className="font-medium text-white truncate">{song.title}</h3>
                              </div>
                              <p className="text-sm text-gray-400 truncate">{song.artist || 'Unknown Artist'}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {i !== currentIdx && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => setCurrentIdx(i)}
                                  className="bg-green-500/20 hover:bg-green-500/30 text-green-400"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => removeSong(i)}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative">
                    {/* Mobile Menu Button - Only show when sidebar is closed */}
          <Button 
            variant="ghost" 
            className={`md:hidden fixed top-20 left-4 z-50 bg-black/20 backdrop-blur-sm border border-white/10 hover:bg-black/30 transition-all duration-200 ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* Refresh Button */}
          <Button 
            onClick={fetchSongs} 
            disabled={loading} 
            size="icon" 
            variant="ghost" 
            className="fixed top-20 right-4 z-50 bg-black/20 backdrop-blur-sm border border-white/10 hover:bg-white/10"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
      </Button>



                    {/* Player Section */}
          <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-8">
            {!currentSong ? (
              <div className="text-center w-full max-w-md px-4">
                <div className="p-6 md:p-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 mb-6">
                  <Headphones className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-purple-400" />
                  <h2 className="text-xl md:text-2xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Ready to Sing?
                  </h2>
                  <p className="text-gray-400 mb-6 text-sm md:text-base">
                    Select songs from the sidebar and start your karaoke session
                  </p>
                  <div className="flex items-center justify-center gap-3 md:gap-4 text-xs md:text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Mic className="h-3 w-3 md:h-4 md:w-4" />
                      <span>Record</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Music className="h-3 w-3 md:h-4 md:w-4" />
                      <span>Play</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3 md:h-4 md:w-4" />
                      <span>Save</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-4xl space-y-4 md:space-y-8 px-4">
                {/* Song Info */}
                <div className="text-center">
                  <h2 className="text-xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {currentSong.title}
                  </h2>
                  <p className="text-base md:text-lg text-gray-400">{currentSong.artist || 'Unknown Artist'}</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{formatTime(time)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-white/10" />
                </div>

                                {/* Lyrics Display */}
                {lyrics.length > 0 && (
                  <Card className="bg-white/5 backdrop-blur-sm border-white/10 overflow-hidden">
                    <CardContent className="p-4 md:p-8">
                      <div className="text-center space-y-4 md:space-y-6">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg blur-xl"></div>
                          <div className="relative bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 md:p-6 border border-white/10">
                            <p className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4 leading-tight">
                              {currentLyric || "🎤 Ready to sing? 🎤"}
                            </p>
                            <div className="space-y-1 md:space-y-2">
                              {nextLyrics.map((lyric, i) => (
                                <p key={i} className="text-sm md:text-lg text-gray-400 opacity-60">
                                  {lyric}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                                {/* Player Controls */}
                <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                  <CardContent className="p-4 md:p-6">
                    {/* Main Play/Pause Control - Centered and Large */}
                    <div className="flex justify-center mb-4 md:mb-6">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg" 
                        onClick={audioRef.current?.paused ? playAudio : pauseAudio}
                      >
                        {audioRef.current?.paused ? (
                          <Play className="h-8 w-8 md:h-10 md:w-10 fill-white" />
                        ) : (
                          <Pause className="h-8 w-8 md:h-10 md:w-10 fill-white" />
                        )}
                      </Button>
                    </div>

                    {/* Secondary Controls Row */}
                    <div className="flex items-center justify-center gap-3 md:gap-6 mb-4 md:mb-6">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20" 
                        onClick={() => currentIdx < queue.length - 1 && setCurrentIdx(currentIdx + 1)} 
                        disabled={currentIdx >= queue.length - 1}
                      >
                        <SkipForward className="h-5 w-5 md:h-6 md:w-6" />
                      </Button>

                      {/* Volume Control */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20" 
                          onClick={toggleMute}
                        >
                          {isMuted ? <VolumeX className="h-5 w-5 md:h-6 md:w-6" /> : <Volume2 className="h-5 w-5 md:h-6 md:w-6" />}
                        </Button>
                        <div className="hidden md:block">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-20 accent-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Recording Control - Full Width on Mobile */}
                    <div className="flex justify-center">
                      {!recording ? (
                        <Button 
                          onClick={startRec} 
                          variant="ghost" 
                          className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-6 py-3 text-base md:text-lg font-medium"
                        >
                          <Mic className="h-5 w-5" /> 
                          Start Recording
                        </Button>
                      ) : (
                        <Button 
                          onClick={stopRec} 
                          variant="destructive" 
                          className="flex items-center gap-2 animate-pulse px-6 py-3 text-base md:text-lg font-medium"
                        >
                          <StopCircle className="h-5 w-5" /> 
                          Stop Recording
                        </Button>
                      )}
                    </div>

                    {/* Mobile Volume Slider - Only show on mobile */}
                    <div className="md:hidden mt-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">Volume</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="flex-1 accent-purple-500"
                        />
                        <span className="text-xs text-gray-400">{Math.round(volume * 100)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mixing Volume Controls - Only show when recording */}
                {recording && (
                  <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                    <CardContent className="p-4 md:p-6">
                      <div className="space-y-3 md:space-y-4">
                        <h3 className="text-base md:text-lg font-semibold text-center text-purple-400">Mixing Controls</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          {/* Microphone Volume */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs md:text-sm font-medium text-gray-300">Microphone</label>
                              <span className="text-xs text-gray-400">{Math.round(micVolume * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={micVolume}
                              onChange={(e) => handleMicVolumeChange(parseFloat(e.target.value))}
                              className="w-full accent-red-500"
                            />
                          </div>
                          
                          {/* Music Volume */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs md:text-sm font-medium text-gray-300">Background Music</label>
                              <span className="text-xs text-gray-400">{Math.round(musicVolume * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={musicVolume}
                              onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-center text-gray-400">
                          Adjust the balance between your voice and the background music
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recording Download */}
      {recordedUrl && (
                  <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center gap-4">
                        <h3 className="text-lg font-semibold text-green-400">Recording Complete!</h3>
          <audio controls src={recordedUrl} className="w-full" />
                        <div className="flex gap-3">
          <a href={recordedUrl} download="karaoke-recording.webm">
                            <Button variant="outline" className="flex items-center gap-2 border-green-500/30 text-green-400 hover:bg-green-500/20">
                              <Download className="h-4 w-4" /> 
                              Download
            </Button>
          </a>
                          <Button 
                            variant="ghost" 
                            onClick={() => setRecordedUrl(null)}
                            className="text-gray-400 hover:text-white"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
        </div>
      )}
          </div>
    </main>
      </div>
    </div>
  );
}