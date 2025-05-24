export default function Home() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>GitHub Auth Test App</h1>
      <p>Sign in with GitHub to access the app:</p>
      <div style={{ marginTop: '20px' }}>
        <a href="/login" style={{ marginRight: '10px' }}>Login with GitHub</a>
        <a href="/dashboard">Dashboard</a>
      </div>
    </div>
  );
}