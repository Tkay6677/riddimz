'use client';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeaturedSection } from "@/components/home/featured-section";
import { MusicGrid } from "@/components/home/music-grid";
import { KaraokeRooms } from "@/components/home/karaoke-rooms";
import Link from "next/link";
import { Music } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic'
//....
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  if (!loading && !user) {
    if (typeof window !== 'undefined') {
      router.replace('/auth/login');
    }
    return null;
  }

  if (loading) return null;

  return (
    <div className="container px-4 py-6 max-w-7xl mx-auto">
      <FeaturedSection />
      
      <div className="my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Explore Riddimz</h2>
          {/* Disabled discover link - temporarily hidden */}
          {/* <Button variant="outline" asChild>
            <Link href="/discover">View All</Link>
          </Button> */}
        </div>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            {/* Disabled music and karaoke tabs - temporarily hidden */}
            {/* <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="karaoke">Karaoke</TabsTrigger> */}
          </TabsList>
          
          <TabsContent value="all">
            <div className="space-y-8">
              <section>
                <h3 className="text-xl font-semibold mb-4">Welcome to Riddimz</h3>
                <div className="text-center py-8">
                  <p className="text-lg text-muted-foreground mb-4">
                    We have temporary disabled the karaoke feature as to fine tune the platform 
                    Riddimz is leveling up! Expect new tool, smoother experience, and exclusives drops coming your way soon.
                    Thanks for your patience!</p>
                  <p className="text-muted-foreground">
                    Stay tuned for an amazing karaoke experience!
                  </p>
                </div>
              </section>
            </div>
          </TabsContent>
          
          {/* Disabled music and karaoke tab content - temporarily hidden */}
          {/* <TabsContent value="music">
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
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Quick Karaoke</h3>
                  <Button variant="link" asChild>
                    <Link href="/karaoke/quick">Try Quick Karaoke</Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <Link href="/karaoke/quick" className="group relative rounded-lg overflow-hidden border bg-card p-4 hover:shadow-lg transition-shadow flex items-center justify-center space-x-2">
                    <Music className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Quick Karaoke</span>
                  </Link>
                </div>
              </section>
            </div>
          </TabsContent> */}
        </Tabs>
      </div>
    </div>
  );
}