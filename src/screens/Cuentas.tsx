import { useEffect, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, UserPlus } from 'lucide-react';
import type { Profesional } from '../types';
import { authClient, esRol } from '../lib/auth';
import { ESPECIALISTAS } from '../lib/reglas';
import { ROLES, type Rol } from '../lib/roles';
import { Encabezado, Iniciales, Modal, btnChico, btnNegro } from '../components/ui';

interface Cuenta {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  profesional?: string | null;
}

const OPCIONES = Object.entries(ROLES) as [Rol, { nombre: string }][];

// el especialista ve solo la agenda que se le asigne aquí
function SelectAgenda({ valor, onCambio, etiqueta, className = '' }: { valor: string; onCambio: (p: Profesional) => void; etiqueta: string; className?: string }) {
  return (
    <select aria-label={etiqueta} value={valor} onChange={(e) => onCambio(e.target.value as Profesional)} className={`field ${className}`} required>
      <option value="" disabled>
        Elige su agenda…
      </option>
      {ESPECIALISTAS.map((e) => (
        <option key={e}>{e}</option>
      ))}
    </select>
  );
}

export function Cuentas({ yo, onAviso }: { yo: string; onAviso: (t: string) => void }) {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [error, setError] = useState('');
  const [nueva, setNueva] = useState(false);

  const cargar = async () => {
    const { data, error } = await authClient.admin.listUsers({ query: { limit: 500, sortBy: 'name', sortDirection: 'asc' } });
    if (error) setError(error.message || 'No se pudieron leer las cuentas.');
    else setCuentas(data.users as Cuenta[]);
  };
  useEffect(() => {
    cargar();
  }, []);

  const cambiar = async (accion: Promise<{ error: { message?: string } | null }>, texto: string) => {
    const { error } = await accion;
    if (error) return onAviso(error.message || 'No se pudo guardar el cambio');
    onAviso(texto);
    cargar();
  };

  return (
    <div className="space-y-8">
      <Encabezado titulo="Cuentas del equipo" descripcion="Quién entra al panel y qué ve cada persona. Con Google solo entra quien ya tiene cuenta aquí con ese correo.">
        <button onClick={() => setNueva(true)} className={btnNegro}>
          <UserPlus className="size-4" /> Nueva cuenta
        </button>
      </Encabezado>

      {error && <p className="rounded-2xl bg-rojo/10 px-4 py-3 text-sm text-rojo">{error}</p>}
      {!cuentas && !error && <p className="text-sm text-muted">Cargando cuentas…</p>}

      {cuentas && (
        <ul className="card escalonado divide-y divide-line overflow-hidden">
          {cuentas.map((c) => {
            const propia = c.id === yo;
            return (
              <li key={c.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${c.banned ? 'opacity-55' : ''}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Iniciales nombre={c.name || c.email} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {c.name} {propia && <span className="text-xs font-normal text-muted">(tú)</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{c.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.role === 'especialista' && (
                    <SelectAgenda
                      etiqueta={`Agenda de ${c.name}`}
                      valor={c.profesional ?? ''}
                      onCambio={(p) => cambiar(authClient.admin.updateUser({ userId: c.id, data: { profesional: p } }), `${c.name} ve ahora la agenda de ${p}`)}
                      className={`w-auto py-1.5 ${c.profesional ? '' : 'border-amarillo'}`}
                    />
                  )}
                  <select
                    aria-label={`Rol de ${c.name}`}
                    value={esRol(c.role) ? c.role : ''}
                    disabled={propia}
                    onChange={(e) => cambiar(authClient.admin.setRole({ userId: c.id, role: e.target.value as Rol }), `Rol de ${c.name} actualizado`)}
                    className="field w-auto py-1.5"
                  >
                    {!esRol(c.role) && <option value="">Sin rol</option>}
                    {OPCIONES.map(([r, x]) => (
                      <option key={r} value={r}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={propia}
                    onClick={() =>
                      c.banned
                        ? cambiar(authClient.admin.unbanUser({ userId: c.id }), `${c.name} puede volver a entrar`)
                        : confirm(`${c.name} no podrá entrar al panel y se cerrarán sus sesiones. ¿Continuar?`) &&
                          cambiar(authClient.admin.banUser({ userId: c.id }), `${c.name} ya no puede entrar`)
                    }
                    className={`${btnChico} ${c.banned ? 'bg-ink text-white' : 'bg-soft text-ink/70 hover:text-ink'} disabled:invisible`}
                  >
                    {c.banned ? 'Reactivar' : 'Desactivar'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="t-roles">
        <h2 id="t-roles" className="text-lg font-semibold">
          Qué hace y qué ve cada rol
        </h2>
        <p className="text-sm text-muted">Cada persona entra a un inicio con sus responsabilidades. Lo que no es de su rol no aparece.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {OPCIONES.map(([r]) => {
            const d = ROLES[r];
            return (
              <article key={r} className="card rounded-[22px] p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: d.color }} aria-hidden />
                  {d.nombre}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{d.quien}</p>
                <p className="mt-2 text-sm text-ink/75">{d.proposito}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {d.ve.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Eye className="mt-0.5 size-4 shrink-0 text-verde" aria-hidden />
                      <span>
                        <span className="sr-only">Ve: </span>
                        {x}
                      </span>
                    </li>
                  ))}
                  {d.noVe.map((x) => (
                    <li key={x} className="flex gap-2 text-ink/60">
                      <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        <span className="sr-only">No ve: </span>
                        {x}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <Modal abierto={nueva} onCerrar={() => setNueva(false)} titulo="Nueva cuenta" ancho="max-w-md">
        <NuevaCuenta
          onCreada={(nombre) => {
            setNueva(false);
            onAviso(`Cuenta de ${nombre} creada`);
            cargar();
          }}
        />
      </Modal>
    </div>
  );
}

function NuevaCuenta({ onCreada }: { onCreada: (nombre: string) => void }) {
  const [f, setF] = useState({ name: '', email: '', role: 'auxiliar' as Rol, password: '', profesional: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const { error } = await authClient.admin.createUser({
      name: f.name.trim(),
      email: f.email.trim().toLowerCase(),
      role: f.role,
      password: f.password || undefined, // sin contraseña: solo entra con Google
      data: f.role === 'especialista' ? { emailVerified: true, profesional: f.profesional } : { emailVerified: true },
    });
    setEnviando(false);
    if (error) setError(error.message?.includes('already exists') ? 'Ya existe una cuenta con ese correo.' : error.message || 'No se pudo crear la cuenta.');
    else onCreada(f.name.trim());
  };

  return (
    <form onSubmit={crear} className="space-y-4 p-6 sm:p-8">
      <h2 className="text-xl font-bold">Nueva cuenta</h2>
      <label className="block text-sm font-medium">
        Nombre
        <input required {...campo('name')} className="field mt-1" />
      </label>
      <label className="block text-sm font-medium">
        Correo
        <input type="email" required {...campo('email')} className="field mt-1" />
      </label>
      <label className="block text-sm font-medium">
        Rol
        <select {...campo('role')} className="field mt-1">
          {OPCIONES.map(([r, x]) => (
            <option key={r} value={r}>
              {x.nombre}
            </option>
          ))}
        </select>
        <span className="mt-2 block rounded-2xl bg-soft p-3 text-xs font-normal leading-relaxed text-ink/75">
          <b className="font-semibold">{ROLES[f.role].proposito}</b>
          {ROLES[f.role].hace.map((x) => (
            <span key={x} className="mt-1 flex gap-1.5">
              <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {x}
            </span>
          ))}
        </span>
      </label>
      {f.role === 'especialista' && (
        <label className="block text-sm font-medium">
          Agenda del especialista
          <SelectAgenda etiqueta="Agenda del especialista" valor={f.profesional} onCambio={(p) => setF({ ...f, profesional: p })} className="mt-1" />
          <span className="mt-1 block text-xs font-normal text-muted">Verá solo los pacientes y cupos de esta agenda.</span>
        </label>
      )}
      <label className="block text-sm font-medium">
        Contraseña <span className="font-normal text-muted">(opcional)</span>
        <input type="password" minLength={8} autoComplete="new-password" {...campo('password')} className="field mt-1" />
        <span className="mt-1 block text-xs font-normal text-muted">Déjala vacía si la persona entrará con su cuenta de Google.</span>
      </label>
      {error && <p className="rounded-2xl bg-rojo/10 px-3 py-2 text-sm text-rojo">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={enviando} className={btnNegro}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>
    </form>
  );
}
