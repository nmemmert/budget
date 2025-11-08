import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const data = await FileStorageService.loadUserData(userId);

    return NextResponse.json({ 
      success: true,
      data 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const data = await request.json();
    await FileStorageService.saveUserData(userId, data);

    return NextResponse.json({ 
      success: true 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save data' },
      { status: 500 }
    );
  }
}
