import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  try {
    const { tempToken, code } = await request.json();
    if (!tempToken || !code) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const result = await FileStorageService.completeTOTPLogin(tempToken, code);
    return NextResponse.json({ success: true, user: { userId: result.userId, email: result.email }, sessionToken: result.sessionToken });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '2FA login failed' }, { status: 401 });
  }
}
