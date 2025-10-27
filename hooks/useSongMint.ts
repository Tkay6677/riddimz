"use client";

import { useCallback, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSupabaseClient } from '@/lib/supabase-client';

export interface MintSongParams {
  title: string;
  artist: string;
  description?: string;
  genre?: string;
  audioPath: string; // Supabase storage path for audio
  coverPath?: string; // Supabase storage path for cover image
  royaltyPercent?: number; // e.g. 10 for 10%
}

/**
 * Mint a Song NFT linking to Supabase-hosted audio and cover image.
 * Devnet only. Metadata JSON is uploaded to Supabase Storage with a public URL.
 */
export function useSongMint() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [minting, setMinting] = useState(false);
  const [lastMintAddress, setLastMintAddress] = useState<string | null>(null);
  const [lastMintUri, setLastMintUri] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const ensureDevnetFunds = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const before = await connection.getBalance(wallet.publicKey);
      const minLamports = 0.2 * LAMPORTS_PER_SOL;
      if (before < minLamports) {
        const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
        try { await connection.confirmTransaction(sig, 'confirmed'); } catch {}
        const start = Date.now();
        const timeoutMs = 10_000;
        let after = before;
        while (Date.now() - start < timeoutMs) {
          await new Promise((res) => setTimeout(res, 1000));
          after = await connection.getBalance(wallet.publicKey);
          if (after >= minLamports) break;
        }
      }
    } catch (e) {
      console.warn('Airdrop check failed:', e);
    }
  }, [connection, wallet.publicKey]);

  const uploadSongMetadata = useCallback(async (params: MintSongParams) => {
    const supabase = getSupabaseClient();
    const folder = 'song-nft';
    const ts = Date.now();

    // Resolve public URLs for audio and cover from Supabase Storage
    const audioPublic = supabase.storage.from('karaoke-songs').getPublicUrl(params.audioPath).data.publicUrl;
    const coverPublic = params.coverPath
      ? supabase.storage.from('karaoke-songs').getPublicUrl(params.coverPath).data.publicUrl
      : undefined;

    // Upload a fallback image if no cover provided
    const imageUrl = coverPublic || (await (async () => {
      const imgRes = await fetch('/riddimz-logo.jpg');
      const imgBlob = await imgRes.blob();
      const imgPath = `${folder}/fallback-${ts}.jpg`;
      const { error: imgErr } = await supabase.storage
        .from('profiles')
        .upload(imgPath, imgBlob, { contentType: 'image/jpeg', upsert: true });
      if (imgErr) throw imgErr;
      return supabase.storage.from('profiles').getPublicUrl(imgPath).data.publicUrl;
    })());

    const royaltyBps = params.royaltyPercent ? Math.max(0, Math.min(10000, Math.round(params.royaltyPercent * 100))) : 0;

    const metadata = {
      name: params.title,
      symbol: 'RIDSONG', // <= 10 chars
      description: params.description || `Song by ${params.artist}`,
      image: imageUrl,
      seller_fee_basis_points: royaltyBps,
      attributes: [
        { trait_type: 'artist', value: params.artist },
        ...(params.genre ? [{ trait_type: 'genre', value: params.genre }] : []),
      ],
      properties: {
        category: 'audio',
        files: [
          ...(audioPublic ? [{ uri: audioPublic, type: 'audio/mpeg' }] : []),
          ...(imageUrl ? [{ uri: imageUrl, type: 'image/jpeg' }] : []),
        ],
      },
    };

    const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const jsonPath = `${folder}/metadata-${ts}.json`;
    const { error: jsonErr } = await supabase.storage
      .from('profiles')
      .upload(jsonPath, jsonBlob, { contentType: 'application/json', upsert: true });
    if (jsonErr) throw jsonErr;
    return supabase.storage.from('profiles').getPublicUrl(jsonPath).data.publicUrl;
  }, []);

  const mintSongNft = useCallback(async (params: MintSongParams) => {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error('Connect a Solana wallet to mint the song NFT.');
    }
    if (!wallet.signTransaction) {
      throw new Error('Your wallet does not support transaction signing.');
    }
    if (inflightRef.current) {
      throw new Error('A mint transaction is already in progress. Please wait.');
    }

    inflightRef.current = true;
    setMinting(true);
    try {
      await ensureDevnetFunds();

      const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet as any));
      const uri = await uploadSongMetadata(params);

      const royaltyBps = params.royaltyPercent ? Math.max(0, Math.min(10000, Math.round(params.royaltyPercent * 100))) : 0;

      const { nft } = await metaplex.nfts().create({
        uri,
        name: params.title,
        symbol: 'RIDSONG',
        sellerFeeBasisPoints: royaltyBps,
        isMutable: true,
      });

      const addr = nft.address.toBase58();
      setLastMintAddress(addr);
      setLastMintUri(uri);
      return { address: addr, uri };
    } catch (err: any) {
      console.error('Mint Song NFT failed:', err);
      const msg = err?.message || 'Failed to mint Song NFT';
      if (
        msg.includes('Attempt to debit an account') ||
        msg.toLowerCase().includes('insufficient funds')
      ) {
        throw new Error('Mint failed: devnet wallet likely has insufficient SOL. An airdrop was attempted automatically; please retry on Devnet.');
      }
      throw new Error(msg);
    } finally {
      inflightRef.current = false;
      setMinting(false);
    }
  }, [connection, wallet, ensureDevnetFunds, uploadSongMetadata]);

  return { mintSongNft, minting, lastMintAddress, lastMintUri };
}