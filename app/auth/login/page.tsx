"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chrome, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import Image from 'next/image';

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, signInWithWallet } = useAuth();
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error: any) {
      console.error('Error logging in with Google:', error);
      toast({
        variant: "destructive",
        title: "Error signing in with Google",
        description: error.message || "Something went wrong. Please try again.",
        duration: 5000,
      });
    }
  };

  const handleWalletLogin = async () => {
    try {
      const { error } = await signInWithWallet();
      if (error) throw error;
      
      toast({
        title: "Wallet Connected!",
        description: "Successfully signed in with your Solana wallet.",
        duration: 3000,
      });
      
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error logging in with wallet:', error);
      toast({
        variant: "destructive",
        title: "Error signing in with wallet",
        description: error.message || "Failed to connect wallet. Please try again.",
        duration: 5000,
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <Image
              src="/riddimz-logo.jpg"
              alt="Riddimz logo"
              width={96}
              height={96}
              priority
              className="rounded-md"
            />
          </div>
          <CardTitle className="text-2xl">Welcome to Riddimz</CardTitle>
          <CardDescription>Choose your preferred sign-in method</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={handleGoogleLogin}
            size="lg"
          >
            <Chrome className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={handleWalletLogin}
            size="lg"
          >
            <Wallet className="mr-2 h-5 w-5" />
            Connect Solana Wallet
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}