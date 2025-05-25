'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/lib/auth-client';
import Link from 'next/link';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  html_url: string;
}

interface Installation {
  id: number;
  account: {
    login: string;
    type: string;
  };
}

export default function RepositorySelectionPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<number | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await authClient.getSession();
      
      if (error || !data) {
        router.push('/login');
      } else {
        setUser(data.user);
        fetchInstallations();
      }
      setLoading(false);
    };

    fetchSession();
  }, [router]);

  const fetchInstallations = async () => {
    try {
      const response = await fetch('/api/github/installations');
      console.log('Installations response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Installations API error:', errorData);
        return;
      }
      
      const data = await response.json();
      console.log('Installations data:', data);
      setInstallations(data.installations || []);
      if (data.installations.length === 1) {
        setSelectedInstallation(data.installations[0].id);
        fetchRepositories(data.installations[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch installations:', error);
    }
  };

  const fetchRepositories = async (installationId: number) => {
    setReposLoading(true);
    try {
      const response = await fetch(`/api/github/repos?installationId=${installationId}`);
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories || []);
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    } finally {
      setReposLoading(false);
    }
  };

  const handleInstallationChange = (installationId: number) => {
    setSelectedInstallation(installationId);
    setSelectedRepo(null);
    fetchRepositories(installationId);
  };

  const handleSelectRepo = (repo: Repository) => {
    setSelectedRepo(repo);
  };

  const handleContinue = () => {
    if (selectedRepo && selectedInstallation) {
      router.push(
        `/setup/configure?repo=${encodeURIComponent(selectedRepo.full_name)}&installationId=${selectedInstallation}&repoId=${selectedRepo.id}`
      );
    }
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
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Select a Repository
          </h1>
          
          {installations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No GitHub App installations found</h3>
              <p className="mt-1 text-gray-500">To enable deployment previews, you need to install our GitHub App on your repositories.</p>
              <div className="mt-6 space-y-3">
                <Link
                  href="/setup/github"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Install GitHub App
                </Link>
                <p className="text-sm text-gray-500">
                  Already installed? Try{' '}
                  <button
                    onClick={() => window.location.reload()}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    refreshing the page
                  </button>
                  {' '}or{' '}
                  <a
                    href="https://github.com/settings/installations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    check your GitHub settings
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {installations.length > 1 && (
                <div>
                  <label htmlFor="installation" className="block text-sm font-medium text-gray-700">
                    Select Installation
                  </label>
                  <select
                    id="installation"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={selectedInstallation || ''}
                    onChange={(e) => handleInstallationChange(Number(e.target.value))}
                  >
                    <option value="">Choose an installation</option>
                    {installations.map((installation) => (
                      <option key={installation.id} value={installation.id}>
                        {installation.account.login} ({installation.account.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedInstallation && (
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Available Repositories</h2>
                  
                  {reposLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">Loading repositories...</p>
                    </div>
                  ) : repositories.length === 0 ? (
                    <p className="text-gray-500">No repositories found for this installation.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {repositories.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => handleSelectRepo(repo)}
                          className={`text-left p-4 rounded-lg border-2 transition-colors ${
                            selectedRepo?.id === repo.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{repo.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{repo.full_name}</p>
                              {repo.language && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mt-2">
                                  {repo.language}
                                </span>
                              )}
                            </div>
                            <span className={`ml-2 ${repo.private ? 'text-gray-400' : 'text-green-600'}`}>
                              {repo.private ? (
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                                </svg>
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedRepo && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Selected repository:</p>
                      <p className="font-medium text-gray-900">{selectedRepo.full_name}</p>
                    </div>
                    <button
                      onClick={handleContinue}
                      className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Continue to Configuration
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}