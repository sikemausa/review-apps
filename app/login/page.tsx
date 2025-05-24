'use client';

import { authClient } from '@/src/lib/auth-client';

export default function LoginPage() {
  const handleGitHubLogin = async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: '/dashboard'
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Login</h1>
      <p>Sign in with your GitHub account to continue</p>
      <button onClick={handleGitHubLogin} style={{ marginTop: '20px', padding: '10px 20px' }}>
        Sign in with GitHub
      </button>
    </div>
  );
}