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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome, {user.name || user.email}!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Projects Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Projects</h2>
            <p className="text-gray-600 mb-4">
              Manage your deployment preview projects
            </p>
            <a
              href="/projects"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              View Projects →
            </a>
          </div>

          {/* GitHub App Status Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">GitHub App</h2>
            <p className="text-gray-600 mb-4">
              Configure GitHub App installation
            </p>
            <a
              href="/setup/github"
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Configure →
            </a>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
          <dl className="grid grid-cols-1 gap-2">
            <div className="flex justify-between py-2 border-b">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{user.email}</dd>
            </div>
            <div className="flex justify-between py-2 border-b">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900">{user.name || 'Not set'}</dd>
            </div>
            <div className="flex justify-between py-2 border-b">
              <dt className="text-gray-500">Email Verified</dt>
              <dd className="text-gray-900">{user.emailVerified ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">Member Since</dt>
              <dd className="text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}