"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Edit2, User, Music, Mic, Award, Settings, 
  Save, X, Upload, Calendar, Users, Clock, 
  Heart, PlayCircle
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

// Mock data
const nfts = [
  {
    id: '1',
    name: 'Golden Microphone',
    image: 'https://images.pexels.com/photos/164829/pexels-photo-164829.jpeg',
    creator: 'Riddimz Official',
    type: 'Badge',
    description: 'Awarded for hosting 10+ karaoke rooms'
  },
  {
    id: '2',
    name: 'Cosmic Harmony',
    image: 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg',
    creator: 'Luna Echo',
    type: 'Song',
    description: 'Exclusive song with unlimited karaoke access'
  },
  {
    id: '3',
    name: 'Virtual Stage - Neon City',
    image: 'https://images.pexels.com/photos/1484516/pexels-photo-1484516.jpeg',
    creator: 'Riddimz Official',
    type: 'Room Theme',
    description: 'Special karaoke room background theme'
  }
]

const karaokeHistory = [
  {
    id: '1',
    song: 'Somebody To Love',
    artist: 'Queen',
    date: '2 hours ago',
    roomName: 'Pop Hits Karaoke Night',
    participants: 28,
    duration: '4:52'
  },
  {
    id: '2',
    song: 'Don\'t Stop Believin\'',
    artist: 'Journey',
    date: 'Yesterday',
    roomName: 'Rock Legends Jam',
    participants: 15,
    duration: '4:11'
  },
  {
    id: '3',
    song: 'Bohemian Rhapsody',
    artist: 'Queen',
    date: '3 days ago',
    roomName: 'Classic Rock Karaoke',
    participants: 22,
    duration: '5:55'
  }
]

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false)
  const [userProfile, setUserProfile] = useState({
    username: 'MelodyMaster',
    fullName: 'Alex Johnson',
    bio: 'Passionate about music and karaoke! I host weekly karaoke rooms featuring classic rock hits. Come join me and let\'s have some fun!',
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
    walletAddress: '8Kv91Jj9eYcCJLtLEfSHnCAvdKrXQJLTfwUQJcmDxDKJ',
    joinDate: 'March 2023',
    followers: 152,
    following: 87
  })
  
  const handleProfileUpdate = () => {
    // In a real app, this would save to the database
    setIsEditing(false)
  }
  
  return (
    <div className="container px-4 max-w-7xl mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile card */}
          <Card>
            <CardHeader className="relative p-0">
              {/* Cover image */}
              <div className="h-32 overflow-hidden rounded-t-lg">
                <div className="w-full h-full animated-bg"></div>
              </div>
              
              {/* Avatar */}
              <div className="flex justify-center">
                <Avatar className="h-24 w-24 border-4 border-background mt-[-3rem] rounded-full">
                  <AvatarImage src={userProfile.avatar} alt={userProfile.username} />
                  <AvatarFallback>{userProfile.username.slice(0, 2)}</AvatarFallback>
                </Avatar>
              </div>
              
              <div className="text-center p-6 pt-2">
                <h2 className="text-2xl font-bold">{userProfile.username}</h2>
                <p className="text-muted-foreground">{userProfile.fullName}</p>
                
                <div className="flex justify-center space-x-6 mt-4">
                  <div className="text-center">
                    <p className="font-bold">{userProfile.followers}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{userProfile.following}</p>
                    <p className="text-xs text-muted-foreground">Following</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{karaokeHistory.length}</p>
                    <p className="text-xs text-muted-foreground">Performances</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  {!isEditing ? (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex space-x-2">
                      <Button 
                        variant="default" 
                        className="flex-1 gap-2"
                        onClick={handleProfileUpdate}
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {!isEditing ? (
                <div>
                  <p className="text-sm mb-4">{userProfile.bio}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Joined {userProfile.joinDate}
                    </div>
                    <div className="flex items-center text-muted-foreground break-all">
                      <div className="flex-shrink-0 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      </div>
                      <span className="truncate">{userProfile.walletAddress.slice(0, 6)}...{userProfile.walletAddress.slice(-4)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username"
                      value={userProfile.username}
                      onChange={(e) => setUserProfile({...userProfile, username: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input 
                      id="fullName"
                      value={userProfile.fullName}
                      onChange={(e) => setUserProfile({...userProfile, fullName: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea 
                      id="bio"
                      value={userProfile.bio}
                      onChange={(e) => setUserProfile({...userProfile, bio: e.target.value})}
                      rows={4}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="avatar">Profile Image</Label>
                    <div className="flex items-center mt-1">
                      <Avatar className="h-12 w-12 mr-3">
                        <AvatarImage src={userProfile.avatar} alt={userProfile.username} />
                        <AvatarFallback>{userProfile.username.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Navigation */}
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                <Button variant="ghost" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Music className="h-4 w-4 mr-2" />
                  My Music
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Mic className="h-4 w-4 mr-2" />
                  My Karaoke
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Award className="h-4 w-4 mr-2" />
                  My NFTs
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </nav>
            </CardContent>
          </Card>
        </div>
        
        {/* Main content */}
        <div className="md:col-span-2">
          <Tabs defaultValue="nfts">
            <TabsList className="mb-6">
              <TabsTrigger value="nfts">My NFTs</TabsTrigger>
              <TabsTrigger value="karaoke">Karaoke History</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>
            
            <TabsContent value="nfts">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {nfts.map((nft) => (
                  <div key={nft.id} className="relative group">
                    <div className="rounded-lg overflow-hidden border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="aspect-square relative">
                        <Image 
                          src={nft.image} 
                          alt={nft.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{nft.name}</h3>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {nft.type}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{nft.description}</p>
                        <div className="text-xs text-muted-foreground">by {nft.creator}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="karaoke">
              <Card>
                <CardHeader>
                  <CardTitle>Your Karaoke Performances</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {karaokeHistory.map((item) => (
                        <div key={item.id} className="p-4 border rounded-lg hover:bg-secondary transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">{item.song}</h3>
                              <p className="text-muted-foreground">{item.artist}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                <PlayCircle className="h-5 w-5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                <Heart className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center text-sm text-muted-foreground mt-2">
                            <div className="flex items-center mr-4">
                              <Clock className="h-4 w-4 mr-1" />
                              {item.duration}
                            </div>
                            <div className="flex items-center mr-4">
                              <Users className="h-4 w-4 mr-1" />
                              {item.participants}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {item.date}
                            </div>
                          </div>
                          
                          <Separator className="my-3" />
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{item.roomName}</span>
                            <Button variant="outline" size="sm">
                              View Recording
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="favorites">
              <Card>
                <CardHeader>
                  <CardTitle>Your Favorites</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-6">You haven't added any favorites yet. Explore music and karaoke rooms and heart the ones you like!</p>
                  
                  <Button>
                    Explore Music
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}