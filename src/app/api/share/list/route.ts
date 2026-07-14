import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { received, owned } = await FileStorageService.listShares(session.email, session.userId);
    return NextResponse.json({ received, owned });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list shares' }, { status: 500 });
  }
}
