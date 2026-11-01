import { authConfigured } from "@/lib/crm/auth";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login">
      <form className="card" action={login}>
        <div className="brand" style={{ padding: 0 }}>AI Assist<small>Sign in to your dashboard</small></div>
        {!authConfigured() ? (
          <p className="err">Set DASHBOARD_PASSWORD (8+ characters) in your Vercel environment variables, then redeploy.</p>
        ) : (
          <>
            <input type="password" name="password" placeholder="Password" autoComplete="current-password" autoFocus required />
            {error && <p className="err">Wrong password.</p>}
            <button className="btn primary" type="submit">Sign in</button>
          </>
        )}
      </form>
    </div>
  );
}
