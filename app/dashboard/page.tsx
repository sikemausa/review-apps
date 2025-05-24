'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await authClient.getSession();
      
      if (error || !data) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
      setLoading(false);
    };

    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name || user.email}!</p>
      <div>
        <h2>User Information:</h2>
        <ul>
          <li>ID: {user.id}</li>
          <li>Email: {user.email}</li>
          <li>Name: {user.name}</li>
          <li>Email Verified: {user.emailVerified ? 'Yes' : 'No'}</li>
          <li>Created At: {new Date(user.createdAt).toLocaleString()}</li>
        </ul>
      </div>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}