'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authClient } from '@/src/lib/auth-client';
import Link from 'next/link';

interface Deployment {
  id: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  commitSha: string;
  flyAppName: string;
  flyAppUrl: string | null;
  status: 'pending' | 'building' | 'deploying' | 'active' | 'failed' | 'destroyed';
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  githubRepoFullName: string;
  githubRepoId: number;
  githubInstallationId: number;
  deploymentConfig: {
    buildCommand?: string;
    installCommand?: string;
    startCommand?: string;
    port?: number;
    dockerfilePath?: string;
    envVars?: Record<string, string>;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage() {
  const [user, setUser] = useState<any>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploymentsLoading, setDeploymentsLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await authClient.getSession();
      
      if (error || !data) {
        router.push('/login');
      } else {
        setUser(data.user);
        fetchProject();
        fetchDeployments();
      }
      setLoading(false);
    };

    fetchSession();
  }, [router, projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      } else if (response.status === 404) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };

  const fetchDeployments = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/deployments`);
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments || []);
      }
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    } finally {
      setDeploymentsLoading(false);
    }
  };

  const handleToggleProject = async () => {
    if (!project) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !project.isActive }),
      });
      
      if (response.ok) {
        setProject(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
      }
    } catch (error) {
      console.error('Failed to toggle project:', error);
    }
  };

  const getStatusColor = (status: Deployment['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'destroyed': return 'text-gray-600 bg-gray-100';
      case 'building':
      case 'deploying': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  if (loading || !project) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading...</div>
    </div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {project.githubRepoFullName}
                </h1>
                <p className="text-gray-600 mt-1">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    project.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {project.isActive ? 'Active' : 'Inactive'}
                </span>
                
                <Link
                  href={`/projects/${projectId}/settings`}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Settings
                </Link>
                
                <button
                  onClick={handleToggleProject}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    project.isActive
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {project.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Build Command</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {project.deploymentConfig.buildCommand || 'Not configured'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Start Command</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {project.deploymentConfig.startCommand || 'Not configured'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Port</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {project.deploymentConfig.port || 'Not configured'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Deployments</h2>
          </div>
          
          {deploymentsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading deployments...</p>
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No deployments yet</h3>
              <p className="mt-1 text-gray-500">Deployments will appear here when PRs are created.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PR
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Author
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deployments.map((deployment) => (
                    <tr key={deployment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            #{deployment.prNumber} {deployment.prTitle}
                          </div>
                          <div className="text-sm text-gray-500">
                            {deployment.commitSha.substring(0, 7)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deployment.status)}`}>
                          {deployment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {deployment.prAuthor}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {deployment.startedAt
                          ? new Date(deployment.startedAt).toLocaleString()
                          : new Date(deployment.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          {deployment.flyAppUrl && deployment.status === 'active' && (
                            <a
                              href={deployment.flyAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View
                            </a>
                          )}
                          <Link
                            href={`/deployments/${deployment.id}`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}