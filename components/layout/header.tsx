"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Menu, X, Bell, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { WalletConnect } from '@/components/wallet/wallet-connect'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { profile } = useProfile(user)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Track scroll for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header 
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        isScrolled ? "bg-background/95 backdrop-blur-md border-b" : "bg-transparent"
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Mobile menu button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Search bar */}
        <div className="hidden md:flex relative w-full max-w-md mx-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search for songs, artists or rooms..." 
            className="pl-10 bg-secondary"
          />
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          {/*<Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
          </Button>*/}
          
          

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={profile?.profile_banner_url} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/profile" className="w-full">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/dashboard" className="w-full">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/settings" className="w-full">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer" disabled={isLoggingOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Signing out...' : 'Log out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background border-b pb-4 px-4">
          <div className="relative w-full mb-4 mt-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search for songs, artists or rooms..." 
              className="pl-10 bg-secondary"
            />
          </div>
          <nav className="flex flex-col space-y-2">
            <div>
              <h3 className="text-xs font-medium px-3 mb-2 text-muted-foreground">MAIN</h3>
              <Link 
                href="/discover" 
                className={cn(
                  "px-3 py-2 rounded-md flex items-center",
                  pathname === "/discover" || pathname === "/" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                </svg>
                Discover
              </Link>
              <Link 
                href="/library" 
                className={cn(
                  "px-3 py-2 rounded-md flex items-center",
                  pathname === "/library" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                Library
              </Link>
            </div>
            
            <div className="pt-2">
              <h3 className="text-xs font-medium px-3 mb-2 text-muted-foreground">CATEGORIES</h3>
              <Link 
                href="/music" 
                className={cn(
                  "px-3 py-2 rounded-md flex items-center",
                  pathname === "/music" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                Music
              </Link>
              <Link 
                href="/karaoke" 
                className={cn(
                  "px-3 py-2 rounded-md flex items-center",
                  pathname === "/karaoke" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                Karaoke
              </Link>
            </div>
            
            <div className="pt-2">
              <h3 className="text-xs font-medium px-3 mb-2 text-muted-foreground">YOUR CONTENT</h3>
              <Link 
                href="/profile" 
                className={cn(
                  "px-3 py-2 rounded-md flex items-center",
                  pathname === "/profile" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
              <Link 
                href="/dashboard" 
                className={cn(
                  "px-3 py-2 rounded-md flex items-center",
                  pathname === "/dashboard" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                </svg>
                Dashboard
              </Link>
            </div>
            
            <div className="pt-4 border-t">
              <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-3 py-2 rounded-md text-foreground hover:bg-secondary flex items-center disabled:opacity-50 w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Signing out...' : 'Log out'}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Header