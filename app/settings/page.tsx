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
import { AlertCircle, Bell, ChevronLeft, Key, Lock, Moon, Save, Shield, Sun, User } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { useTheme } from 'next-themes'

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, updateProfile, loading: profileLoading } = useProfile(user)
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()

  const [username, setUsername] = useState(profile?.username || '')
  const [name, setName] = useState(profile?.full_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  
  const [email, setEmail] = useState(user?.email || '')
  const [emailNotifications, setEmailNotifications] = useState(profile?.settings?.email_notifications || true)
  const [songFinishedNotifications, setSongFinishedNotifications] = useState(profile?.settings?.song_finished_notifications || true)
  const [roomInviteNotifications, setRoomInviteNotifications] = useState(profile?.settings?.room_invite_notifications || true)
  
  const [isUpdating, setIsUpdating] = useState(false)

  const handleProfileUpdate = async () => {
    if (!user) return
    
    setIsUpdating(true)
    try {
      await updateProfile({
        username,
        full_name: name,
        bio,
        settings: {
          email_notifications: emailNotifications,
          song_finished_notifications: songFinishedNotifications,
          room_invite_notifications: roomInviteNotifications
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
    
    // This would be replaced with your actual avatar upload logic
    setIsUpdating(true)
    try {
      // Assuming useProfile hook has an uploadAvatar method
      // await uploadAvatar(file)
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
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{username?.slice(0, 2) || 'RD'}</AvatarFallback>
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
              
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  placeholder="Your unique username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">
                  This will be your display name for performances and rooms.
                </p>
              </div>
              
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="Your full name (optional)" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
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
                
                {/* Song Finished Notifications */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Song Performance Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone completes your song
                    </p>
                  </div>
                  <Switch 
                    checked={songFinishedNotifications}
                    onCheckedChange={setSongFinishedNotifications}
                  />
                </div>
                
                <Separator />
                
                {/* Room Invites */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-medium">Room Invitations</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone invites you to a karaoke room
                    </p>
                  </div>
                  <Switch 
                    checked={roomInviteNotifications}
                    onCheckedChange={setRoomInviteNotifications}
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
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and login preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Change Password */}
              <div className="space-y-2">
                <h4 className="font-medium">Change Password</h4>
                <p className="text-sm text-muted-foreground">
                  Update your password to keep your account secure.
                </p>
                <Button variant="outline" className="mt-2" onClick={() => router.push('/auth/reset-password')}>
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </div>
              
              <Separator />
              
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
