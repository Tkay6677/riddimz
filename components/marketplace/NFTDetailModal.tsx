"use client";

import React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Music, Clock, User, DollarSign } from "lucide-react";

interface NFTDetailItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl?: string | null;
  price?: number;
  currency?: string;
  isListed?: boolean;
  metadataUri?: string | null;
  supply?: number;
  available?: number;
  soldCount?: number;
  sellerWalletAddress?: string;
}

interface NFTDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: NFTDetailItem | null;
  onBuy?: () => void;
}

export function NFTDetailModal({ open, onClose, item, onBuy }: NFTDetailModalProps) {
  if (!item) return null;
  const {
    title,
    artist,
    coverUrl,
    price,
    currency = "SOL",
    isListed,
    metadataUri,
    supply,
    available,
    soldCount,
  } = item;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[360px,1fr]">
          <div className="relative aspect-square md:h-full md:aspect-auto">
            {coverUrl ? (
              <Image src={coverUrl} alt={title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Music className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">{title}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{artist}</span>
              </DialogDescription>
            </DialogHeader>

            {isListed && price !== undefined && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">Price</div>
                    <div className="text-lg font-semibold">{price} {currency}</div>
                  </div>
                </div>
                {onBuy && (
                  <Button onClick={onBuy} className="px-6">Buy Now</Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {typeof supply === 'number' && (
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Supply</div>
                  <div className="font-semibold">{supply}</div>
                </Card>
              )}
              {typeof available === 'number' && (
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Available</div>
                  <div className="font-semibold">{available}</div>
                </Card>
              )}
              {typeof soldCount === 'number' && (
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Sold</div>
                  <div className="font-semibold">{soldCount}</div>
                </Card>
              )}
              {metadataUri && (
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Metadata</div>
                  <a href={metadataUri} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                    {metadataUri}
                  </a>
                </Card>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isListed ? (
                <Badge className="bg-green-500/90 text-white">Listed</Badge>
              ) : (
                <Badge variant="secondary">Unlisted</Badge>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}