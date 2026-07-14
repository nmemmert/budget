import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await FileStorageService.registerUser(email, password);

    return NextResponse.json({ success: true, user: { userId: result.userId, email: result.email }, sessionToken: result.sessionToken });
  } catch (error: any) {
    const status = error.message === 'User already exists' ? 409 : 400;
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status });
  }
}
