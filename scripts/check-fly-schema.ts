import 'dotenv/config';

async function checkSchema() {
  const apiToken = process.env.FLY_API_TOKEN;
  if (!apiToken) {
    console.error('FLY_API_TOKEN not set');
    process.exit(1);
  }

  const query = `
    query {
      __type(name: "DeleteAppPayload") {
        fields {
          name
          type {
            name
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
    console.log('DeleteAppPayload fields:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();