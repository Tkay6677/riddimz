"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

export const dynamic = "force-dynamic";

export default function CreatePodcastRoom() {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [roomData, setRoomData] = useState({
    name: "",
    description: "",
  });

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomData.name) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a room name.",
        duration: 4000,
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: room, error: roomError } = await supabase
        .from("podcast_rooms")
        .insert({
          name: roomData.name,
          description: roomData.description,
          host_id: user.id,
          is_live: true,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      toast({
        title: "Podcast Room Created!",
        description: `Your podcast room "${roomData.name}" is live.`,
        duration: 4000,
      });

      router.push(`/podcast/${room.id}`);
    } catch (error: any) {
      console.error("Error creating podcast room:", error);
      toast({
        variant: "destructive",
        title: "Error Creating Room",
        description: error.message || "Something went wrong. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Podcast Room</CardTitle>
          <CardDescription>Set up your podcast room and start streaming!</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRoom} className="space-y-6">
            <div>
              <Label htmlFor="name">Room Name</Label>
              <Input
                id="name"
                value={roomData.name}
                onChange={(e) => setRoomData({ ...roomData, name: e.target.value })}
                placeholder="Enter room name"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={roomData.description}
                onChange={(e) => setRoomData({ ...roomData, description: e.target.value })}
                placeholder="Describe your podcast"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating ? "Creating Room..." : "Create Room"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}