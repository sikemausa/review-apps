import 'dotenv/config';

async function getFlyOrg() {
  const apiToken = process.env.FLY_API_TOKEN;
  if (!apiToken) {
    console.error('FLY_API_TOKEN not set');
    process.exit(1);
  }

  const query = `
    query {
      viewer {
        organizations {
          nodes {
            id
            slug
            name
            type
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.fly.io/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return;
    }

    console.log('Your Fly.io Organizations:\n');
    result.data.viewer.organizations.nodes.forEach((org: any) => {
      console.log(`ID: ${org.id}`);
      console.log(`Slug: ${org.slug}`);
      console.log(`Name: ${org.name}`);
      console.log(`Type: ${org.type}`);
      console.log('---');
    });

    console.log('\nUpdate your .env file with the organization ID (not slug)');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

getFlyOrg();