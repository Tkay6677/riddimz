"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Home, Music, Mic, Heart, Radio, User, Library, Plus, Crown, Award, Disc } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/mode-toggle'

interface NavItemProps {
  href: string
  icon: LucideIcon
  label: string
  isPro?: boolean
}

const NavItem = ({ href, icon: Icon, label, isPro = false }: NavItemProps) => {
  const pathname = usePathname()
  const isActive = pathname === href
  
  return (
    <Link href={href}>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start mb-1",
          isActive ? "bg-secondary" : "hover:bg-secondary/80"
        )}
      >
        <Icon className="mr-2 h-4 w-4" />
        {label}
        {isPro && (
          <span className="ml-auto bg-gradient-to-r from-yellow-400 to-orange-500 text-xs text-white px-1.5 py-0.5 rounded-sm">
            PRO
          </span>
        )}
      </Button>
    </Link>
  )
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  return (
    <div 
      className={cn(
        "h-screen border-r bg-card transition-all duration-300 hidden md:block",
        isCollapsed ? "w-[70px]" : "w-[240px]"
      )}
    >
      <div className="flex items-center h-16 px-4">
        <Link href="/" className="flex items-center">
          <Music className="h-6 w-6 text-primary mr-2" />
          {!isCollapsed && (
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-purple-600">
              Riddimz
            </span>
          )}
        </Link>
        <Button 
          variant="ghost" 
          size="icon" 
          className="ml-auto" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? "→" : "←"}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-4">
          <div>
            <h3 className={cn(
              "text-xs font-medium px-2 mb-2",
              isCollapsed && "sr-only"
            )}>
              MAIN
            </h3>
            <NavItem href="/" icon={Home} label={isCollapsed ? "" : "Home"} />
            {/* Disabled pages - temporarily hidden */}
          {/* <SidebarItem href="/discover" icon={Compass} label="Discover" /> */}
          {/* <SidebarItem href="/library" icon={Library} label="Library" /> */}
          {/* <SidebarItem href="/music" icon={Music} label="Music" /> */}
          {/* <SidebarItem href="/karaoke" icon={Mic} label="Karaoke" /> */}
          </div>

          {!isCollapsed && <Separator />}
          
          {/* Disabled categories section - temporarily hidden */}
          {/* <div>
            <h3 className={cn(
              "text-xs font-medium px-2 mb-2",
              isCollapsed && "sr-only"
            )}>
              CATEGORIES
            </h3>
            <NavItem href="/music" icon={Music} label={isCollapsed ? "" : "Music"} />
            <NavItem href="/karaoke" icon={Mic} label={isCollapsed ? "" : "Karaoke"} />
            <NavItem href="/albums" icon={Disc} label={isCollapsed ? "" : "Albums"} />
          </div> */}

          {!isCollapsed && <Separator />}
          
          {/* Disabled user content section - temporarily hidden */}
          {/* <div>
            <h3 className={cn(
              "text-xs font-medium px-2 mb-2",
              isCollapsed && "sr-only"
            )}>
              USER CONTENT
            </h3>
            <NavItem href="/upload" icon={Upload} label={isCollapsed ? "" : "Upload"} />
            <NavItem href="/profile" icon={User} label={isCollapsed ? "" : "Profile"} />
            <NavItem href="/settings" icon={Settings} label={isCollapsed ? "" : "Settings"} />
          </div> */}

          {!isCollapsed && <Separator />}
          
          {/* Disabled your content section - temporarily hidden */}
          {/* <div>
            <h3 className={cn(
              "text-xs font-medium px-2 mb-2",
              isCollapsed && "sr-only"
            )}>
              YOUR CONTENT
            </h3>
            <NavItem href="/favorites" icon={Heart} label={isCollapsed ? "" : "Favorites"} />
            <NavItem href="/profile" icon={User} label={isCollapsed ? "" : "Profile"} />
            <NavItem href="/pro" icon={Crown} label={isCollapsed ? "" : "Upgrade to PRO"} isPro={true} />
          </div> */}

          {!isCollapsed && (
            <>
              <Separator />
              {/*<div>
                <h3 className="text-xs font-medium px-2 mb-2">PLAYLISTS</h3>
                <Button variant="ghost" className="w-full justify-start mb-1">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Playlist
                </Button>
                <div className="pl-2 mt-4">
                  <p className="text-sm text-muted-foreground mb-2">My Playlists</p>
                  <ul className="space-y-1">
                    <li className="text-sm hover:text-primary cursor-pointer">Chill Vibes</li>
                    <li className="text-sm hover:text-primary cursor-pointer">Workout Beats</li>
                    <li className="text-sm hover:text-primary cursor-pointer">Party Mix</li>
                    <li className="text-sm hover:text-primary cursor-pointer">Top Karaoke Hits</li>
                  </ul>
                </div>
              </div>*/}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="h-[60px] border-t p-3 flex items-center justify-between">
        <ModeToggle />
        {!isCollapsed && (
          <Link href="/settings">
            <Button variant="ghost" size="sm">Settings</Button>
          </Link>
        )}
      </div>
    </div>
  )
}