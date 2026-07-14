import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await FileStorageService.loginUser(email, password);

    if ('requiresTOTP' in result && result.requiresTOTP) {
      return NextResponse.json({ requiresTOTP: true, tempToken: result.tempToken });
    }

    return NextResponse.json({ success: true, user: { userId: result.userId, email: result.email }, sessionToken: result.sessionToken });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 401 });
  }
}
