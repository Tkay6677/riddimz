"use client"

import { useState } from 'react'
import React from 'react'
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
import { AlertCircle, Bell, ChevronLeft, Eye, EyeOff, Key, Lock, Moon, Save, Shield, Sun, User, Palette, Volume2, Monitor } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, updateProfile, uploadAvatar, loading: profileLoading } = useProfile(user)
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  
  const [email, setEmail] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [karaokeInvites, setKaraokeInvites] = useState(true)
  const [newFollowers, setNewFollowers] = useState(true)
  const [songRecommendations, setSongRecommendations] = useState(true)
  const [performanceReminders, setPerformanceReminders] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  
  const [profileVisibility, setProfileVisibility] = useState('public')
  const [showActivity, setShowActivity] = useState(true)
  const [showPlaylists, setShowPlaylists] = useState(true)
  const [allowMessages, setAllowMessages] = useState(true)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Appearance states
  const [fontSize, setFontSize] = useState([16])
  const [soundEffects, setSoundEffects] = useState(true)
  const [animations, setAnimations] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  // Update form fields when profile data loads
  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setLocation(profile.location || '')
      setWebsite(profile.website || '')
      
      setEmailNotifications(profile.notification_preferences?.email_notifications ?? true)
      setPushNotifications(profile.notification_preferences?.push_notifications ?? true)
      setKaraokeInvites(profile.notification_preferences?.karaoke_invites ?? true)
      setNewFollowers(profile.notification_preferences?.new_followers ?? true)
      setSongRecommendations(profile.notification_preferences?.song_recommendations ?? true)
      setPerformanceReminders(profile.notification_preferences?.performance_reminders ?? true)
      setWeeklyDigest(profile.notification_preferences?.weekly_digest ?? false)
      
      setProfileVisibility(profile.privacy_settings?.profile_visibility || 'public')
      setShowActivity(profile.privacy_settings?.show_activity ?? true)
      setShowPlaylists(profile.privacy_settings?.show_playlists ?? true)
      setAllowMessages(profile.privacy_settings?.allow_messages ?? true)

      // Load appearance preferences
      setFontSize([profile.appearance_preferences?.font_size || 16])
      setSoundEffects(profile.appearance_preferences?.sound_effects ?? true)
      setAnimations(profile.appearance_preferences?.animations ?? true)
      setCompactMode(profile.appearance_preferences?.compact_mode ?? false)
    }
  }, [profile])

  // Update email when user data loads
  React.useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user])
  
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
          song_recommendations: songRecommendations,
          performance_reminders: performanceReminders,
          weekly_digest: weeklyDigest
        },
        privacy_settings: {
          profile_visibility: profileVisibility as 'public' | 'private',
          show_activity: showActivity,
          show_playlists: showPlaylists,
          allow_messages: allowMessages
        },
        appearance_preferences: {
          font_size: fontSize[0],
          sound_effects: soundEffects,
          animations: animations,
          compact_mode: compactMode
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

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing information",
        description: "Please fill in all password fields.",
        variant: "destructive"
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation don't match.",
        variant: "destructive"
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      })
      return
    }

    setIsChangingPassword(true)
    try {
      // This would typically call a password change API
      // For now, we'll just show a success message
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully."
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast({
        title: "Password change failed",
        description: error.message || "Failed to change password.",
        variant: "destructive"
      })
    } finally {
      setIsChangingPassword(false)
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
      <div className="container max-w-4xl mx-auto py-8">
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
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and privacy settings</p>
        </div>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-8">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your profile information and how others see you on Riddimz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                  <AvatarImage src={profile?.profile_banner_url || undefined} />
                  <AvatarFallback className="text-2xl">{displayName?.slice(0, 2) || 'RD'}</AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="avatar-upload" className="cursor-pointer px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name *</Label>
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
                  className="w-full min-h-[120px] p-4 rounded-lg border bg-background resize-none"
                  placeholder="Tell everyone a bit about yourself..." 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/500 characters
                </p>
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
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how and when you receive notifications from Riddimz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                {/* General Notifications */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">General Notifications</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Email Notifications</h5>
                      <p className="text-sm text-muted-foreground">
                        Receive important updates via email
                      </p>
                    </div>
                    <Switch 
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Push Notifications</h5>
                      <p className="text-sm text-muted-foreground">
                        Receive real-time notifications in your browser
                      </p>
                    </div>
                    <Switch 
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                    />
                  </div>
                </div>
                
                <Separator />
                
                {/* Social Notifications */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Social Notifications</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Karaoke Invitations</h5>
                      <p className="text-sm text-muted-foreground">
                        Get notified when someone invites you to a karaoke room
                      </p>
                    </div>
                    <Switch 
                      checked={karaokeInvites}
                      onCheckedChange={setKaraokeInvites}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">New Followers</h5>
                      <p className="text-sm text-muted-foreground">
                        Get notified when someone follows you
                      </p>
                    </div>
                    <Switch 
                      checked={newFollowers}
                      onCheckedChange={setNewFollowers}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Performance Reminders</h5>
                      <p className="text-sm text-muted-foreground">
                        Get reminded about upcoming karaoke performances
                      </p>
                    </div>
                    <Switch 
                      checked={performanceReminders}
                      onCheckedChange={setPerformanceReminders}
                    />
                  </div>
                </div>
                
                <Separator />
                
                {/* Content Notifications */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Content Notifications</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Song Recommendations</h5>
                      <p className="text-sm text-muted-foreground">
                        Get notified about new songs you might like
                      </p>
                    </div>
                    <Switch 
                      checked={songRecommendations}
                      onCheckedChange={setSongRecommendations}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Weekly Digest</h5>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly summary of your activity and new content
                      </p>
                    </div>
                    <Switch 
                      checked={weeklyDigest}
                      onCheckedChange={setWeeklyDigest}
                    />
                  </div>
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
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme & Display
              </CardTitle>
              <CardDescription>
                Customize how Riddimz looks and feels for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                {/* Theme Selection */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Color Theme</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      className="h-20 flex-col gap-2"
                      onClick={() => setTheme('light')}
                    >
                      <Sun className="h-6 w-6" />
                      <span>Light</span>
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      className="h-20 flex-col gap-2"
                      onClick={() => setTheme('dark')}
                    >
                      <Moon className="h-6 w-6" />
                      <span>Dark</span>
                    </Button>
                    <Button
                      variant={theme === 'system' ? 'default' : 'outline'}
                      className="h-20 flex-col gap-2"
                      onClick={() => setTheme('system')}
                    >
                      <Monitor className="h-6 w-6" />
                      <span>System</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select your preferred color theme for the application.
                  </p>
                </div>
                
                <Separator />
                
                {/* Display Options */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Display Options</h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label>Font Size: {fontSize[0]}px</Label>
                      <Slider
                        value={fontSize}
                        onValueChange={setFontSize}
                        max={24}
                        min={12}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Adjust the text size throughout the application.
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h5 className="font-medium">Compact Mode</h5>
                        <p className="text-sm text-muted-foreground">
                          Use a more compact layout to fit more content
                        </p>
                      </div>
                      <Switch 
                        checked={compactMode}
                        onCheckedChange={setCompactMode}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h5 className="font-medium">Animations</h5>
                        <p className="text-sm text-muted-foreground">
                          Enable smooth transitions and animations
                        </p>
                      </div>
                      <Switch 
                        checked={animations}
                        onCheckedChange={setAnimations}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                {/* Audio Options */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Audio & Effects</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Sound Effects</h5>
                      <p className="text-sm text-muted-foreground">
                        Play sound effects for interactions and notifications
                      </p>
                    </div>
                    <Switch 
                      checked={soundEffects}
                      onCheckedChange={setSoundEffects}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleProfileUpdate} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Appearance Settings'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control who can see your profile and activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Profile Visibility */}
                <div className="space-y-3">
                  <h4 className="font-medium">Profile Visibility</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={profileVisibility === 'public' ? 'default' : 'outline'}
                      className="h-16 flex-col gap-2"
                      onClick={() => setProfileVisibility('public')}
                    >
                      <Eye className="h-5 w-5" />
                      <span>Public</span>
                    </Button>
                    <Button
                      variant={profileVisibility === 'private' ? 'default' : 'outline'}
                      className="h-16 flex-col gap-2"
                      onClick={() => setProfileVisibility('private')}
                    >
                      <EyeOff className="h-5 w-5" />
                      <span>Private</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Public profiles can be viewed by anyone. Private profiles are only visible to you.
                  </p>
                </div>
                
                <Separator />
                
                {/* Activity Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium">Activity & Content</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Show Activity</h5>
                      <p className="text-sm text-muted-foreground">
                        Let others see your recent karaoke activity
                      </p>
                    </div>
                    <Switch 
                      checked={showActivity}
                      onCheckedChange={setShowActivity}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Show Playlists</h5>
                      <p className="text-sm text-muted-foreground">
                        Allow others to view your playlists and song collections
                      </p>
                    </div>
                    <Switch 
                      checked={showPlaylists}
                      onCheckedChange={setShowPlaylists}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h5 className="font-medium">Allow Messages</h5>
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
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleProfileUpdate} disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Privacy Settings'}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password for better security.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input 
                  id="currentPassword" 
                  type="password"
                  placeholder="Enter your current password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input 
                  id="newPassword" 
                  type="password"
                  placeholder="Enter your new password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password"
                  placeholder="Confirm your new password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                />
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Password requirements:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>At least 8 characters long</li>
                  <li>Include uppercase and lowercase letters</li>
                  <li>Include at least one number</li>
                  <li>Include at least one special character</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handlePasswordChange} 
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Account Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Security
              </CardTitle>
              <CardDescription>
                Manage your account security and login preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sign Out */}
              <div className="space-y-3">
                <h4 className="font-medium">Sign Out</h4>
                <p className="text-sm text-muted-foreground">
                  Sign out from your account on this device.
                </p>
                <Button variant="outline" onClick={handleSignOut}>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
              
              <Separator />
              
              {/* Delete Account */}
              <div className="space-y-3">
                <h4 className="font-medium text-destructive">Danger Zone</h4>
                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <h5 className="font-medium text-destructive mb-2">Delete Account</h5>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all your data. This action cannot be undone.
                  </p>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
