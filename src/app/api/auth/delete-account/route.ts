import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-session-token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await FileStorageService.validateSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await FileStorageService.deleteUser(session.userId, token);
    return NextResponse.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Account deletion failed' }, { status: 500 });
  }
}
