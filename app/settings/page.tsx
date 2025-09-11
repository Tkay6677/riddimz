"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertCircle, Bell, ChevronLeft, Eye, EyeOff, Key, Lock, Moon, Save, Shield, Sun, User } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { useTheme } from 'next-themes'

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, updateProfile, uploadAvatar, loading: profileLoading } = useProfile(user)
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [website, setWebsite] = useState(profile?.website || '')
  
  const [email, setEmail] = useState(user?.email || '')
  const [emailNotifications, setEmailNotifications] = useState(profile?.notification_preferences?.email_notifications ?? true)
  const [pushNotifications, setPushNotifications] = useState(profile?.notification_preferences?.push_notifications ?? true)
  const [karaokeInvites, setKaraokeInvites] = useState(profile?.notification_preferences?.karaoke_invites ?? true)
  const [newFollowers, setNewFollowers] = useState(profile?.notification_preferences?.new_followers ?? true)
  const [songRecommendations, setSongRecommendations] = useState(profile?.notification_preferences?.song_recommendations ?? true)
  
  const [profileVisibility, setProfileVisibility] = useState(profile?.privacy_settings?.profile_visibility || 'public')
  const [showActivity, setShowActivity] = useState(profile?.privacy_settings?.show_activity ?? true)
  const [showPlaylists, setShowPlaylists] = useState(profile?.privacy_settings?.show_playlists ?? true)
  const [allowMessages, setAllowMessages] = useState(profile?.privacy_settings?.allow_messages ?? true)
  
  const [isUpdating, setIsUpdating] = useState(false)

  const handleProfileUpdate = async () => {
    if (!user) return
    
    setIsUpdating(true)
    try {
      await updateProfile({
        display_name: displayName,
        bio,
        location,
        website,
        notification_preferences: {
          email_notifications: emailNotifications,
          push_notifications: pushNotifications,
          karaoke_invites: karaokeInvites,
          new_followers: newFollowers,
          song_recommendations: songRecommendations
        },
        privacy_settings: {
          profile_visibility: profileVisibility as 'public' | 'private',
          show_activity: showActivity,
          show_playlists: showPlaylists,
          allow_messages: allowMessages
        }
      })
      
      toast({
        title: "Settings updated",
        description: "Your profile settings have been saved successfully."
      })
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile settings.",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    
    setIsUpdating(true)
    try {
      await uploadAvatar(file)
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully."
      })
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload avatar.",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message || "There was a problem signing out.",
        variant: "destructive"
      })
    }
  }

  if (authLoading || profileLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-8">
        <div className="w-full h-64 flex items-center justify-center">
          <p className="text-lg text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login?redirect=/settings')
    return null
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-8">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Sun className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information and how others see you on Riddimz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center space-y-3">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.profile_banner_url || undefined} />
                  <AvatarFallback>{displayName?.slice(0, 2) || 'RD'}</AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="avatar-upload" className="cursor-pointer px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-sm font-medium">
                    Change Profile Picture
                  </Label>
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarUpload}
                  />
                </div>
              </div>
              
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input 
                  id="displayName" 
                  placeholder="Your display name" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">
                  This will be your display name for performances and rooms.
                </p>
              </div>
              
              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input 
                  id="location" 
                  placeholder="Your location (optional)" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                />
              </div>
              
              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input 
                  id="website" 
                  placeholder="Your website or portfolio (optional)" 
                  value={website} 
                  onChange={(e) => setWebsite(e.target.value)} 
                />
              </div>
              
              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea 
                  id="bio" 
                  className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                  placeholder="Tell everyone a bit about yourself..." 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                />
              </div>
              
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  placeholder="Your email address" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  disabled
                />
                <p className="text-xs text-muted-foreground flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Email address cannot be changed here. Contact support for assistance.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => router.push('/profile')}>
                View Profile
              </Button>
              <Button onClick={handleProfileUpdate} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications from Riddimz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Email Notifications */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive important updates via email
                    </p>
                  </div>
                  <Switch 
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                
                <Separator />
                
                {/* Push Notifications */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Push Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive real-time notifications in your browser
                    </p>
                  </div>
                  <Switch 
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
                
                <Separator />
                
                {/* Karaoke Invites */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Karaoke Invitations</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone invites you to a karaoke room
                    </p>
                  </div>
                  <Switch 
                    checked={karaokeInvites}
                    onCheckedChange={setKaraokeInvites}
                  />
                </div>
                
                <Separator />
                
                {/* New Followers */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">New Followers</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone follows you
                    </p>
                  </div>
                  <Switch 
                    checked={newFollowers}
                    onCheckedChange={setNewFollowers}
                  />
                </div>
                
                <Separator />
                
                {/* Song Recommendations */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Song Recommendations</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified about new songs you might like
                    </p>
                  </div>
                  <Switch 
                    checked={songRecommendations}
                    onCheckedChange={setSongRecommendations}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleProfileUpdate} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how Riddimz looks for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Theme Selection */}
                <div className="space-y-4">
                  <h4 className="font-medium">Theme</h4>
                  <div className="flex items-center space-x-4">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setTheme('light')}
                    >
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setTheme('dark')}
                    >
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === 'system' ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => setTheme('system')}
                    >
                      <div className="mr-2 h-4 w-4 flex items-center justify-center">
                        <span className="text-xs">OS</span>
                      </div>
                      System
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select your preferred color theme for the application.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can see your profile and activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Profile Visibility */}
                <div className="space-y-3">
                  <h4 className="font-medium">Profile Visibility</h4>
                  <div className="flex items-center space-x-4">
                    <Button
                      variant={profileVisibility === 'public' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setProfileVisibility('public')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Public
                    </Button>
                    <Button
                      variant={profileVisibility === 'private' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setProfileVisibility('private')}
                    >
                      <EyeOff className="mr-2 h-4 w-4" />
                      Private
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Public profiles can be viewed by anyone. Private profiles are only visible to you.
                  </p>
                </div>
                
                <Separator />
                
                {/* Show Activity */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Show Activity</h4>
                    <p className="text-sm text-muted-foreground">
                      Let others see your recent karaoke activity
                    </p>
                  </div>
                  <Switch 
                    checked={showActivity}
                    onCheckedChange={setShowActivity}
                  />
                </div>
                
                <Separator />
                
                {/* Show Playlists */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Show Playlists</h4>
                    <p className="text-sm text-muted-foreground">
                      Allow others to view your playlists and song collections
                    </p>
                  </div>
                  <Switch 
                    checked={showPlaylists}
                    onCheckedChange={setShowPlaylists}
                  />
                </div>
                
                <Separator />
                
                {/* Allow Messages */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Allow Messages</h4>
                    <p className="text-sm text-muted-foreground">
                      Let other users send you direct messages
                    </p>
                  </div>
                  <Switch 
                    checked={allowMessages}
                    onCheckedChange={setAllowMessages}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleProfileUpdate} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Privacy Settings'}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>
                Manage your account security and login preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sign Out */}
              <div className="space-y-2">
                <h4 className="font-medium">Sign Out</h4>
                <p className="text-sm text-muted-foreground">
                  Sign out from your account on this device.
                </p>
                <Button variant="outline" className="mt-2" onClick={handleSignOut}>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
              
              <Separator />
              
              {/* Delete Account */}
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">Delete Account</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all your data. This action cannot be undone.
                </p>
                <Button variant="destructive" className="mt-2">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
