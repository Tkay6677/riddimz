import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeaturedSection } from "@/components/home/featured-section";
import { MusicGrid } from "@/components/home/music-grid";
import { KaraokeRooms } from "@/components/home/karaoke-rooms";
import Link from "next/link";

export const dynamic = 'force-dynamic'
//....
export default function Home() {
  return (
    <div className="container px-4 py-6 max-w-7xl mx-auto">
      <FeaturedSection />
      
      <div className="my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Explore Riddimz</h2>
          <Button variant="outline" asChild>
            <Link href="/discover">View All</Link>
          </Button>
        </div>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="karaoke">Karaoke</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <div className="space-y-8">
              <section>
                <h3 className="text-xl font-semibold mb-4">Top Tracks</h3>
                <MusicGrid limit={4} />
              </section>
              
              <section>
                <h3 className="text-xl font-semibold mb-4">Live Karaoke Rooms</h3>
                <KaraokeRooms limit={3} />
              </section>
            </div>
          </TabsContent>
          
          <TabsContent value="music">
            <div className="space-y-8">
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Trending Now</h3>
                  <Button variant="link" asChild>
                    <Link href="/music?filter=trending">See all</Link>
                  </Button>
                </div>
                <MusicGrid limit={4} filter="trending" />
              </section>
              
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">NFT Exclusives</h3>
                  <Button variant="link" asChild>
                    <Link href="/music?filter=nft">See all</Link>
                  </Button>
                </div>
                <MusicGrid limit={4} filter="nft" />
              </section>
              
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">New Releases</h3>
                  <Button variant="link" asChild>
                    <Link href="/music?filter=new">See all</Link>
                  </Button>
                </div>
                <MusicGrid limit={4} filter="new" />
              </section>
            </div>
          </TabsContent>
          
          <TabsContent value="karaoke">
            <div className="space-y-8">
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Live Now</h3>
                  <Button variant="link" asChild>
                    <Link href="/karaoke?filter=live">See all</Link>
                  </Button>
                </div>
                <KaraokeRooms limit={3} filter="live" />
              </section>
              
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Popular Rooms</h3>
                  <Button variant="link" asChild>
                    <Link href="/karaoke?filter=popular">See all</Link>
                  </Button>
                </div>
                <KaraokeRooms limit={3} filter="popular" />
              </section>
              
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Featured Performances</h3>
                  <Button variant="link" asChild>
                    <Link href="/karaoke?filter=featured">See all</Link>
                  </Button>
                </div>
                <KaraokeRooms limit={3} filter="featured" />
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}