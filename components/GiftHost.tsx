"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

type GiftHostProps = {
  recipientAddress?: string | null;
  recipientName?: string;
  connection?: Connection; // optional; will infer from wallet adapter if not provided
  onSuccess?: (signature: string) => void;
  onClose?: () => void;
};

export default function GiftHost(props: GiftHostProps) {
  const { recipientAddress, recipientName, connection: injectedConnection, onSuccess, onClose } = props;
  const { toast } = useToast();
  const { publicKey, sendTransaction, connected, wallet } = useWallet();

  const [amountSol, setAmountSol] = useState<string>("0.1");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedRecipient = useMemo(() => {
    if (!recipientAddress) return null;
    try {
      return new PublicKey(recipientAddress);
    } catch {
      return null;
    }
  }, [recipientAddress]);

  const isReady = connected && !!publicKey && !!parsedRecipient;

  const handleSendGift = async () => {
    setErrorMsg(null);
    if (!parsedRecipient) {
      setErrorMsg("Host wallet address not available");
      return;
    }
    if (!connected || !publicKey || !wallet) {
      setErrorMsg("Connect your wallet to send a tip");
      return;
    }
    let amount = parseFloat(amountSol);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg("Enter a valid amount in SOL");
      return;
    }
    if (amount > 100) {
      setErrorMsg("Amount too large; please tip ≤ 100 SOL");
      return;
    }

    try {
      setSending(true);
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: parsedRecipient, lamports })
      );
      // Prefer wallet-adapter sendTransaction which handles blockhash & signing
      const conn = injectedConnection || new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com");
      const signature = await sendTransaction(tx, conn);
      toast({ title: "Gift sent", description: `Signature: ${signature}` });
      if (onSuccess) onSuccess(signature);
      if (onClose) onClose();
    } catch (e: any) {
      console.error("Gift send error:", e);
      const msg = e?.message || "Failed to send gift";
      setErrorMsg(msg);
      toast({ variant: "destructive", title: "Gift failed", description: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="w-[320px] shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">Send a Gift {recipientName ? `to ${recipientName}` : "to Host"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!parsedRecipient ? (
          <div className="text-sm text-muted-foreground">
            Host wallet not set. Ask the host to sign in with wallet.
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="amountSol">Amount (SOL)</Label>
          <Input
            id="amountSol"
            type="number"
            min="0"
            step="0.01"
            value={amountSol}
            onChange={(e) => setAmountSol(e.target.value)}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Recipient: {recipientAddress ? recipientAddress : "—"}
        </div>

        {!connected ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">Connect wallet to tip</div>
            <WalletMultiButton />
          </div>
        ) : (
          <Button className="w-full" disabled={!isReady || sending} onClick={handleSendGift}>
            {sending ? "Sending..." : "Send Gift"}
          </Button>
        )}

        {errorMsg && (
          <div className="text-xs text-red-500">{errorMsg}</div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </CardContent>
    </Card>
  );
}