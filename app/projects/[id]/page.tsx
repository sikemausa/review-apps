'use client';

import { use, useEffect, useState } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  dockerfilePath: string | null;
  buildCommand: string;
  installCommand: string;
  startCommand: string;
  nodeVersion: string;
  flyRegion: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddEnv, setShowAddEnv] = useState(false);
  const [newEnvVar, setNewEnvVar] = useState({ key: '', value: '', isSecret: false });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchProject();
    fetchEnvVars();
  }, [projectId]);

  useEffect(() => {
    if (project) {
      setEditForm({
        dockerfilePath: project.dockerfilePath || '',
        buildCommand: project.buildCommand,
        installCommand: project.installCommand,
        startCommand: project.startCommand,
        nodeVersion: project.nodeVersion,
        flyRegion: project.flyRegion,
        isActive: project.isActive
      });
    }
  }, [project]);

  const fetchProject = async () => {
    try {
      const session = await authClient.getSession();
      if (!session.data) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }

      const data = await response.json();
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvVars = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/env-vars`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setEnvVars(data.envVars);
      }
    } catch (err) {
      console.error('Failed to fetch env vars:', err);
    }
  };

  const handleAddEnvVar = async () => {
    if (!newEnvVar.key || !newEnvVar.value) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/env-vars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          variables: [newEnvVar]
        }),
      });

      if (response.ok) {
        await fetchEnvVars();
        setNewEnvVar({ key: '', value: '', isSecret: false });
        setShowAddEnv(false);
      }
    } catch (err) {
      console.error('Failed to add env var:', err);
    }
  };

  const handleDeleteEnvVar = async (varId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/env-vars?varId=${varId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchEnvVars();
      }
    } catch (err) {
      console.error('Failed to delete env var:', err);
    }
  };

  const handleUpdateProject = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setShowEditModal(false);
      } else {
        const error = await response.json();
        alert(`Failed to update project: ${error.error}`);
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      alert('Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        router.push('/projects');
      } else {
        const error = await response.json();
        alert(`Failed to delete project: ${error.error}`);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error || 'Project not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className="text-gray-500 hover:text-gray-700 mb-4 inline-block"
          >
            ← Back to Projects
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.repoFullName}</h1>
              <p className="mt-2 text-gray-600">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                project.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {project.isActive ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Build Configuration */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Build Configuration</h2>
          <dl className="grid grid-cols-1 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Dockerfile Path</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {project.dockerfilePath || 'Auto-generated'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Install Command</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {project.installCommand}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Build Command</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {project.buildCommand}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Start Command</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {project.startCommand}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Node Version</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {project.nodeVersion}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Fly Region</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {project.flyRegion}
              </dd>
            </div>
          </dl>
        </div>

        {/* Environment Variables */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Environment Variables</h2>
            <button
              onClick={() => setShowAddEnv(true)}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              + Add Variable
            </button>
          </div>

          {showAddEnv && (
            <div className="mb-4 p-4 border border-gray-200 rounded-md">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={newEnvVar.key}
                  onChange={(e) => setNewEnvVar({ ...newEnvVar, key: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newEnvVar.value}
                  onChange={(e) => setNewEnvVar({ ...newEnvVar, value: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newEnvVar.isSecret}
                    onChange={(e) => setNewEnvVar({ ...newEnvVar, isSecret: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Secret value</span>
                </label>
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setShowAddEnv(false);
                      setNewEnvVar({ key: '', value: '', isSecret: false });
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEnvVar}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {envVars.length === 0 ? (
            <p className="text-gray-500 text-sm">No environment variables configured</p>
          ) : (
            <div className="space-y-2">
              {envVars.map((envVar) => (
                <div key={envVar.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-4">
                    <code className="text-sm font-medium">{envVar.key}</code>
                    <code className="text-sm text-gray-600">
                      {envVar.isSecret ? '••••••••' : envVar.value}
                    </code>
                    {envVar.isSecret && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        Secret
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEnvVar(envVar.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">Ready to Deploy!</h3>
          <p className="text-blue-800 mb-4">
            Your project is configured. When you create a pull request in{' '}
            <code className="bg-blue-100 px-1 py-0.5 rounded">{project.repoFullName}</code>,
            a deployment preview will be automatically created.
          </p>
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Make sure:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>The GitHub App is installed on your repository</li>
              <li>Your webhook is configured and running</li>
              <li>Your Fly.io credentials are set up (coming soon)</li>
            </ul>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Edit Project Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dockerfile Path</label>
                  <input
                    type="text"
                    value={editForm.dockerfilePath || ''}
                    onChange={(e) => setEditForm({ ...editForm, dockerfilePath: e.target.value || null })}
                    placeholder="Leave empty for auto-generation"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Install Command</label>
                  <input
                    type="text"
                    value={editForm.installCommand || ''}
                    onChange={(e) => setEditForm({ ...editForm, installCommand: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Build Command</label>
                  <input
                    type="text"
                    value={editForm.buildCommand || ''}
                    onChange={(e) => setEditForm({ ...editForm, buildCommand: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Command</label>
                  <input
                    type="text"
                    value={editForm.startCommand || ''}
                    onChange={(e) => setEditForm({ ...editForm, startCommand: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Node Version</label>
                  <input
                    type="text"
                    value={editForm.nodeVersion || ''}
                    onChange={(e) => setEditForm({ ...editForm, nodeVersion: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Fly Region</label>
                  <select
                    value={editForm.flyRegion || 'iad'}
                    onChange={(e) => setEditForm({ ...editForm, flyRegion: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="iad">iad (Virginia)</option>
                    <option value="ord">ord (Chicago)</option>
                    <option value="lax">lax (Los Angeles)</option>
                    <option value="sea">sea (Seattle)</option>
                    <option value="lhr">lhr (London)</option>
                    <option value="ams">ams (Amsterdam)</option>
                    <option value="fra">fra (Frankfurt)</option>
                    <option value="sin">sin (Singapore)</option>
                    <option value="syd">syd (Sydney)</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProject}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Delete Project</h2>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete this project? This action cannot be undone.
                All deployments and environment variables will also be deleted.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Project:</strong> {project.repoFullName}
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}