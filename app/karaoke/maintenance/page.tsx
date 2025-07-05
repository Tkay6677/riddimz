import { Button } from "@/components/ui/button"
import { 
  Wrench, 
  Music, 
  Mic, 
  Coffee, 
  Construction, 
  Hammer, 
  HardHat, 
  Zap,
  PartyPopper,
  Guitar,
  Headphones,
  Volume2
} from "lucide-react"
import Link from "next/link"

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500/10 via-red-500/10 to-yellow-500/10 relative overflow-hidden">
              <div className="text-center space-y-8 p-8 max-w-2xl relative z-10">
          {/* Construction cones */}
          <div className="absolute -top-8 -left-8 w-16 h-16 bg-orange-500 transform rotate-45 opacity-60"></div>
          <div className="absolute -top-8 -right-8 w-16 h-16 bg-orange-500 transform rotate-45 opacity-60"></div>
          <div className="absolute -bottom-8 -left-8 w-16 h-16 bg-orange-500 transform rotate-45 opacity-60"></div>
          <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-orange-500 transform rotate-45 opacity-60"></div>
          
          {/* Warning signs */}
          <div className="absolute top-4 left-4 bg-yellow-400 text-black px-3 py-1 rounded font-bold text-sm transform -rotate-12">
            🚧 CONSTRUCTION ZONE 🚧
          </div>
          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded font-bold text-sm transform rotate-12">
            ⚠️ NO ENTRY ⚠️
          </div>
        <div className="space-y-4">
          <div className="flex justify-center space-x-4 text-6xl animate-bounce">
            <Wrench className="text-orange-500" />
            <Construction className="text-red-500" />
            <HardHat className="text-yellow-500" />
          </div>
          <h1 className="text-6xl font-bold text-primary">Under Maintenance 🔧</h1>
          <h2 className="text-3xl font-bold">Our Karaoke Room is Getting a Makeover!</h2>
          <p className="text-xl text-muted-foreground">
            Our sound engineers are tuning up the microphones and our developers are debugging the dance moves.
            <br />
            <span className="text-lg">(Translation: We&apos;re fixing some bugs that were singing off-key) 🔧</span>
          </p>
        </div>

        <div className="flex justify-center space-x-4 text-4xl animate-pulse">
          <Music className="text-purple-500" />
          <Mic className="text-pink-500" />
          <Guitar className="text-green-500" />
          <Headphones className="text-blue-500" />
          <Volume2 className="text-orange-500" />
          <PartyPopper className="text-yellow-500" />
        </div>

        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            While we&apos;re working our magic, here are some things you can do:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
            <div className="p-4 bg-background/50 rounded-lg backdrop-blur-sm border border-orange-300/30">
              <Mic className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-sm font-semibold">Try Quick Karaoke</p>
              <p className="text-xs text-muted-foreground">Practice solo while you wait</p>
            </div>
            <div className="p-4 bg-background/50 rounded-lg backdrop-blur-sm">
              <Coffee className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-sm">Practice your vocal warm-ups</p>
            </div>
            <div className="p-4 bg-background/50 rounded-lg backdrop-blur-sm">
              <Zap className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm">Charge your microphone batteries</p>
            </div>
            <div className="p-4 bg-background/50 rounded-lg backdrop-blur-sm">
              <Hammer className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <p className="text-sm">Fix that squeaky chair</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Don&apos;t worry, we&apos;ll be back in harmony soon!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              variant="default" 
              size="lg"
              className="animate-float bg-orange-500 hover:bg-orange-600 text-white"
              asChild
            >
              <Link href="/karaoke/quick">
                <Mic className="mr-2 h-5 w-5" />
                Try Quick Karaoke
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="animate-float-delayed"
              asChild
            >
              <Link href="/music">
                <Music className="mr-2 h-5 w-5" />
                Browse Music Library
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="animate-float-more-delayed"
              asChild
            >
              <Link href="/">
                <PartyPopper className="mr-2 h-5 w-5" />
                Go Home
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 p-6 bg-background/50 rounded-lg backdrop-blur-sm border border-orange-200/20">
          <h3 className="text-lg font-semibold mb-3">🔧 Maintenance Status 🔧</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Microphone Calibration:</span>
              <span className="text-green-500">✓ Complete</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Audio Sync:</span>
              <span className="text-yellow-500">🔄 In Progress</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Dance Floor Polish:</span>
              <span className="text-blue-500">⏳ Scheduled</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pizza Delivery:</span>
              <span className="text-red-500">🚫 Not Included</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Developer Sanity:</span>
              <span className="text-purple-500">🎭 Questionable</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Coffee Supply:</span>
              <span className="text-orange-500">☕ Critical</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic">
            Estimated completion: When the coffee runs out ☕
            <br />
            P.S. Our developers are definitely not having a karaoke party while fixing this... 
            <br />
            (They&apos;re having a very serious debugging session with background music) 🎤
            <br />
            <br />
            <span className="text-yellow-500">⚠️ Emergency Contact:</span> Try singing &quot;Help!&quot; by The Beatles 🔧
          </p>
        </div>

        <div className="text-center space-y-4">
                      <p className="text-sm text-muted-foreground">
              Need immediate assistance? 
              <br />
              Try singing your request - we might hear you through the walls! 🔧
            </p>
          
          <div className="p-4 bg-background/30 rounded-lg border border-dashed border-orange-300/30">
            <h4 className="text-lg font-semibold mb-3">🔧 Test Your Mic (Maintenance Mode) 🔧</h4>
            <p className="text-sm text-muted-foreground mb-3">
              While we&apos;re fixing things, you can practice your karaoke skills here:
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span>🎵 &quot;Bohemian Rhapsody&quot; - Queen</span>
                <span className="text-red-500">(Currently broken)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>🎵 &quot;Sweet Caroline&quot; - Neil Diamond</span>
                <span className="text-yellow-500">(So-so)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>🎵 &quot;Wonderwall&quot; - Oasis</span>
                <span className="text-green-500">(Actually works!)</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Note: This is a joke. Please don&apos;t actually try to sing here. 
              <br />
              (Unless you want to confuse the developers) 😅
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 