"use client";
  
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Music, Mic, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSongMint } from '@/hooks/useSongMint'
import { useWallet } from '@solana/wallet-adapter-react';
import { useCreatorUpgrade } from '@/hooks/useCreatorUpgrade';
import { WalletConnect } from '@/components/wallet/wallet-connect';
import { useAuth } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic'

// Upload password - in production, this should be stored securely
const UPLOAD_PASSWORD = "riddimz2024";

export default function UploadPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [songData, setSongData] = useState({
    title: '',
    artist: '',
    audioFile: null as File | null,
    coverFile: null as File | null,
    lyricsFile: null as File | null,
    isKaraoke: false,
    mintAsNft: false,
    royaltyPercent: 10,
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === UPLOAD_PASSWORD) {
      setPasswordVerified(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'cover' | 'lyrics') => {
    if (e.target.files && e.target.files[0]) {
      setSongData({
        ...songData,
        [`${type}File`]: e.target.files[0],
      });
    }
  };

  const uploadFile = async (file: File, prefix: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
  
    const safeName = file.name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
    const filePath = `${prefix}/${user.id}/${Date.now()}_${safeName}`;
  
    const { data, error } = await supabase.storage
      .from('karaoke-songs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
  
    if (error) throw error;
    return data.path;
  };

  const { mintSongNft, minting, lastMintAddress } = useSongMint()

  // Supabase auth gating
  const { user, loading, signInWithGoogle, signInWithWallet } = useAuth();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songData.audioFile || !songData.title || !songData.artist) return;

    setUploading(true);
    try {
      const audioPath = await uploadFile(
        songData.audioFile,
        songData.isKaraoke ? 'karaoke' : 'songs'
      );

      let coverPath = '';
      if (songData.coverFile) {
        coverPath = await uploadFile(
          songData.coverFile,
          'covers'
        );
      }

      let lyricsPath = '';
      if (songData.lyricsFile && songData.isKaraoke) {
        lyricsPath = await uploadFile(
          songData.lyricsFile,
          'lyrics'
        );
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
  
      // Get audio duration
      const audio = new Audio();
      const duration = await new Promise<number>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(Math.floor(audio.duration));
        });
        audio.src = URL.createObjectURL(songData.audioFile!);
      });
  
      const { data: inserted, error } = await supabase
        .from('songs')
        .insert({
          title: songData.title,
          artist: songData.artist,
          duration: duration,
          audio_url: audioPath,
          cover_url: coverPath || null,
          user_id: user.id,
        })
        .select('id')
        .single();
  
      if (error) throw error;
  
      // Optionally mint as NFT
      if (songData.mintAsNft) {
        try {
          const { address: mintAddr, uri: metadataUri } = await mintSongNft({
            title: songData.title,
            artist: songData.artist,
            audioPath,
            coverPath,
            royaltyPercent: songData.royaltyPercent,
          });
          // Fetch metadata and store image URL as cover_url
          let metadataImage: string | null = null;
          try {
            const res = await fetch(metadataUri);
            if (res.ok) {
              const json = await res.json();
              metadataImage = typeof json?.image === 'string' ? json.image : null;
            }
          } catch {}
          // Mark song as NFT and update cover_url with metadata image if available
          if (inserted?.id) {
            await supabase
              .from('songs')
              .update({ 
                is_nft: true, 
                cover_url: metadataImage || coverPath || null,
                nft_metadata_uri: metadataUri,
                nft_mint_address: mintAddr
              })
              .eq('id', inserted.id);
          }
          console.log('Minted song NFT address:', mintAddr, 'metadata:', metadataUri);
        } catch (mintErr) {
          console.error('Minting song NFT failed:', mintErr);
        }
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Error uploading song:', error);
      alert('Error uploading song. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleKaraokeUpload = async (e: React.FormEvent, data: typeof songData) => {
    e.preventDefault();
    if (!data.audioFile || !data.title || !data.artist) return;
    if (!data.lyricsFile) {
      alert('Lyrics file is required for karaoke tracks');
      return;
    }

    setUploading(true);
    try {
      const audioPath = await uploadFile(
        data.audioFile,
        'karaoke'
      );

      let coverPath = '';
      if (data.coverFile) {
        coverPath = await uploadFile(
          data.coverFile,
          'covers'
        );
      }

      const lyricsPath = await uploadFile(
        data.lyricsFile,
        'lyrics'
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
  
      // Get audio duration
      const audio = new Audio();
      const duration = await new Promise<number>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(Math.floor(audio.duration));
        });
        audio.src = URL.createObjectURL(data.audioFile!);
      });
  
      const { data: inserted, error } = await supabase
        .from('songs')
        .insert({
          title: data.title,
          artist: data.artist,
          duration: duration,
          audio_url: audioPath,
          cover_url: coverPath || null,
          user_id: user.id,
        })
        .select('id')
        .single();
  
      if (error) throw error;
  
      // TODO: optionally insert into karaoke_tracks with parsed lyrics
  
      router.push('/dashboard');
    } catch (error) {
      console.error('Error uploading karaoke track:', error);
      alert('Error uploading karaoke track. Please try again.');
    } finally {
      setUploading(false);
    }
  };




  // Creator NFT gating state
  const wallet = useWallet();
  const { checkIsCreator } = useCreatorUpgrade();
  const [checkingCreator, setCheckingCreator] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [creatorError, setCreatorError] = useState('');

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setCheckingCreator(true);
      setCreatorError('');
      try {
        if (!wallet.connected) {
          setIsCreator(false);
        } else {
          const ok = await checkIsCreator();
          if (mounted) setIsCreator(Boolean(ok));
        }
      } catch (e: any) {
        if (mounted) setCreatorError(e?.message || 'Failed to verify creator status');
      } finally {
        if (mounted) setCheckingCreator(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [wallet.connected, checkIsCreator]);

  // Supabase auth gating screens
  if (loading) {
    return (
      <div className="container max-w-md py-8 mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Checking Authentication</CardTitle>
            <CardDescription>Please wait while we verify your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full h-10" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-8 mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Sign in to your Riddimz account to upload music.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => signInWithGoogle()} className="w-full">Sign in with Google</Button>
            <Button variant="outline" onClick={() => signInWithWallet()} className="w-full">Sign in with Wallet</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Creator NFT gating: wallet connection and creator check
  if (!wallet.connected) {
    return (
      <div className="container max-w-md py-8 mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Connect your Solana wallet to upload music and verify creator status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <WalletConnect />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checkingCreator) {
    return (
      <div className="container max-w-md py-8 mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Checking Creator Status</CardTitle>
            <CardDescription>Please wait while we verify your Creator NFT.</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full h-10" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="container max-w-md py-8 mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Creator NFT Required</CardTitle>
            <CardDescription>
              You need the Riddimz Creator NFT to upload music. Mint it on your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {creatorError && (
              <Alert>
                <AlertDescription>{creatorError}</AlertDescription>
              </Alert>
            )}
            <Button onClick={() => window.location.assign('/profile')} className="w-full">
              Go to Profile to Mint
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Upload Music</h1>
            <p className="text-muted-foreground">Share your music with the community</p>
          </div>

        </div>
      </div>
      
      <Tabs defaultValue="music">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="music" className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Upload Music
          </TabsTrigger>
          <TabsTrigger value="karaoke" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Upload Karaoke Track
          </TabsTrigger>
        </TabsList>

        <TabsContent value="music">
          <Card>
            <CardHeader>
              <CardTitle>Upload Music</CardTitle>
              <CardDescription>Share your music with the world</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-6">
                <div>
                  <Label htmlFor="title">Song Title</Label>
                  <Input
                    id="title"
                    value={songData.title}
                    onChange={(e) => setSongData({ ...songData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="artist">Artist Name</Label>
                  <Input
                    id="artist"
                    value={songData.artist}
                    onChange={(e) => setSongData({ ...songData, artist: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="audio">Audio File</Label>
                  <Input
                    id="audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileChange(e, 'audio')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cover">Cover Image (Optional)</Label>
                  <Input
                    id="cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'cover')}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="mintAsNft"
                    type="checkbox"
                    checked={songData.mintAsNft}
                    onChange={(e) => setSongData({ ...songData, mintAsNft: e.target.checked })}
                  />
                  <Label htmlFor="mintAsNft">Mint as NFT</Label>
                </div>
                {songData.mintAsNft && (
                  <div>
                    <Label htmlFor="royalty">Royalties (%)</Label>
                    <Input
                      id="royalty"
                      type="number"
                      min={0}
                      max={100}
                      value={songData.royaltyPercent}
                      onChange={(e) => setSongData({ ...songData, royaltyPercent: Number(e.target.value) })}
                      placeholder="e.g., 10"
                    />
                  </div>
                )}
                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload Song'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="karaoke">
          <Card>
            <CardHeader>
              <CardTitle>Upload Karaoke Track</CardTitle>
              <CardDescription>Share your karaoke version for others to sing</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                const updatedData = { ...songData, isKaraoke: true };
                setSongData(updatedData);
                handleKaraokeUpload(e, updatedData);
              }} className="space-y-6">
                <div>
                  <Label htmlFor="k-title">Song Title</Label>
                  <Input
                    id="k-title"
                    value={songData.title}
                    onChange={(e) => setSongData({ ...songData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-artist">Original Artist</Label>
                  <Input
                    id="k-artist"
                    value={songData.artist}
                    onChange={(e) => setSongData({ ...songData, artist: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-audio">Karaoke Track</Label>
                  <Input
                    id="k-audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileChange(e, 'audio')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-lyrics">Lyrics File (LRC format)</Label>
                  <Input
                    id="k-lyrics"
                    type="file"
                    accept=".lrc"
                    onChange={(e) => handleFileChange(e, 'lyrics')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-cover">Cover Image (Optional)</Label>
                  <Input
                    id="k-cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'cover')}
                  />
                </div>

                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload Karaoke Track'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}