import { useState, type FormEvent } from 'react';
import { authClient, ERROR_GOOGLE } from '../lib/auth';
import { Sonrisa, btnNegro } from '../components/ui';

function errorDeURL() {
  const p = new URLSearchParams(location.search);
  const e = p.get('error');
  if (!e) return '';
  history.replaceState(null, '', location.pathname);
  return ERROR_GOOGLE[e.toLowerCase()] ?? `No se pudo entrar con Google (${e}).`;
}

const LogoGoogle = () => (
  <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export function Login() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(errorDeURL);
  const [enviando, setEnviando] = useState<'' | 'clave' | 'google'>('');

  const conClave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando('clave');
    const { error } = await authClient.signIn.email({ email: email.trim(), password: clave });
    setEnviando('');
    if (error) setError(error.status === 401 ? 'Correo o contraseña incorrectos.' : error.message || 'No se pudo iniciar sesión.');
  };

  const conGoogle = async () => {
    setError('');
    setEnviando('google');
    const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' });
    if (error) {
      setEnviando('');
      setError(error.message?.includes('not found') ? 'El inicio con Google aún no está configurado en el servidor.' : error.message || 'No se pudo abrir Google.');
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink px-4 py-10 text-white">
      <div className="iris aura pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full opacity-25 blur-3xl" aria-hidden />
      <main className="entrar relative w-full max-w-sm">
        <div className="text-center">
          <Sonrisa size={44} className="mx-auto" />
          <p className="wordmark mt-5 text-sm">BLISSENS</p>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Entrar al panel</h1>
          <p className="mt-1 text-sm text-white/55">Recuperación de pacientes · «Tu futura sonrisa»</p>
        </div>

        <div className="mt-8 rounded-[28px] bg-white p-6 text-ink shadow-2xl">
          <button onClick={conGoogle} disabled={!!enviando} className="flex w-full items-center justify-center gap-3 rounded-full border border-ink/12 bg-white px-5 py-2.5 text-sm font-semibold hover:border-ink/35 disabled:opacity-50">
            <LogoGoogle />
            {enviando === 'google' ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>

          <p className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.16em] text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">o</p>

          <form onSubmit={conClave} className="space-y-3">
            <label className="block text-sm font-medium">
              Correo
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1" />
            </label>
            <label className="block text-sm font-medium">
              Contraseña
              <input type="password" required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} className="field mt-1" />
            </label>
            {error && (
              <p role="alert" className="rounded-2xl bg-rojo/10 px-3 py-2 text-sm text-rojo">
                {error}
              </p>
            )}
            <button type="submit" disabled={!!enviando} className={`${btnNegro} w-full`}>
              {enviando === 'clave' ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/65">¿No tienes cuenta? Dirección crea las cuentas del equipo.</p>
      </main>
    </div>
  );
}
