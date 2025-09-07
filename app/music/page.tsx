"use client"

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MusicGrid } from "@/components/home/music-grid";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = 'force-dynamic'

export default function MusicPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

  return (
    <div className="container px-4 py-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Music</h1>
        <Button variant="outline" asChild>
          <Link href="/upload">Upload Track</Link>
        </Button>
      </div>
      
      <Tabs defaultValue={filter} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="nft">NFT Exclusives</TabsTrigger>
          <TabsTrigger value="new">New Releases</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">All Tracks</h3>
              </div>
              <MusicGrid />
            </section>
          </div>
        </TabsContent>
        
        <TabsContent value="trending">
          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Trending Now</h3>
              </div>
              <MusicGrid filter="trending" />
            </section>
          </div>
        </TabsContent>
        
        <TabsContent value="nft">
          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">NFT Exclusives</h3>
              </div>
              <MusicGrid filter="nft" />
            </section>
          </div>
        </TabsContent>
        
        <TabsContent value="new">
          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">New Releases</h3>
              </div>
              <MusicGrid filter="new" />
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 