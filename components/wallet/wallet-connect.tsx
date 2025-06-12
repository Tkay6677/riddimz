"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function WalletConnect() {
  const { publicKey, signMessage, connected } = useWallet();

  useEffect(() => {
    const handleAuth = async () => {
      if (connected && publicKey) {
        try {
          // Check if user exists
          const { data: existingUser } = await supabase
            .from('users')
            .select()
            .eq('wallet_address', publicKey.toString())
            .single();

          if (!existingUser) {
            // Create new user
            const message = `Sign this message to authenticate with Riddimz\nNonce: ${Date.now()}`;
            const encodedMessage = new TextEncoder().encode(message);
            const signedMessage = await signMessage?.(encodedMessage);

            if (signedMessage) {
              await supabase.from('users').insert({
                wallet_address: publicKey.toString(),
                username: `User_${publicKey.toString().slice(0, 6)}`,
              });
            }
          }
        } catch (error) {
          console.error('Error during authentication:', error);
        }
      }
    };

    handleAuth();
  }, [connected, publicKey, signMessage]);

  return <WalletMultiButton />;
}