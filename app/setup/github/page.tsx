'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/lib/auth-client';

export default function GitHubSetupPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appName] = useState('review-apps'); // Replace with your actual app name
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

  const handleInstallApp = () => {
    // Redirect to GitHub App installation page
    const installUrl = `https://github.com/apps/${appName}/installations/new`;
    window.location.href = installUrl;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading...</div>
    </div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Setup GitHub App
          </h1>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Why do I need to install the GitHub App?
              </h2>
              <p className="text-gray-600">
                The Review Apps GitHub App needs to be installed on your repositories to:
              </p>
              <ul className="mt-2 list-disc list-inside text-gray-600 space-y-1">
                <li>Listen for pull request events</li>
                <li>Post deployment status comments</li>
                <li>Access repository content for building</li>
                <li>Manage deployment previews automatically</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Installation Steps
              </h2>
              <ol className="list-decimal list-inside text-gray-600 space-y-2">
                <li>Click the "Install GitHub App" button below</li>
                <li>Select the repositories you want to enable review apps for</li>
                <li>Click "Install" on GitHub</li>
                <li>You'll be redirected back here when complete</li>
              </ol>
            </div>

            <div className="border-t pt-6">
              <button
                onClick={handleInstallApp}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Install GitHub App
              </button>
              
              <button
                onClick={() => router.push('/dashboard')}
                className="ml-4 px-6 py-3 text-gray-700 font-medium hover:text-gray-900"
              >
                Skip for now
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800">
                Already installed?
              </h3>
              <p className="mt-1 text-sm text-blue-700">
                If you've already installed the app, you can manage your installations from your{' '}
                <a
                  href={`https://github.com/settings/installations`}
                  className="underline hover:text-blue-800"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub settings
                </a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}