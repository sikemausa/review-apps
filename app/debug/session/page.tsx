'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function SessionDebugPage() {
  const [session, setSession] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get session
    authClient.getSession().then(({ data, error }) => {
      if (error || !data) {
        router.push('/login');
      } else {
        setSession(data);
      }
      setLoading(false);
    });

    // Get cookie value
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('better-auth-session='));
    if (sessionCookie) {
      setToken(sessionCookie.split('=')[1]);
    }
  }, [router]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
    alert('Session token copied to clipboard!');
  };

  if (loading) return <div>Loading...</div>;
  if (!session) return null;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Session Debug Info</h1>
      
      <h2>User Info:</h2>
      <pre>{JSON.stringify(session.user, null, 2)}</pre>
      
      <h2>Session Token:</h2>
      <div style={{ 
        background: '#f0f0f0', 
        padding: '10px', 
        borderRadius: '5px',
        wordBreak: 'break-all',
        marginBottom: '10px'
      }}>
        {token || 'No session token found'}
      </div>
      
      {token && (
        <button 
          onClick={copyToClipboard}
          style={{
            padding: '10px 20px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Copy Token
        </button>
      )}
      
      <h3 style={{ marginTop: '20px' }}>Use this token in scripts:</h3>
      <code style={{ background: '#f0f0f0', padding: '10px', display: 'block' }}>
        npx tsx scripts/create-test-project.ts {token || 'YOUR_TOKEN_HERE'}
      </code>
    </div>
  );
}