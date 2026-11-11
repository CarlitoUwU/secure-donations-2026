import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

export type Role = 'DONANTE' | 'GESTOR' | 'AUDITOR';

export function createSession(issuer: string, domain: string, clientId: string, audience: string) {
  const loginDomain = new URL(domain).origin;
  const returnUrl = new URL('/', location.origin).href;
  const manager = new UserManager({
    authority: issuer,
    client_id: clientId,
    redirect_uri: new URL('/auth/callback', location.origin).href,
    response_type: 'code',
    resource: audience,
    scope: 'openid api/projects.write api/donations.write api/donations.read',
    automaticSilentRenew: false,
    loadUserInfo: false,
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: sessionStorage }),
    metadataSeed: { revocation_endpoint: `${loginDomain}/oauth2/revoke` },
  });
  let user: User | null = null;
  let refresh: Promise<User | null> | undefined;
  let signingOut = false;
  const listeners = new Set<() => void>();

  function update(nextUser: User | null) {
    user = nextUser;
    listeners.forEach((listener) => listener());
  }

  function hasRole(role: Role) {
    const groups = user?.profile['cognito:groups'];
    return Array.isArray(groups) && groups.includes(role);
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    snapshot: () => user,
    hasRole,
    signIn: () => manager.signinRedirect(),
    async completeSignIn() {
      update(await manager.signinRedirectCallback());
    },
    async accessToken() {
      if (!user || signingOut) throw new Response(null, { status: 401 });
      if (!user.expired) return user.access_token;

      refresh ??= (async () => {
        try {
          const next = user?.refresh_token ? await manager.signinSilent() : null;
          if (!signingOut) update(next);
          return next;
        } catch {
          update(null);
          return null;
        } finally {
          refresh = undefined;
        }
      })();
      const next = await refresh;
      if (!next || signingOut) throw new Response(null, { status: 401 });
      return next.access_token;
    },
    async signOut() {
      signingOut = true;
      update(null);
      try {
        await refresh;
        await manager.revokeTokens(['refresh_token']);
      } finally {
        await manager.removeUser();
        const url = new URL('/logout', loginDomain);
        url.search = new URLSearchParams({ client_id: clientId, logout_uri: returnUrl }).toString();
        location.assign(url);
      }
    },
  };
}

export type Session = ReturnType<typeof createSession>;
