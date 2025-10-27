"use client";

import { useCallback, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSupabaseClient } from '@/lib/supabase-client';

const CREATOR_SYMBOL = 'RIDCREATOR';

/**
 * Mint a Riddimz Creator NFT to the connected wallet and expose creator status helpers.
 * Devnet only. Metadata is hosted in Supabase Storage (public) for wallet compatibility.
 */
export function useCreatorUpgrade() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [minting, setMinting] = useState(false);
  const [lastMintAddress, setLastMintAddress] = useState<string | null>(null);
  const inflightRef = useRef(false);

  // Ensure the connected wallet has enough SOL on devnet to pay fees
  const ensureDevnetFunds = useCallback(async () => {
    if (!wallet.publicKey) return;
    try {
      const before = await connection.getBalance(wallet.publicKey);
      console.log('[CreatorUpgrade] Wallet balance before airdrop (lamports):', before);
      const minLamports = 0.2 * LAMPORTS_PER_SOL; // ~0.2 SOL buffer
      if (before < minLamports) {
        console.log('[CreatorUpgrade] Low balance detected, requesting 2 SOL airdrop...');
        const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
        try {
          await connection.confirmTransaction(sig, 'confirmed');
        } catch (confirmErr) {
          console.warn('[CreatorUpgrade] Airdrop confirm warning:', confirmErr);
        }
        // Poll balance until threshold or timeout
        const start = Date.now();
        const timeoutMs = 10_000;
        let after = before;
        while (Date.now() - start < timeoutMs) {
          await new Promise((res) => setTimeout(res, 1000));
          after = await connection.getBalance(wallet.publicKey);
          console.log('[CreatorUpgrade] Wallet balance after airdrop poll (lamports):', after);
          if (after >= minLamports) break;
        }
        if (after < minLamports) {
          console.warn('[CreatorUpgrade] Airdrop did not reach threshold. Consider switching wallet to Devnet and retry.');
        }
      }
    } catch (e) {
      console.warn('Airdrop check failed (non-fatal):', e);
    }
  }, [connection, wallet.publicKey]);

  const findCreatorNft = useCallback(
    async (metaplex: Metaplex) => {
      if (!wallet.publicKey) return null;
      const nfts = await metaplex.nfts().findAllByOwner({ owner: wallet.publicKey });
      const found: any = nfts.find((n: any) => n?.symbol === CREATOR_SYMBOL);
      return found || null;
    },
    [wallet.publicKey]
  );

  const uploadCreatorMetadata = useCallback(async () => {
    const supabase = getSupabaseClient();
    const folder = 'creator-nft';
    const ts = Date.now();

    // Upload image to Supabase Storage
    const imgRes = await fetch('/riddimz-logo.jpg');
    const imgBlob = await imgRes.blob();
    const imgPath = `${folder}/riddimz-logo-${ts}.jpg`;
    const { error: imgErr } = await supabase.storage
      .from('profiles')
      .upload(imgPath, imgBlob, { contentType: 'image/jpeg', upsert: true });
    if (imgErr) throw imgErr;
    const { data: imgUrlData } = supabase.storage.from('profiles').getPublicUrl(imgPath);
    const imageUrl = imgUrlData.publicUrl;

    // Build metadata JSON and upload to Supabase Storage
    const metadata = {
      name: 'Riddimz Creator',
      symbol: CREATOR_SYMBOL,
      description: 'Unlock creator features on Riddimz.',
      image: imageUrl,
      seller_fee_basis_points: 0,
      properties: {
        files: [{ uri: imageUrl, type: 'image/jpeg' }],
        category: 'image',
      },
    };
    const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const jsonPath = `${folder}/metadata-${ts}.json`;
    const { error: jsonErr } = await supabase.storage
      .from('profiles')
      .upload(jsonPath, jsonBlob, { contentType: 'application/json', upsert: true });
    if (jsonErr) throw jsonErr;
    const { data: jsonUrlData } = supabase.storage.from('profiles').getPublicUrl(jsonPath);

    return jsonUrlData.publicUrl;
  }, []);

  const mintCreatorNft = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error('Connect a Solana wallet to mint your Creator NFT.');
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
      // Make sure we have funds on devnet before attempting mint
      await ensureDevnetFunds();

      const currentBalance = await connection.getBalance(wallet.publicKey);
      console.log('[CreatorUpgrade] Balance before mint (lamports):', currentBalance);

      const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet as any));

      const uri = await uploadCreatorMetadata();

      const { nft } = await metaplex.nfts().create({
        uri,
        name: 'Riddimz Creator',
        symbol: CREATOR_SYMBOL, // <= 10 chars to satisfy Token Metadata
        sellerFeeBasisPoints: 0,
        isMutable: true,
      });

      setLastMintAddress(nft.address.toBase58());
      return nft.address.toBase58();
    } catch (err: any) {
      try {
        if (typeof err?.getLogs === 'function') {
          const logs = await err.getLogs(connection);
          console.error('Mint failed RPC logs:', logs);
        }
      } catch {}
      console.error('Mint Creator NFT failed:', err);

      const msg = err?.message || 'Failed to mint Creator NFT';
      // If the transaction was already processed, treat as soft success and verify by reading state
      if (msg.toLowerCase().includes('already been processed')) {
        try {
          const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet as any));
          // Poll for appearance up to 8 seconds
          const start = Date.now();
          const timeoutMs = 8000;
          while (Date.now() - start < timeoutMs) {
            const found = await findCreatorNft(metaplex);
            if (found?.address) {
              const addr = found.address.toBase58 ? found.address.toBase58() : String(found.address);
              setLastMintAddress(addr);
              return addr;
            }
            await new Promise((res) => setTimeout(res, 1000));
          }
        } catch (e) {
          console.warn('Post-error creator check failed:', e);
        }
      }

      if (
        msg.includes('Attempt to debit an account') ||
        msg.toLowerCase().includes('insufficient funds')
      ) {
        throw new Error('Mint failed: your devnet wallet likely has insufficient SOL. Airdrop was attempted automatically; please retry after ensuring your wallet is on Devnet.');
      }
      throw new Error(msg);
    } finally {
      inflightRef.current = false;
      setMinting(false);
    }
  }, [connection, wallet, ensureDevnetFunds, findCreatorNft, uploadCreatorMetadata]);

  const checkIsCreator = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) return false;
    const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet as any));
    const nfts = await metaplex.nfts().findAllByOwner({ owner: wallet.publicKey });
    return nfts.some((n: any) => n?.symbol === CREATOR_SYMBOL);
  }, [connection, wallet]);

  return { mintCreatorNft, checkIsCreator, minting, lastMintAddress };
}