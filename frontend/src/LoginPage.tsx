import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Session } from './auth';

export function LoginPage({ session }: { session?: Session }) {
  const [query] = useSearchParams();
  const [failed, setFailed] = useState(query.has('error'));
  const [pending, setPending] = useState(false);

  async function startLogin() {
    if (!session) return;
    setPending(true);
    setFailed(false);
    try {
      await session.signIn();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <section className="demo-page">
      <h1 tabIndex={-1}>Iniciar sesión</h1>
      {failed && <p role="alert">No pudimos iniciar tu sesión. Inténtalo de nuevo.</p>}
      {session ? (
        <button className="action-button detail-action" type="button" onClick={() => void startLogin()} disabled={pending}>
          {pending ? 'Abriendo el inicio de sesión…' : 'Continuar con mi cuenta'}
        </button>
      ) : <p>El inicio de sesión aún no está disponible.</p>}
    </section>
  );
}
