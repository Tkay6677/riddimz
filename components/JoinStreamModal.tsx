import { useState } from 'react';

interface JoinStreamModalProps {
  onJoin: () => Promise<void>;
  isHost: boolean;
}

export function JoinStreamModal({ onJoin, isHost }: JoinStreamModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    try {
      setIsLoading(true);
      await onJoin();
      setIsOpen(false);
    } catch (error) {
      console.error('Error joining stream:', error);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">
          {isHost ? 'Start Streaming' : 'Join Stream'}
        </h2>
        <p className="text-gray-600 mb-6">
          {isHost 
            ? 'Click the button below to start streaming audio to participants.'
            : 'Click the button below to join the audio stream.'}
        </p>
        <button
          onClick={handleJoin}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Starting...' : (isHost ? 'Start Streaming' : 'Join Stream')}
        </button>
      </div>
    </div>
  );
} 