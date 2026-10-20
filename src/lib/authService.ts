import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserAccount } from '../types';
import { INITIAL_USERS } from '../data/initialUsers';

export async function loginWithCloudOrLocal(
  rawUserId: string,
  rawPassword: string
): Promise<UserAccount> {
  const targetId = rawUserId.trim().toUpperCase();
  const inputPassword = rawPassword.trim();

  // Try server endpoint first (for AI Studio development server)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetId, password: inputPassword })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return data.user;
      }
    }
  } catch (e) {
    // Backend unreachable (e.g., deployed statically on Vercel), fallback to Firestore
  }

  // Fallback to Firestore users collection
  try {
    const usersRef = collection(db, 'users');
    const qSnap = await getDocs(usersRef);
    let matchedUser: UserAccount | null = null;

    qSnap.forEach((docSnap) => {
      const u = docSnap.data() as UserAccount;
      if (
        u.userId.trim().toUpperCase() === targetId ||
        (u.email && u.email.trim().toLowerCase() === targetId.toLowerCase())
      ) {
        matchedUser = u;
      }
    });

    if (matchedUser) {
      const user = matchedUser as UserAccount;
      if (user.status === 'Nonaktif') {
        throw new Error('Akun ini sedang dinonaktifkan oleh Administrator. Hubungi ULP Baguala.');
      }
      if (user.password !== inputPassword) {
        throw new Error('Password yang Anda masukkan salah. Silakan coba lagi.');
      }

      // Update lastLogin in Firestore
      try {
        await updateDoc(doc(db, 'users', user.id), {
          lastLogin: new Date().toISOString().split('T')[0]
        });
      } catch (err) {
        console.warn('Could not update last login date:', err);
      }

      const { password: _, ...safeUser } = user;
      return safeUser as UserAccount;
    }
  } catch (firestoreErr: any) {
    console.warn('Firestore user lookup error:', firestoreErr);
  }

  // Fallback to initial master users (e.g. 9925045ZY / admin123 or 8816024BT / admin123)
  const fallback = INITIAL_USERS.find(
    (u) =>
      u.userId.trim().toUpperCase() === targetId ||
      (u.email && u.email.trim().toLowerCase() === targetId.toLowerCase())
  );

  if (fallback) {
    if (fallback.status === 'Nonaktif') {
      throw new Error('Akun ini sedang dinonaktifkan oleh Administrator. Hubungi ULP Baguala.');
    }
    if (fallback.password !== inputPassword) {
      throw new Error('Password yang Anda masukkan salah. Silakan coba lagi.');
    }
    const { password: _, ...safeUser } = fallback;
    return safeUser as UserAccount;
  }

  throw new Error('User ID atau Email tidak terdaftar dalam sistem GROW.');
}
