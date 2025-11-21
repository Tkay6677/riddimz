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

    // Accept client-provided userId when present; fall back to session id.
    const body = await req.json().catch(() => ({}));
    const requestedUserId: string | undefined = body?.userId;
    const hasRequested = typeof requestedUserId === 'string' && requestedUserId.length > 0;
    const isAnonRequested = hasRequested && /^anon-[a-zA-Z0-9-]+$/.test(requestedUserId as string);

    let resolvedUserId: string | null = null;
    if (hasRequested) {
      // If a session exists, allow if it matches or if the request is anon-
      if (session?.user?.id && !isAnonRequested && requestedUserId !== session.user.id) {
        console.warn('Mismatched userId vs session for /api/stream-token');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      resolvedUserId = requestedUserId as string;
    } else {
      resolvedUserId = session?.user?.id || null;
    }

    if (!resolvedUserId) {
      console.warn('Unauthorized: no session and no anon userId for /api/stream-token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = new StreamClient(apiKey, secret);
    const token = client.createToken(resolvedUserId as string);

    return NextResponse.json({ token }, { status: 200 });
  } catch (error: any) {
    console.error('Error generating Stream token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  );
}