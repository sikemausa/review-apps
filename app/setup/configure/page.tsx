'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/src/lib/auth-client';

interface DeploymentConfig {
  buildCommand: string;
  installCommand: string;
  startCommand: string;
  port: number;
  dockerfilePath: string;
}

interface EnvironmentVariable {
  name: string;
  value: string;
}

function ConfigurePageContent() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(true);
  const [config, setConfig] = useState<DeploymentConfig>({
    buildCommand: '',
    installCommand: 'npm install',
    startCommand: 'npm start',
    port: 3000,
    dockerfilePath: '',
  });
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const repoFullName = searchParams.get('repo');
  const installationId = searchParams.get('installationId');
  const repoId = searchParams.get('repoId');

  const autoDetectConfig = useCallback(async () => {
    if (!repoFullName || !installationId) return;
    
    setAutoDetecting(true);
    try {
      const response = await fetch(
        `/api/github/repos/${repoFullName.split('/')[0]}/${repoFullName.split('/')[1]}/installation/${installationId}/file?path=package.json`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          try {
            const packageJson = JSON.parse(atob(data.content));
            const detectedConfig: Partial<DeploymentConfig> = {};
            
            if (packageJson.scripts?.build) {
              detectedConfig.buildCommand = 'npm run build';
            }
            
            if (packageJson.scripts?.start) {
              detectedConfig.startCommand = 'npm start';
            } else if (packageJson.scripts?.dev) {
              detectedConfig.startCommand = 'npm run dev';
            }
            
            if (packageJson.dependencies?.['yarn']) {
              detectedConfig.installCommand = 'yarn install';
              if (detectedConfig.buildCommand) {
                detectedConfig.buildCommand = detectedConfig.buildCommand.replace('npm run', 'yarn');
              }
              if (detectedConfig.startCommand) {
                detectedConfig.startCommand = detectedConfig.startCommand.replace('npm', 'yarn');
              }
            }
            
            setConfig(prev => ({ ...prev, ...detectedConfig }));
          } catch (e) {
            console.error('Failed to parse package.json:', e);
          }
        }
      }
      
      const dockerResponse = await fetch(
        `/api/github/repos/${repoFullName.split('/')[0]}/${repoFullName.split('/')[1]}/installation/${installationId}/file?path=Dockerfile`
      );
      
      if (dockerResponse.ok) {
        setConfig(prev => ({ ...prev, dockerfilePath: 'Dockerfile' }));
      }
    } catch (error) {
      console.error('Failed to auto-detect configuration:', error);
    } finally {
      setAutoDetecting(false);
    }
  }, [repoFullName, installationId]);

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await authClient.getSession();
      
      if (error || !data) {
        router.push('/login');
      } else {
        setUser(data.user);
        if (repoFullName && installationId) {
          autoDetectConfig();
        }
      }
      setLoading(false);
    };

    fetchSession();
  }, [router, repoFullName, installationId, autoDetectConfig]);

  const handleConfigChange = (field: keyof DeploymentConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleAddEnvVar = () => {
    setEnvVars(prev => [...prev, { name: '', value: '' }]);
  };

  const handleUpdateEnvVar = (index: number, field: 'name' | 'value', value: string) => {
    setEnvVars(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoFullName || !installationId || !repoId) return;
    
    setSubmitting(true);
    try {
      const envVarsObject = envVars.reduce((acc, { name, value }) => {
        if (name && value) acc[name] = value;
        return acc;
      }, {} as Record<string, string>);
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepoId: Number(repoId),
          githubRepoFullName: repoFullName,
          githubInstallationId: Number(installationId),
          deploymentConfig: {
            ...config,
            envVars: envVarsObject,
          },
        }),
      });
      
      if (response.ok) {
        const { project } = await response.json();
        router.push(`/projects/${project.id}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading...</div>
    </div>;
  }

  if (!user || !repoFullName) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configure Deployment
          </h1>
          <p className="text-gray-600 mb-8">
            Repository: <span className="font-medium text-gray-900">{repoFullName}</span>
          </p>
          
          {autoDetecting ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Auto-detecting configuration...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Build Configuration</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="installCommand" className="block text-sm font-medium text-gray-700">
                      Install Command
                    </label>
                    <input
                      type="text"
                      id="installCommand"
                      value={config.installCommand}
                      onChange={(e) => handleConfigChange('installCommand', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="npm install"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="buildCommand" className="block text-sm font-medium text-gray-700">
                      Build Command (optional)
                    </label>
                    <input
                      type="text"
                      id="buildCommand"
                      value={config.buildCommand}
                      onChange={(e) => handleConfigChange('buildCommand', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="npm run build"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="startCommand" className="block text-sm font-medium text-gray-700">
                      Start Command
                    </label>
                    <input
                      type="text"
                      id="startCommand"
                      value={config.startCommand}
                      onChange={(e) => handleConfigChange('startCommand', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="npm start"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="port" className="block text-sm font-medium text-gray-700">
                      Application Port
                    </label>
                    <input
                      type="number"
                      id="port"
                      value={config.port}
                      onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="3000"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="dockerfilePath" className="block text-sm font-medium text-gray-700">
                      Dockerfile Path (optional)
                    </label>
                    <input
                      type="text"
                      id="dockerfilePath"
                      value={config.dockerfilePath}
                      onChange={(e) => handleConfigChange('dockerfilePath', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Dockerfile"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty to use auto-generated Dockerfile
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Environment Variables</h2>
                  <button
                    type="button"
                    onClick={handleAddEnvVar}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Variable
                  </button>
                </div>
                
                {envVars.length === 0 ? (
                  <p className="text-gray-500 text-sm">No environment variables configured</p>
                ) : (
                  <div className="space-y-3">
                    {envVars.map((envVar, index) => (
                      <div key={index} className="flex gap-3">
                        <input
                          type="text"
                          value={envVar.name}
                          onChange={(e) => handleUpdateEnvVar(index, 'name', e.target.value)}
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Variable name"
                        />
                        <input
                          type="text"
                          value={envVar.value}
                          onChange={(e) => handleUpdateEnvVar(index, 'value', e.target.value)}
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Value"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEnvVar(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="border-t pt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => router.push('/setup/repositories')}
                  className="px-6 py-2 text-gray-700 font-medium hover:text-gray-900"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading...</div>
    </div>}>
      <ConfigurePageContent />
    </Suspense>
  );
}