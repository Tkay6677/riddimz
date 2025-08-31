import { useRef, useCallback } from 'react';

interface UseAudioMixingReturn {
  setupAudioMixing: (karaokeAudio: HTMLAudioElement) => Promise<MediaStream>;
  cleanupAudioMixing: () => void;
  setKaraokeVolume: (volume: number) => void;
  setMicVolume: (volume: number) => void;
  isMixingSetup: boolean;
}

export function useAudioMixing(): UseAudioMixingReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const karaokeSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const karaokeGainRef = useRef<GainNode | null>(null);
  const mixerRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const isMixingSetupRef = useRef(false);

  const setupAudioMixing = useCallback(async (karaokeAudio: HTMLAudioElement): Promise<MediaStream> => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      micStreamRef.current = micStream;

      // Create microphone source
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSourceRef.current = micSource;

      // Create karaoke audio source
      const karaokeSource = audioContext.createMediaElementSource(karaokeAudio);
      karaokeSourceRef.current = karaokeSource;

      // Create gain nodes for volume control
      const micGain = audioContext.createGain();
      micGain.gain.value = 0.8; // Default mic volume
      micGainRef.current = micGain;

      const karaokeGain = audioContext.createGain();
      karaokeGain.gain.value = 0.6; // Default karaoke volume
      karaokeGainRef.current = karaokeGain;

      // Create mixer
      const mixer = audioContext.createGain();
      mixer.gain.value = 1.0;
      mixerRef.current = mixer;

      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;

      // Connect the audio graph
      micSource.connect(micGain);
      karaokeSource.connect(karaokeGain);
      
      micGain.connect(mixer);
      karaokeGain.connect(mixer);
      
      mixer.connect(destination);

      isMixingSetupRef.current = true;
      console.log('Audio mixing setup complete');

      return destination.stream;
    } catch (err) {
      console.error('Error setting up audio mixing:', err);
      throw new Error('Failed to setup audio mixing');
    }
  }, []);

  const cleanupAudioMixing = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    micSourceRef.current = null;
    karaokeSourceRef.current = null;
    micGainRef.current = null;
    karaokeGainRef.current = null;
    mixerRef.current = null;
    destinationRef.current = null;
    isMixingSetupRef.current = false;
  }, []);

  const setKaraokeVolume = useCallback((volume: number) => {
    if (karaokeGainRef.current) {
      karaokeGainRef.current.gain.value = Math.max(0, Math.min(1, volume));
    }
  }, []);

  const setMicVolume = useCallback((volume: number) => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = Math.max(0, Math.min(1, volume));
    }
  }, []);

  return {
    setupAudioMixing,
    cleanupAudioMixing,
    setKaraokeVolume,
    setMicVolume,
    isMixingSetup: isMixingSetupRef.current,
  };
} 