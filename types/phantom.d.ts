// Phantom Wallet types for Solana integration
interface PhantomProvider {
  isPhantom: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
  disconnect(): Promise<void>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export {};
