interface FlyApiConfig {
  apiToken: string;
  orgId: string;
  apiUrl?: string;
}

interface FlyApp {
  id: string;
  name: string;
  organization: {
    slug: string;
  };
  status: string;
  hostname: string;
  createdAt: string;
}

interface CreateAppInput {
  app_name: string;
  org_slug: string;
}


export class FlyClient {
  private apiToken: string;
  private orgId: string;
  private apiUrl: string;

  constructor(config: FlyApiConfig) {
    this.apiToken = config.apiToken;
    this.orgId = config.orgId;
    this.apiUrl = config.apiUrl || 'https://api.fly.io';
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fly.io API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Create a new Fly app
  async createApp(name: string): Promise<FlyApp> {
    const mutation = `
      mutation CreateApp($input: CreateAppInput!) {
        createApp(input: $input) {
          app {
            id
            name
            organization {
              slug
            }
            status
            hostname
            createdAt
          }
        }
      }
    `;

    const variables = {
      input: {
        name: name,
        organizationId: this.orgId,
      }
    };

    const response = await this.request<any>('/graphql', {
      method: 'POST',
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (response.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
    }

    return response.data.createApp.app;
  }

  // Get app details
  async getApp(name: string): Promise<FlyApp | null> {
    const query = `
      query GetApp($name: String!) {
        app(name: $name) {
          id
          name
          organization {
            slug
          }
          status
          hostname
          createdAt
        }
      }
    `;

    try {
      const response = await this.request<any>('/graphql', {
        method: 'POST',
        body: JSON.stringify({ query, variables: { name } }),
      });

      if (response.errors) {
        if (response.errors[0]?.message?.includes('Could not find App')) {
          return null;
        }
        throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
      }

      return response.data.app;
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('Could not find App')) {
        return null;
      }
      throw error;
    }
  }

  // Delete an app
  async deleteApp(name: string): Promise<void> {
    const mutation = `
      mutation DeleteApp($appId: ID!) {
        deleteApp(appId: $appId) {
          organization {
            id
          }
        }
      }
    `;

    // First get the app to get its ID
    const app = await this.getApp(name);
    if (!app) {
      throw new Error(`App ${name} not found`);
    }

    const response = await this.request<any>('/graphql', {
      method: 'POST',
      body: JSON.stringify({ 
        query: mutation, 
        variables: { appId: app.id } 
      }),
    });

    if (response.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
    }
  }

  // Set secrets (environment variables)
  async setSecrets(
    appName: string,
    secrets: Record<string, string>
  ): Promise<void> {
    const mutation = `
      mutation SetSecrets($input: SetSecretsInput!) {
        setSecrets(input: $input) {
          app {
            id
          }
        }
      }
    `;

    // First get the app to get its ID
    const app = await this.getApp(appName);
    if (!app) {
      throw new Error(`App ${appName} not found`);
    }

    const secretsArray = Object.entries(secrets).map(([key, value]) => ({
      key,
      value
    }));

    const response = await this.request<any>('/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            appId: app.id,
            secrets: secretsArray
          }
        }
      }),
    });

    if (response.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
    }
  }
}

// Singleton instance
let flyClient: FlyClient | null = null;

export function getFlyClient(): FlyClient {
  if (!flyClient) {
    const apiToken = process.env.FLY_API_TOKEN;
    const orgId = process.env.FLY_ORG_ID || 'RVLZQkpYjPL7yTyD6ne82l5gq8TRDRLnR'; // Your org ID

    if (!apiToken) {
      throw new Error('FLY_API_TOKEN environment variable is required');
    }

    flyClient = new FlyClient({
      apiToken,
      orgId,
    });
  }

  return flyClient;
}