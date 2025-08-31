import { Button } from "@/components/ui/button"
import { Music, PartyPopper, Rocket, Coffee, Bug } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10">
      <div className="text-center space-y-8 p-8 max-w-2xl">
        <div className="space-y-4">
          <h1 className="text-9xl font-bold text-primary animate-bounce">404</h1>
          <h2 className="text-4xl font-bold">Oops! This page is taking a coffee break ☕</h2>
          <p className="text-xl text-muted-foreground">
            Looks like our developers are still jamming to some sick beats while building this page.
          </p>
        </div>

        <div className="flex justify-center space-x-4 text-4xl animate-pulse">
          <Music className="text-purple-500" />
          <PartyPopper className="text-pink-500" />
          <Rocket className="text-orange-500" />
          <Coffee className="text-yellow-500" />
          <Bug className="text-red-500" />
        </div>

        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            While you wait, why not check out our other awesome features?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              variant="outline" 
              size="lg"
              className="animate-float"
              asChild
            >
              <Link href="/music">
                <Music className="mr-2 h-5 w-5" />
                Discover Music
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="animate-float-delayed"
              asChild
            >
              <Link href="/karaoke">
                <PartyPopper className="mr-2 h-5 w-5" />
                Join Karaoke
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="animate-float-more-delayed"
              asChild
            >
              <Link href="/">
                <Rocket className="mr-2 h-5 w-5" />
                Go Home
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-background/50 rounded-lg backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            P.S. Our developers promise they&apos;re not just playing video games... 
            <br />
            They&apos;re &ldquo;researching user experience&rdquo; 😉
          </p>
        </div>
      </div>
    </div>
  )
} 