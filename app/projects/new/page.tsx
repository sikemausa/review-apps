'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  owner: {
    login: string;
  };
}

export default function NewProjectPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [config, setConfig] = useState({
    dockerfilePath: '',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: 'npm start'
  });
  const router = useRouter();

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const session = await authClient.getSession();
        if (!session.data) {
          router.push('/login');
          return;
        }

        const response = await fetch('/api/github/repos?per_page=100', {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch repositories');
        }

        const data = await response.json();
        setRepos(data.repositories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();
  }, [router]);

  const handleCreateProject = async () => {
    if (!selectedRepo) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          repoFullName: selectedRepo.fullName,
          dockerfilePath: config.dockerfilePath || null,
          buildCommand: config.buildCommand,
          installCommand: config.installCommand,
          startCommand: config.startCommand
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading repositories...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className="text-gray-500 hover:text-gray-700 mb-4 inline-block"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
          <p className="mt-2 text-gray-600">
            Select a repository and configure deployment settings
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Repository Selection */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Select Repository
          </h2>
          
          {repos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No repositories found.</p>
              <p className="text-sm text-gray-400 mt-2">
                Make sure the GitHub App is installed on your repositories.
              </p>
              <Link
                href="/setup/github"
                className="mt-4 inline-block text-blue-600 hover:text-blue-500"
              >
                Configure GitHub App →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {repos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                    selectedRepo?.id === repo.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{repo.fullName}</div>
                  {repo.description && (
                    <div className="text-sm text-gray-500">{repo.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Build Configuration */}
        {selectedRepo && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Build Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dockerfile Path (optional)
                </label>
                <input
                  type="text"
                  value={config.dockerfilePath}
                  onChange={(e) => setConfig({ ...config, dockerfilePath: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="./Dockerfile or leave empty for auto-generation"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Leave empty to auto-generate a Dockerfile
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Install Command
                </label>
                <input
                  type="text"
                  value={config.installCommand}
                  onChange={(e) => setConfig({ ...config, installCommand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Build Command
                </label>
                <input
                  type="text"
                  value={config.buildCommand}
                  onChange={(e) => setConfig({ ...config, buildCommand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Command
                </label>
                <input
                  type="text"
                  value={config.startCommand}
                  onChange={(e) => setConfig({ ...config, startCommand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Link
            href="/projects"
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </Link>
          <button
            onClick={handleCreateProject}
            disabled={!selectedRepo || creating}
            className={`px-6 py-2 rounded-md text-white font-medium ${
              !selectedRepo || creating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}