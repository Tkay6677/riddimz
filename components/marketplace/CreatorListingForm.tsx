"use client";

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSupabaseClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletConnect } from '@/components/wallet/wallet-connect'
import { useSongMint } from '@/hooks/useSongMint'
import { useSearchParams } from 'next/navigation'
import { useConnection } from '@solana/wallet-adapter-react'
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js'
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js'
import { createApproveInstruction, getAssociatedTokenAddress } from '@solana/spl-token'

type UserSong = {
  id: string
  title: string
  artist: string
  audio_url: string
  cover_url?: string | null
  is_nft?: boolean | null
  nft_metadata_uri?: string | null
}

type Props = {
  onListed?: () => void
}

export default function CreatorListingForm({ onListed }: Props) {
  const { user, loading } = useAuth()
  const supabase = useMemo(() => getSupabaseClient(), [])
  const wallet = useWallet()
  const { mintSongNft, minting } = useSongMint()
  const searchParams = useSearchParams()
  const { connection } = useConnection()

  const [songs, setSongs] = useState<UserSong[]>([])
  const [selectedSongId, setSelectedSongId] = useState<string>('')
  const [supply, setSupply] = useState<number>(1)
  const [priceSol, setPriceSol] = useState<number>(0.1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('id, title, artist, audio_url, cover_url, is_nft, nft_metadata_uri')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (!mounted) return
        setSongs((data || []) as any)
        const metaFromQuery = searchParams?.get('metadataUri') || undefined
        if (metaFromQuery) {
          const match = (data || []).find((s: any) => s.nft_metadata_uri === metaFromQuery)
          if (match) {
            setSelectedSongId(match.id)
          } else if ((data || []).length > 0) {
            setSelectedSongId((data as any)[0].id)
          }
        } else if ((data || []).length > 0) {
          setSelectedSongId((data as any)[0].id)
        }
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load your songs')
      }
    })()
    return () => { mounted = false }
  }, [supabase, user, searchParams])

  const selectedSong = songs.find(s => s.id === selectedSongId) || null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!user) { setError('Sign in required'); return }
    if (!wallet.connected || !wallet.publicKey) { setError('Connect your wallet'); return }
    if (!selectedSong) { setError('Select a song'); return }
    if (supply <= 0) { setError('Supply must be positive'); return }
    if (priceSol <= 0) { setError('Price must be positive'); return }

    setSubmitting(true)
    try {
      // Build or reuse metadata URI (without minting)
      let metadataUri: string | undefined = selectedSong.nft_metadata_uri || undefined
      if (!metadataUri) {
        // Convert relative paths to absolute URLs for metadata
        const coverUrl = selectedSong.cover_url ? 
          (selectedSong.cover_url.startsWith('http') ? 
            selectedSong.cover_url : 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${selectedSong.cover_url}`
          ) : undefined
        const audioUrl = selectedSong.audio_url ? 
          (selectedSong.audio_url.startsWith('http') ? 
            selectedSong.audio_url : 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${selectedSong.audio_url}`
          ) : undefined

        const meta = {
          name: selectedSong.title,
          symbol: 'RIDSONG',
          description: `${selectedSong.title} — ${selectedSong.artist}`,
          image: coverUrl,
          attributes: [
            { trait_type: 'Artist', value: selectedSong.artist },
            { trait_type: 'Platform', value: 'Riddimz' },
          ],
          properties: {
            files: [
              ...(audioUrl ? [{ uri: audioUrl, type: 'audio/mpeg' }] : []),
              ...(coverUrl ? [{ uri: coverUrl, type: 'image/jpeg' }] : []),
            ],
            category: 'audio',
          },
        }
        const blob = new Blob([JSON.stringify(meta)], { type: 'application/json' })
        const ts = Date.now()
        const path = `nft-metadata/${user.id}/${selectedSong.id}/metadata-${ts}.json`
        const { error: upErr } = await supabase.storage
          .from('profiles')
          .upload(path, blob, { contentType: 'application/json', upsert: true })
        if (upErr) throw upErr
        metadataUri = supabase.storage.from('profiles').getPublicUrl(path).data.publicUrl
      }

      // Mark song row as NFT and store primary metadata
      try {
        await supabase
          .from('songs')
          .update({
            is_nft: true,
            nft_metadata_uri: metadataUri || selectedSong.nft_metadata_uri || null,
          })
          .eq('id', selectedSong.id)
      } catch (e) {
        console.warn('Failed to update song NFT flags:', e)
      }

      // Ensure creator wallet has some devnet SOL
      try {
        const bal = await connection.getBalance(wallet.publicKey!)
        if (bal < 0.2 * LAMPORTS_PER_SOL) {
          const sig = await connection.requestAirdrop(wallet.publicKey!, 2 * LAMPORTS_PER_SOL)
          try { await connection.confirmTransaction(sig, 'confirmed') } catch {}
        }
      } catch {}

      // Pre-mint supply to the creator's wallet (mint authority = creator)
      const mx = Metaplex.make(connection).use(walletAdapterIdentity(wallet as any))
      const inventoryMints: string[] = []
      let collectionMint: string | undefined = undefined

      if (supply > 1) {
        // Create collection NFT for multi-supply listings
        // Convert relative paths to absolute URLs for collection metadata
        const collectionCoverUrl = selectedSong.cover_url ? 
          (selectedSong.cover_url.startsWith('http') ? 
            selectedSong.cover_url : 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${selectedSong.cover_url}`
          ) : undefined

        const collectionMetadata = {
          name: `${selectedSong.title} Collection`,
          symbol: 'RIDCOL',
          description: `Collection for ${selectedSong.title} by ${selectedSong.artist} on Riddimz`,
          image: collectionCoverUrl,
          attributes: [
            { trait_type: 'Artist', value: selectedSong.artist },
            { trait_type: 'Platform', value: 'Riddimz' },
            { trait_type: 'Type', value: 'Collection' },
          ],
          properties: {
            files: [
              ...(collectionCoverUrl ? [{ uri: collectionCoverUrl, type: 'image/jpeg' }] : []),
            ],
            category: 'audio',
          },
        }

        const collectionBlob = new Blob([JSON.stringify(collectionMetadata)], { type: 'application/json' })
        const collectionTs = Date.now()
        const collectionPath = `nft-metadata/${user.id}/${selectedSong.id}/collection-${collectionTs}.json`
        const { error: collectionUpErr } = await supabase.storage
          .from('profiles')
          .upload(collectionPath, collectionBlob, { contentType: 'application/json', upsert: true })
        if (collectionUpErr) throw collectionUpErr
        const collectionUri = supabase.storage.from('profiles').getPublicUrl(collectionPath).data.publicUrl

        const collectionNft = await mx.nfts().create({
          uri: collectionUri,
          name: collectionMetadata.name,
          symbol: 'RIDCOL',
          sellerFeeBasisPoints: 0,
          isMutable: true,
          tokenOwner: wallet.publicKey!,
          isCollection: true,
        })
        
        collectionMint = collectionNft.nft?.address?.toBase58?.() || collectionNft.mintAddress?.toBase58?.() || collectionNft.mintAddress?.toString?.() || ''
        if (!collectionMint) throw new Error('Failed to create collection NFT')
      }

      // Mint individual items (as collection items if supply > 1)
      for (let i = 0; i < supply; i++) {
        const itemName = supply > 1 ? `${selectedSong.title} #${i + 1}` : selectedSong.title
        const createParams: any = {
          uri: metadataUri!,
          name: itemName,
          symbol: 'RIDSONG',
          sellerFeeBasisPoints: 500,
          isMutable: true,
          tokenOwner: wallet.publicKey!,
        }

        // If this is part of a collection, add collection info
        if (collectionMint) {
          createParams.collection = new PublicKey(collectionMint)
        }

        const created = await mx.nfts().create(createParams)
        const addr = created.nft?.address?.toBase58?.() || created.mintAddress?.toBase58?.() || created.mintAddress?.toString?.() || ''
        if (!addr) throw new Error('Failed to obtain mint address for inventory item')
        inventoryMints.push(addr)

        // Approve marketplace delegate to transfer this NFT upon sale
        const delegatePub = process.env.NEXT_PUBLIC_MARKETPLACE_DELEGATE_PUBLIC_KEY
        if (!delegatePub) throw new Error('Marketplace delegate not configured (NEXT_PUBLIC_MARKETPLACE_DELEGATE_PUBLIC_KEY)')
        const delegateKey = new PublicKey(delegatePub)
        const ata = await getAssociatedTokenAddress(new PublicKey(addr), wallet.publicKey!)
        const approveIx = createApproveInstruction(ata, delegateKey, wallet.publicKey!, 1)
        const tx = new Transaction().add(approveIx)
        const sig = await wallet.sendTransaction(tx, connection)
        try { await connection.confirmTransaction(sig, 'confirmed') } catch {}
      }

      // Create listing with inventory mints
      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: selectedSong.id,
          priceSol,
          supply,
          inventoryMintAddresses: inventoryMints,
          collectionMintAddress: collectionMint,
          metadataUri,
          title: selectedSong.title,
          artist: selectedSong.artist,
          sellerWalletAddress: wallet.publicKey.toBase58(),
        })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to create listing')
      }

      setSupply(1)
      setPriceSol(0.1)
      if (onListed) onListed()
    } catch (e: any) {
      setError(e?.message || 'Failed to mint & list')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return null
  }
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Creator Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Sign in to mint and list your NFTs.</div>
        </CardContent>
      </Card>
    )
  }

  if (!wallet.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Creator Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-sm text-muted-foreground">Connect your wallet to mint and list.</div>
          <WalletConnect />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mint & List NFT</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Song</Label>
            <Select value={selectedSongId} onValueChange={(v) => setSelectedSongId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select one of your uploaded songs" />
              </SelectTrigger>
              <SelectContent>
                {songs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title} — {s.artist}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Supply (editions)</Label>
              <Input type="number" min={1} value={supply} onChange={(e) => setSupply(Number(e.target.value))} />
            </div>
            <div>
              <Label>Price (SOL)</Label>
              <Input type="number" min={0.0001} step={0.0001} value={priceSol} onChange={(e) => setPriceSol(Number(e.target.value))} />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating Listing…' : 'Create Listing'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}