'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  githubRepoFullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    deployments: number;
  };
  latestDeployment?: {
    status: string;
    flyAppUrl: string | null;
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null;
  } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await authClient.getSession();
      
      if (error || !data) {
        router.push('/login');
      } else {
        setUser(data.user);
        fetchProjects();
      }
      setLoading(false);
    };

    fetchSession();
  }, [router]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setProjectsLoading(false);
    }
  };

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deployment Previews</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user.name || user.email}!</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/setup/repositories"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Project
            </Link>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {projectsLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="mt-1 text-gray-500">Get started by adding your first repository.</p>
            <Link
              href="/setup/repositories"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Add your first project
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {project.githubRepoFullName}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {project.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {project.latestDeployment && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      Latest deployment: 
                      <span className={`ml-1 font-medium ${
                        project.latestDeployment.status === 'active' ? 'text-green-600' :
                        project.latestDeployment.status === 'failed' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {project.latestDeployment.status}
                      </span>
                    </p>
                    {project.latestDeployment.flyAppUrl && (
                      <a
                        href={project.latestDeployment.flyAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View deployment →
                      </a>
                    )}
                  </div>
                )}
                
                <div className="text-sm text-gray-500">
                  <p>{project._count?.deployments || 0} deployments</p>
                  <p>Created {new Date(project.createdAt).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}