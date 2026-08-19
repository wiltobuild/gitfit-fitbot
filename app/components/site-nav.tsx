import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";

export default async function SiteNav() {
  const session = await getSession();

  return (
    <nav className="nav" aria-label="Main navigation">
      <Link className="brand" href="/" aria-label="GitFit home">
        <span className="brand-mark">G</span>
        <span>GitFit</span>
      </Link>
      <div className="nav-actions">
        {session ? (
          <>
            <span className="nav-email">{session.user.email}</span>
            <form action={signOut}>
              <button className="text-link nav-sign-out" type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <Link className="text-link" href="/sign-in">Sign in</Link>
            <Link className="button button-primary nav-sign-up" href="/sign-up">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
