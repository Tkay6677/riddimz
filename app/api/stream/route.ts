import { NextRequest, NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const secret = process.env.STREAM_SECRET;

export async function POST(req: NextRequest) {
  if (!apiKey || !secret) {
    console.error('Missing Stream API key or secret');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('No session found for /api/stream-token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = new StreamClient(apiKey, secret);
    const userId = session.user.id;

    const token = client.createToken(userId);

    return NextResponse.json({ token }, { status: 200 });
  } catch (error: any) {
    console.error('Error generating Stream token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  );
}