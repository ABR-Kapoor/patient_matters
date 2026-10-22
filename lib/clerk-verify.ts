import { auth, currentUser } from '@clerk/nextjs/server';

export interface ClerkUser {
  id: string;
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  [key: string]: any;
}

export async function verifyClerkUser(): Promise<ClerkUser | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    let user = null;
    try {
      user = await currentUser();
    } catch (e: any) {
      console.warn('[verifyClerkUser] currentUser() fetch failed, falling back to auth():', e?.message || e);
    }

    return {
      id: userId,
      email: user?.emailAddresses?.[0]?.emailAddress || null,
      given_name: user?.firstName || null,
      family_name: user?.lastName || null,
      picture: user?.imageUrl || null,
    };
  } catch (error: any) {
    console.error('Error verifying Clerk user:', error.message || error);
    return null;
  }
}
