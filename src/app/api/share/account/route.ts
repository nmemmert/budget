import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { accountId, email, role } = await request.json();
    if (!accountId || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (email === session.email) {
      return NextResponse.json({ error: 'Cannot share an account with yourself' }, { status: 400 });
    }

    const shareId = await FileStorageService.createShare(session.userId, session.email, email, accountId, role);
    return NextResponse.json({ success: true, shareId, message: `Account shared with ${email}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to share account' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { shareId } = await request.json();
    if (!shareId) return NextResponse.json({ error: 'Missing shareId' }, { status: 400 });

    await FileStorageService.revokeShare(shareId, session.userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to revoke share' }, { status: 400 });
  }
}
