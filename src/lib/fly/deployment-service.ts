import { getFlyClient } from './client';
import { db } from '@/src/db';
import { deployment, deploymentLog, project } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { createInstallationClient } from '@/src/lib/github/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface DeploymentConfig {
  projectId: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  commitSha: string;
  repoFullName: string;
  installationId: number;
}

export class DeploymentService {
  private flyClient = getFlyClient();

  async deployPullRequest(config: DeploymentConfig): Promise<string> {
    const deploymentId = crypto.randomUUID();
    const appName = this.generateAppName(config.repoFullName, config.prNumber);
    
    try {
      // Create deployment record
      await this.createDeploymentRecord(deploymentId, config, appName);
      
      // Update status to building
      await this.updateDeploymentStatus(deploymentId, 'building');
      await this.log(deploymentId, 'Starting deployment build', 'info', 'build');
      
      // Clone repository
      const repoPath = await this.cloneRepository(
        deploymentId,
        config.repoFullName,
        config.commitSha,
        config.installationId
      );
      
      // Get project configuration
      const projectConfig = await this.getProjectConfig(config.projectId);
      
      // Build Docker image
      await this.buildDockerImage(
        deploymentId,
        repoPath,
        appName,
        projectConfig
      );
      
      // Deploy to Fly.io
      await this.deployToFly(deploymentId, appName, projectConfig, repoPath);
      
      // Update deployment status
      const appUrl = `https://${appName}.fly.dev`;
      await this.updateDeploymentComplete(deploymentId, appUrl);
      
      // Cleanup temp directory
      await fs.rm(repoPath, { recursive: true, force: true });
      
      return deploymentId;
    } catch (error: any) {
      await this.handleDeploymentError(deploymentId, error);
      throw error;
    }
  }

  private async createDeploymentRecord(
    deploymentId: string,
    config: DeploymentConfig,
    appName: string
  ): Promise<void> {
    await db.insert(deployment).values({
      id: deploymentId,
      projectId: config.projectId,
      prNumber: config.prNumber,
      prTitle: config.prTitle,
      prAuthor: config.prAuthor,
      commitSha: config.commitSha,
      flyAppName: appName,
      status: 'pending',
      startedAt: new Date(),
    });
  }

  private async cloneRepository(
    deploymentId: string,
    repoFullName: string,
    commitSha: string,
    installationId: number
  ): Promise<string> {
    await this.log(deploymentId, `Cloning repository ${repoFullName}`, 'info', 'build');
    
    // Create installation client for GitHub
    const githubClient = await createInstallationClient(installationId);
    
    // Get installation token for cloning
    const { data: tokenData } = await githubClient.apps.createInstallationAccessToken({
      installation_id: installationId,
    });
    
    const tempDir = path.join('/tmp', `deployment-${deploymentId}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    const cloneUrl = `https://x-access-token:${tokenData.token}@github.com/${repoFullName}.git`;
    
    await execAsync(`git clone ${cloneUrl} ${tempDir}`);
    await execAsync(`cd ${tempDir} && git checkout ${commitSha}`);
    
    await this.log(deploymentId, 'Repository cloned successfully', 'info', 'build');
    
    return tempDir;
  }

  private async getProjectConfig(projectId: string) {
    const [projectData] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);
    
    if (!projectData) {
      throw new Error('Project not found');
    }
    
    return projectData.deploymentConfig;
  }

  private async buildDockerImage(
    deploymentId: string,
    repoPath: string,
    appName: string,
    config: any
  ): Promise<void> {
    await this.log(deploymentId, 'Preparing deployment', 'info', 'build');
    
    // Check if custom Dockerfile exists
    const dockerfilePath = config.dockerfilePath 
      ? path.join(repoPath, config.dockerfilePath)
      : path.join(repoPath, 'Dockerfile');
    
    const hasDockerfile = await fs.access(dockerfilePath).then(() => true).catch(() => false);
    
    if (!hasDockerfile) {
      // Generate Dockerfile
      await this.generateDockerfile(repoPath, config);
    }
    
    // Generate fly.toml configuration
    await this.generateFlyConfig(repoPath, appName, config);
    
    await this.log(deploymentId, 'Configuration files generated', 'info', 'build');
  }

  private async generateDockerfile(repoPath: string, config: any): Promise<void> {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const hasPackageJson = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    
    let dockerfileContent = '';
    
    if (hasPackageJson) {
      // Node.js app
      dockerfileContent = `
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN ${config.installCommand || 'npm install'}

# Copy application files
COPY . .

# Build if needed
${config.buildCommand ? `RUN ${config.buildCommand}` : ''}

# Expose port
EXPOSE ${config.port || 3000}

# Start command
CMD ["${config.startCommand || 'npm start'}"]
`;
    } else {
      // Generic static site
      dockerfileContent = `
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
    }
    
    await fs.writeFile(path.join(repoPath, 'Dockerfile'), dockerfileContent);
  }

  private async generateFlyConfig(repoPath: string, appName: string, config: any): Promise<void> {
    const flyConfig = {
      app: appName,
      primary_region: 'ord',
      
      build: {
        dockerfile: 'Dockerfile'
      },
      
      env: config.envVars || {},
      
      http_service: {
        internal_port: config.port || 3000,
        force_https: true,
        auto_stop_machines: true,
        auto_start_machines: true,
        min_machines_running: 0,
        processes: ['app']
      },
      
      machine: {
        cpus: 1,
        memory: '512mb'
      }
    };
    
    const flyTomlContent = Object.entries(flyConfig).map(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const section = `[${key}]\n` + Object.entries(value)
          .map(([k, v]) => `  ${k} = ${JSON.stringify(v)}`)
          .join('\n');
        return section;
      }
      return `${key} = ${JSON.stringify(value)}`;
    }).join('\n\n');
    
    await fs.writeFile(path.join(repoPath, 'fly.toml'), flyTomlContent);
  }

  private async deployToFly(
    deploymentId: string,
    appName: string,
    config: any,
    repoPath: string
  ): Promise<void> {
    await this.updateDeploymentStatus(deploymentId, 'deploying');
    await this.log(deploymentId, 'Deploying to Fly.io', 'info', 'deploy');
    
    try {
      // Check if app already exists
      const existingApp = await this.flyClient.getApp(appName);
      
      if (!existingApp) {
        // Create new app
        await this.flyClient.createApp(appName);
        await this.log(deploymentId, `Created Fly.io app: ${appName}`, 'info', 'deploy');
      } else {
        await this.log(deploymentId, `Using existing Fly.io app: ${appName}`, 'info', 'deploy');
      }
      
      // Deploy using Fly CLI (must be installed on the system)
      const deployCommand = `cd ${repoPath} && fly deploy --app ${appName} --now --auto-confirm`;
      const { stdout, stderr } = await execAsync(deployCommand, {
        env: {
          ...process.env,
          FLY_API_TOKEN: process.env.FLY_API_TOKEN
        }
      });
      
      if (stderr && !stderr.includes('Successfully')) {
        throw new Error(stderr);
      }
      
      await this.log(deploymentId, 'Deployment to Fly.io complete', 'info', 'deploy');
    } catch (error: any) {
      await this.log(deploymentId, `Fly.io deployment error: ${error.message}`, 'error', 'deploy');
      throw error;
    }
  }

  private async updateDeploymentStatus(
    deploymentId: string,
    status: 'pending' | 'building' | 'deploying' | 'active' | 'failed' | 'destroyed'
  ): Promise<void> {
    await db
      .update(deployment)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(deployment.id, deploymentId));
  }

  private async updateDeploymentComplete(
    deploymentId: string,
    appUrl: string
  ): Promise<void> {
    await db
      .update(deployment)
      .set({
        status: 'active',
        flyAppUrl: appUrl,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(deployment.id, deploymentId));
    
    await this.log(deploymentId, `Deployment complete! App URL: ${appUrl}`, 'info', 'deploy');
  }

  private async handleDeploymentError(
    deploymentId: string,
    error: any
  ): Promise<void> {
    await db
      .update(deployment)
      .set({
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(deployment.id, deploymentId));
    
    await this.log(deploymentId, `Deployment failed: ${error.message}`, 'error', 'deploy');
  }

  private async log(
    deploymentId: string,
    message: string,
    level: 'info' | 'warning' | 'error',
    type: 'build' | 'deploy' | 'runtime'
  ): Promise<void> {
    console.log(`[${deploymentId}] ${message}`);
    
    await db.insert(deploymentLog).values({
      deploymentId,
      message,
      level,
      type,
      timestamp: new Date()
    });
  }

  private generateAppName(repoFullName: string, prNumber: number): string {
    const [owner, repo] = repoFullName.split('/');
    const cleanRepo = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cleanOwner = owner.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Fly.io app names must be globally unique and <= 30 chars
    const appName = `pr-${prNumber}-${cleanRepo}`.slice(0, 30);
    
    return appName;
  }

  async destroyDeployment(deploymentId: string): Promise<void> {
    const [deploymentData] = await db
      .select()
      .from(deployment)
      .where(eq(deployment.id, deploymentId))
      .limit(1);
    
    if (!deploymentData) {
      throw new Error('Deployment not found');
    }
    
    try {
      await this.log(deploymentId, 'Destroying deployment', 'info', 'runtime');
      
      // Delete Fly.io app
      await this.flyClient.deleteApp(deploymentData.flyAppName);
      
      // Update deployment status
      await this.updateDeploymentStatus(deploymentId, 'destroyed');
      
      await this.log(deploymentId, 'Deployment destroyed successfully', 'info', 'runtime');
    } catch (error: any) {
      await this.log(deploymentId, `Error destroying deployment: ${error.message}`, 'error', 'runtime');
      throw error;
    }
  }
}