import { NextResponse } from 'next/server'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js'
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getParsedTransactionWithRetry(
  conn: Connection,
  signature: string,
  tries = 10,
  delayMs = 1000
) {
  for (let i = 0; i < tries; i++) {
    const tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 })
    if (tx) return tx
    await wait(delayMs)
  }
  return null
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Use RLS-friendly server client; RPC is SECURITY DEFINER and EXECUTE granted to anon/authenticated
    const supabase = createRouteHandlerClient({ cookies })

    const body = await request.json()
    const signature: string | undefined = body?.signature
    const buyerWalletAddress: string | undefined = body?.buyer_wallet_address

    if (!signature || !buyerWalletAddress) {
      return NextResponse.json({ error: 'Missing signature or buyer_wallet_address' }, { status: 400 })
    }

    // Load listing details
    const { data: listing, error: listErr } = await supabase
      .from('marketplace_listings')
      .select('id, price_sol, supply, minted_addresses, seller_wallet_address, active, metadata_uri, title, inventory_mints')
      .eq('id', params.id)
      .maybeSingle()

    if (listErr) throw listErr
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (!listing.active) return NextResponse.json({ error: 'Listing inactive' }, { status: 409 })

    const soldCount = Array.isArray(listing.minted_addresses) ? listing.minted_addresses.length : 0
    if (soldCount >= listing.supply) {
      return NextResponse.json({ error: 'Listing sold out' }, { status: 409 })
    }

    // Verify on-chain payment: transfer from buyer to seller of expected amount
    const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com'
    const conn = new Connection(endpoint)

    // Devnet may take a few seconds to make parsed transactions available
    const tx = await getParsedTransactionWithRetry(conn, signature, 12, 1000)
    if (!tx) {
      // Signal client to retry shortly
      return NextResponse.json({ pending: true, error: 'Transaction not yet available' }, { status: 202 })
    }

    const buyerStr = new PublicKey(buyerWalletAddress).toBase58()
    const sellerStr = new PublicKey(listing.seller_wallet_address).toBase58()
    const expectedLamports = Math.round(Number(listing.price_sol) * LAMPORTS_PER_SOL)

    // Search parsed instructions for a System transfer to seller from buyer of >= expected lamports
    const instructions = tx.transaction.message.instructions || []
    const matches = instructions.filter((ix: any) => {
      const parsed = ix?.parsed
      if (!parsed) return false
      if (parsed?.type !== 'transfer') return false
      const info = parsed?.info || {}
      if (!info?.source || !info?.destination || !info?.lamports) return false
      const source = String(info.source)
      const destination = String(info.destination)
      const lamports = Number(info.lamports)
      return source === buyerStr && destination === sellerStr && lamports >= expectedLamports
    })

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Transfer one pre-minted inventory NFT from seller to buyer using marketplace delegate authority
    const inventory = Array.isArray(listing.inventory_mints) ? listing.inventory_mints : []
    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ error: 'No inventory available' }, { status: 409 })
    }
    const mintAddress = String(inventory[0])
    const delegateSecretRaw = process.env.MARKETPLACE_DELEGATE_SECRET_KEY
    if (!delegateSecretRaw) {
      return NextResponse.json({ error: 'Server missing MARKETPLACE_DELEGATE_SECRET_KEY' }, { status: 500 })
    }
    let delegateWallet: Keypair
    // Support both JSON array (id.json style) and base58-encoded secret keys
    try {
      let secretBytes: Uint8Array | null = null
      try {
        const parsed = JSON.parse(delegateSecretRaw)
        if (Array.isArray(parsed)) {
          secretBytes = Uint8Array.from(parsed as number[])
        }
      } catch {}
      if (!secretBytes) {
        try {
          secretBytes = bs58.decode(delegateSecretRaw)
        } catch (e) {
          return NextResponse.json({ error: 'Invalid MARKETPLACE_DELEGATE_SECRET_KEY: must be JSON array or base58 string' }, { status: 500 })
        }
      }
      if (secretBytes.length !== 64) {
        return NextResponse.json({ error: `Invalid delegate secret length ${secretBytes.length}; expected 64-byte secret key` }, { status: 500 })
      }
      delegateWallet = Keypair.fromSecretKey(secretBytes)
    } catch (e) {
      return NextResponse.json({ error: 'Failed to initialize marketplace delegate wallet' }, { status: 500 })
    }

    // Ensure distribution wallet has funds on devnet
    try {
      const bal = await conn.getBalance(delegateWallet.publicKey)
      if (bal < 0.2 * LAMPORTS_PER_SOL && endpoint.includes('devnet')) {
        const sig = await conn.requestAirdrop(delegateWallet.publicKey, 2 * LAMPORTS_PER_SOL)
        try { await conn.confirmTransaction(sig, 'confirmed') } catch {}
      }
    } catch {}

    // Derive token accounts
    const mintPk = new PublicKey(mintAddress)
    const sellerPk = new PublicKey(listing.seller_wallet_address)
    const buyerPk = new PublicKey(buyerWalletAddress)
    const sellerAta = await getAssociatedTokenAddress(mintPk, sellerPk)
    const buyerAta = await getAssociatedTokenAddress(mintPk, buyerPk)

    // Ensure buyer ATA exists
    const buyerAtaInfo = await conn.getAccountInfo(buyerAta)
    const ixs = [] as any[]
    if (!buyerAtaInfo) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          delegateWallet.publicKey, // payer
          buyerAta, // ata
          buyerPk, // owner
          mintPk, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        )
      )
    }

    // Transfer from seller to buyer using delegate authority (amount 1)
    ixs.push(createTransferInstruction(sellerAta, buyerAta, delegateWallet.publicKey, 1))

    const transferTx = new Transaction().add(...ixs)
    transferTx.feePayer = delegateWallet.publicKey
    const latest = await conn.getLatestBlockhash()
    transferTx.recentBlockhash = latest.blockhash
    const sigTransfer = await conn.sendTransaction(transferTx, [delegateWallet])
    try { await conn.confirmTransaction(sigTransfer, 'confirmed') } catch {}

    // Atomic DB update: append buyer address, deactivate if sold out
    const { data: purchaseRes, error: rpcErr } = await supabase
      .rpc('marketplace_purchase_with_inventory', { listing_id: params.id, buyer_address: buyerStr, consumed_mint: mintAddress })

    if (rpcErr) throw rpcErr

    // Return updated state to client
    const sold_after = Array.isArray(purchaseRes) && purchaseRes[0]?.sold_count != null
      ? purchaseRes[0].sold_count
      : soldCount + 1

    return NextResponse.json({ success: true, mintAddress, soldCount: sold_after, active: purchaseRes?.[0]?.is_active ?? true })
  } catch (error) {
    console.error('Buy route error:', error)
    return NextResponse.json({ error: 'Failed to process purchase' }, { status: 500 })
  }
}