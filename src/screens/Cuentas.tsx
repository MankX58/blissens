import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarClock, Check, Coffee, Eye, EyeOff, Palmtree, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import type { Ausencia, Equipo, Franja, Pausa, Profesional } from '../types';
import { api } from '../lib/api';
import { authClient, esRol } from '../lib/auth';
import { ESPECIALISTAS, fechaCorta } from '../lib/reglas';
import { ROLES, type Rol } from '../lib/roles';
import { Encabezado, Iniciales, Modal, btnBorde, btnChico, btnNegro } from '../components/ui';

interface Cuenta {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  profesional?: string | null;
}

const OPCIONES = Object.entries(ROLES) as [Rol, { nombre: string }][];
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MOTIVOS = ['Vacaciones', 'Incapacidad', 'Permiso', 'Capacitación'];
const rango = (a: Ausencia) => (a.desde === a.hasta ? fechaCorta(a.desde) : `${fechaCorta(a.desde)} – ${fechaCorta(a.hasta)}`);

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

// resumen corto del horario: "Lun–Vie 08:00–17:00 · Sáb 08:00–12:00"
export function resumenHorario(franjas: Franja[]) {
  if (!franjas.length) return '';
  const grupos: { dias: number[]; t: string }[] = [];
  for (const f of franjas) {
    const t = `${f.inicio}–${f.fin}`;
    const g = grupos.at(-1);
    if (g && g.t === t && g.dias.at(-1) === f.dia - 1) g.dias.push(f.dia);
    else grupos.push({ dias: [f.dia], t });
  }
  const d = (i: number) => DIAS[i].slice(0, 3);
  return grupos.map((g) => `${g.dias.length > 1 ? `${d(g.dias[0])}–${d(g.dias.at(-1)!)}` : d(g.dias[0])} ${g.t}`).join(' · ');
}

type Dialogo = { tipo: 'editar' | 'vacaciones' | 'horario'; c: Cuenta } | { tipo: 'nueva' } | null;

// onEquipo: horarios, descansos o vacaciones cambiaron; el panel se recarga para recalcular la agenda libre
export function Cuentas({ yo, hoy, onAviso, onEquipo }: { yo: string; hoy: string; onAviso: (t: string) => void; onEquipo: () => void }) {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [error, setError] = useState('');
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);

  const cargar = async () => {
    const { data, error } = await authClient.admin.listUsers({ query: { limit: 500, sortBy: 'name', sortDirection: 'asc' } });
    if (error) setError(error.message || 'No se pudieron leer las cuentas.');
    else setCuentas(data.users as Cuenta[]);
  };
  const trasCambio = (t: string) => {
    onAviso(t);
    cargarEquipo();
    onEquipo();
  };
  const cargarEquipo = () =>
    api
      .equipo()
      .then(setEquipo)
      .catch((e: Error) => setError(`Horarios y vacaciones: ${e.message}`));
  useEffect(() => {
    cargar();
    cargarEquipo();
  }, []);

  const cambiar = async (accion: Promise<{ error: { message?: string } | null }>, texto: string) => {
    const { error } = await accion;
    if (error) return onAviso(error.message || 'No se pudo guardar el cambio');
    onAviso(texto);
    cargar();
  };

  const ausenciasDe = (id: string) => (equipo?.ausencias ?? []).filter((a) => a.userId === id && a.hasta >= hoy);

  return (
    <div className="space-y-10">
      <Encabezado titulo="Equipo" descripcion="Quién entra al panel y qué ve, el horario de cada especialista, los descansos de la clínica y las vacaciones. Con todo esto se calcula la agenda libre.">
        <button onClick={() => setDialogo({ tipo: 'nueva' })} className={btnNegro}>
          <UserPlus className="size-4" /> Nueva cuenta
        </button>
      </Encabezado>

      {error && <p className="rounded-2xl bg-rojo/10 px-4 py-3 text-sm text-rojo">{error}</p>}
      {!cuentas && !error && <p className="text-sm text-muted">Cargando cuentas…</p>}

      {cuentas && (
        <ul className="card escalonado divide-y divide-line overflow-hidden">
          {cuentas.map((c) => {
            const propia = c.id === yo;
            const ausente = ausenciasDe(c.id);
            const ahora = ausente.find((a) => a.desde <= hoy);
            const horario = c.role === 'especialista' && c.profesional ? equipo?.horarios[c.profesional as Profesional] : undefined;
            return (
              <li key={c.id} className={`flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center ${c.banned ? 'opacity-55' : ''}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Iniciales nombre={c.name || c.email} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {c.name} {propia && <span className="text-xs font-normal text-muted">(tú)</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{c.email}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      {ahora && <span className="rounded-full bg-amarillo/15 px-2 py-0.5 text-amarillo">{ahora.motivo} hasta el {fechaCorta(ahora.hasta)}</span>}
                      {ausente
                        .filter((a) => a !== ahora)
                        .slice(0, 2)
                        .map((a) => (
                          <span key={a.id} className="rounded-full bg-soft px-2 py-0.5 text-ink/70">
                            {a.motivo}: {rango(a)}
                          </span>
                        ))}
                      {horario && (
                        <span className={`rounded-full px-2 py-0.5 ${horario.length ? 'bg-soft text-ink/70' : 'bg-amarillo/15 text-amarillo'}`}>
                          {horario.length ? resumenHorario(horario) : 'Sin horario: no se calcula su agenda libre'}
                        </span>
                      )}
                    </p>
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
                  <Boton icono={Pencil} onClick={() => setDialogo({ tipo: 'editar', c })} etiqueta={`Editar datos de ${c.name}`}>
                    Editar
                  </Boton>
                  <Boton icono={Palmtree} onClick={() => setDialogo({ tipo: 'vacaciones', c })} etiqueta={`Vacaciones de ${c.name}`}>
                    Vacaciones
                  </Boton>
                  {c.role === 'especialista' && c.profesional && (
                    <Boton icono={CalendarClock} onClick={() => setDialogo({ tipo: 'horario', c })} etiqueta={`Horario de ${c.name}`}>
                      Horario
                    </Boton>
                  )}
                  <button
                    disabled={propia}
                    onClick={() =>
                      c.banned
                        ? cambiar(authClient.admin.unbanUser({ userId: c.id }), `${c.name} puede volver a entrar`)
                        : confirm(`${c.name} no podrá entrar al panel y se cerrarán sus sesiones. ¿Continuar?`) &&
                          cambiar(authClient.admin.banUser({ userId: c.id }), `${c.name} ya no puede entrar`)
                    }
                    className={`${btnChico} ${c.banned ? 'bg-ink text-white' : 'text-muted hover:bg-soft hover:text-rojo'} disabled:invisible`}
                  >
                    {c.banned ? 'Reactivar' : 'Desactivar'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {equipo && <Descansos pausas={equipo.pausas} onGuardado={trasCambio} />}

      <section aria-labelledby="t-roles">
        <h2 id="t-roles" className="text-lg font-semibold">
          Qué hace y qué ve cada rol
        </h2>
        <p className="text-sm text-muted">Cada persona entra a un inicio con sus responsabilidades. Lo que no es de su rol no aparece.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
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

      <Modal abierto={dialogo?.tipo === 'nueva'} onCerrar={cerrar} titulo="Nueva cuenta" ancho="max-w-md">
        <NuevaCuenta
          onCreada={(nombre) => {
            cerrar();
            onAviso(`Cuenta de ${nombre} creada`);
            cargar();
          }}
        />
      </Modal>
      {dialogo && dialogo.tipo !== 'nueva' && (
        <Modal abierto onCerrar={cerrar} titulo={`${dialogo.c.name}`} ancho="max-w-md">
          {dialogo.tipo === 'editar' && (
            <EditarCuenta
              c={dialogo.c}
              onGuardada={(t) => {
                cerrar();
                onAviso(t);
                cargar();
              }}
            />
          )}
          {dialogo.tipo === 'vacaciones' && (
            <Vacaciones
              c={dialogo.c}
              hoy={hoy}
              ausencias={(equipo?.ausencias ?? []).filter((a) => a.userId === dialogo.c.id)}
              onCambio={trasCambio}
            />
          )}
          {dialogo.tipo === 'horario' && (
            <Horario
              c={dialogo.c}
              franjas={equipo?.horarios[dialogo.c.profesional as Profesional] ?? []}
              onGuardado={(t) => {
                cerrar();
                trasCambio(t);
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function Boton({ icono: Icono, onClick, etiqueta, children }: { icono: typeof Pencil; onClick: () => void; etiqueta: string; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={etiqueta} className={`${btnChico} bg-soft text-ink/75 hover:text-ink`}>
      <Icono className="size-3.5" aria-hidden /> {children}
    </button>
  );
}

function Formulario({ titulo, sub, onSubmit, children }: { titulo: string; sub?: string; onSubmit: (e: FormEvent) => void; children: ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-bold">{titulo}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </form>
  );
}

const MensajeError = ({ texto }: { texto: string }) => (texto ? <p className="rounded-2xl bg-rojo/10 px-3 py-2 text-sm text-rojo">{texto}</p> : null);

// ---------- editar nombre, correo y contraseña ----------
function EditarCuenta({ c, onGuardada }: { c: Cuenta; onGuardada: (t: string) => void }) {
  const [f, setF] = useState({ name: c.name, email: c.email, password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const email = f.email.trim().toLowerCase();
    const cambios = { ...(f.name.trim() !== c.name && { name: f.name.trim() }), ...(email !== c.email && { email }) };
    if (Object.keys(cambios).length) {
      const { error } = await authClient.admin.updateUser({ userId: c.id, data: cambios });
      if (error) {
        setEnviando(false);
        return setError(error.message?.toLowerCase().includes('exist') ? 'Ya existe otra cuenta con ese correo.' : error.message || 'No se pudo guardar.');
      }
    }
    if (f.password) {
      const { error } = await authClient.admin.setUserPassword({ userId: c.id, newPassword: f.password });
      if (error) {
        setEnviando(false);
        return setError(error.message || 'No se pudo cambiar la contraseña.');
      }
    }
    setEnviando(false);
    onGuardada(f.password ? `Datos y contraseña de ${f.name.trim()} actualizados` : `Datos de ${f.name.trim()} actualizados`);
  };

  return (
    <Formulario titulo="Editar cuenta" sub={c.name} onSubmit={guardar}>
      <label className="block text-sm font-medium">
        Nombre
        <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="field mt-1" />
      </label>
      <label className="block text-sm font-medium">
        Correo
        <input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="field mt-1" />
        <span className="mt-1 block text-xs font-normal text-muted">Si entra con Google, debe ser el mismo correo de su cuenta de Google.</span>
      </label>
      <label className="block text-sm font-medium">
        Nueva contraseña <span className="font-normal text-muted">(opcional)</span>
        <input type="password" minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="field mt-1" />
        <span className="mt-1 block text-xs font-normal text-muted">Déjala vacía para no cambiarla. Mínimo 8 caracteres.</span>
      </label>
      <MensajeError texto={error} />
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={enviando} className={btnNegro}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Formulario>
  );
}

// ---------- vacaciones: un rango de fechas por registro ----------
function Vacaciones({ c, hoy, ausencias, onCambio }: { c: Cuenta; hoy: string; ausencias: Ausencia[]; onCambio: (t: string) => void }) {
  const [f, setF] = useState({ desde: hoy, hasta: hoy, motivo: MOTIVOS[0] });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    if (f.hasta < f.desde) return setError('La fecha final no puede ser antes de la inicial.');
    setError('');
    setEnviando(true);
    try {
      await api.registrarAusencia({ userId: c.id, ...f });
      onCambio(`${f.motivo} de ${c.name} registradas: ${fechaCorta(f.desde)} – ${fechaCorta(f.hasta)}`);
    } catch (err) {
      setError((err as Error).message);
    }
    setEnviando(false);
  };
  const borrar = async (a: Ausencia) => {
    try {
      await api.borrarAusencia(a.id);
      onCambio(`${a.motivo} de ${c.name} (${rango(a)}) eliminadas`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Formulario
      titulo="Registrar tiempo de vacaciones"
      sub={c.role === 'especialista' ? `${c.name}. En esas fechas no se calcula tiempo libre en su agenda.` : c.name}
      onSubmit={registrar}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Desde
          <input type="date" required value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value, hasta: f.hasta < e.target.value ? e.target.value : f.hasta })} className="field mt-1" />
        </label>
        <label className="block text-sm font-medium">
          Hasta
          <input type="date" required min={f.desde} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} className="field mt-1" />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Motivo
        <select value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} className="field mt-1">
          {MOTIVOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <MensajeError texto={error} />
      <div className="flex justify-end">
        <button type="submit" disabled={enviando} className={btnNegro}>
          <Palmtree className="size-4" aria-hidden /> {enviando ? 'Registrando…' : 'Registrar'}
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-sm font-semibold">Registradas</p>
        {ausencias.length ? (
          <ul className="mt-2 divide-y divide-line">
            {ausencias.map((a) => (
              <li key={a.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${a.hasta < hoy ? 'text-muted' : ''}`}>
                <span>
                  <b className="font-medium">{a.motivo}</b> · {rango(a)}
                  {a.hasta < hoy && ' (pasadas)'}
                </span>
                <button type="button" onClick={() => borrar(a)} aria-label={`Eliminar ${a.motivo} ${rango(a)}`} className="rounded-full p-1.5 text-muted hover:bg-soft hover:text-rojo">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Ninguna todavía.</p>
        )}
      </div>
    </Formulario>
  );
}

// ---------- horario semanal del especialista (una franja por día; el almuerzo va en Descansos) ----------
function Horario({ c, franjas, onGuardado }: { c: Cuenta; franjas: Franja[]; onGuardado: (t: string) => void }) {
  const inicial = DIAS.map((_, dia) => {
    const f = franjas.find((x) => x.dia === dia);
    return { activo: !!f, inicio: f?.inicio ?? '08:00', fin: f?.fin ?? '17:00' };
  });
  const [dias, setDias] = useState(inicial);
  const [error, setError] = useState('');
  const poner = (i: number, cambio: Partial<(typeof inicial)[number]>) => setDias(dias.map((d, j) => (j === i ? { ...d, ...cambio } : d)));
  // rellena con el horario que se deduce de sus citas (gerencia lo revisa antes de guardar)
  const sugerido = async () => {
    try {
      const s = await api.horarioSugerido();
      const franjas = s.horarios[c.profesional as Profesional] ?? [];
      if (!franjas.length) return setError('No hay suficientes citas con hora de esta agenda para sugerir un horario.');
      setError('');
      setDias(DIAS.map((_, dia) => {
        const f = franjas.find((x) => x.dia === dia);
        return { activo: !!f, inicio: f?.inicio ?? '08:00', fin: f?.fin ?? '17:00' };
      }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const malo = dias.findIndex((d) => d.activo && d.inicio >= d.fin);
    if (malo >= 0) return setError(`${DIAS[malo]}: la hora de inicio debe ser antes de la de fin.`);
    try {
      await api.guardarHorario(
        c.profesional as Profesional,
        dias.flatMap((d, dia) => (d.activo ? [{ dia, inicio: d.inicio, fin: d.fin }] : []))
      );
      onGuardado(`Horario de ${c.profesional} guardado: su agenda libre se recalcula`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Formulario titulo="Horario de atención" sub={`${c.profesional}. Los descansos de la clínica se descuentan solos.`} onSubmit={guardar}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={sugerido} className={`${btnChico} bg-ink text-white`}>
          Según las citas cargadas
        </button>
        <button type="button" onClick={() => setDias(DIAS.map((_, i) => ({ activo: i < 5, inicio: '08:00', fin: '17:00' })))} className={`${btnChico} bg-soft text-ink/75 hover:text-ink`}>
          Lunes a viernes, 8:00 a 17:00
        </button>
      </div>
      <ul className="divide-y divide-line">
        {dias.map((d, i) => (
          <li key={DIAS[i]} className="flex items-center gap-3 py-2">
            <label className="flex w-24 shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium">
              <input type="checkbox" checked={d.activo} onChange={(e) => poner(i, { activo: e.target.checked })} className="size-4 accent-ink" />
              {DIAS[i]}
            </label>
            {d.activo ? (
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input type="time" aria-label={`${DIAS[i]}: desde`} value={d.inicio} onChange={(e) => poner(i, { inicio: e.target.value })} className="field min-w-0 flex-1 px-2.5 py-1.5" />
                <span className="text-muted">a</span>
                <input type="time" aria-label={`${DIAS[i]}: hasta`} value={d.fin} onChange={(e) => poner(i, { fin: e.target.value })} className="field min-w-0 flex-1 px-2.5 py-1.5" />
              </span>
            ) : (
              <span className="text-sm text-muted">No atiende</span>
            )}
          </li>
        ))}
      </ul>
      <MensajeError texto={error} />
      <div className="flex justify-end">
        <button type="submit" className={btnNegro}>
          Guardar horario
        </button>
      </div>
    </Formulario>
  );
}

// ---------- descansos de la clínica: nunca cuentan como agenda libre ----------
function Descansos({ pausas, onGuardado }: { pausas: Pausa[]; onGuardado: (t: string) => void }) {
  const [lista, setLista] = useState(pausas);
  const [error, setError] = useState('');
  useEffect(() => setLista(pausas), [pausas]);
  const cambiada = JSON.stringify(lista) !== JSON.stringify(pausas);
  const poner = (i: number, cambio: Partial<Pausa>) => setLista(lista.map((p, j) => (j === i ? { ...p, ...cambio } : p)));

  const guardar = async () => {
    const malo = lista.find((p) => !p.nombre.trim() || p.inicio >= p.fin);
    if (malo) return setError('Cada descanso necesita un nombre y una hora de inicio antes de la de fin.');
    setError('');
    try {
      await api.guardarPausas(lista);
      onGuardado('Descansos guardados: la agenda libre se recalcula');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section aria-labelledby="t-descansos" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="t-descansos" className="flex items-center gap-2 text-lg font-semibold">
            <Coffee className="size-5 text-ink/60" aria-hidden /> Descansos de la clínica
          </h2>
          <p className="text-sm text-muted">Almuerzo y pausas de todos los días. Esas horas nunca se ofrecen como agenda libre.</p>
        </div>
        <button onClick={() => setLista([...lista, { nombre: lista.length ? 'Pausa' : 'Almuerzo', inicio: '12:00', fin: '13:00' }])} className={btnBorde}>
          <Plus className="size-4" /> Agregar descanso
        </button>
      </div>
      {lista.length ? (
        <ul className="mt-4 space-y-2">
          {lista.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input aria-label="Nombre del descanso" value={p.nombre} onChange={(e) => poner(i, { nombre: e.target.value })} className="field w-40 py-1.5" />
              <input type="time" aria-label={`${p.nombre}: desde`} value={p.inicio} onChange={(e) => poner(i, { inicio: e.target.value })} className="field w-auto py-1.5" />
              <span className="text-sm text-muted">a</span>
              <input type="time" aria-label={`${p.nombre}: hasta`} value={p.fin} onChange={(e) => poner(i, { fin: e.target.value })} className="field w-auto py-1.5" />
              <button onClick={() => setLista(lista.filter((_, j) => j !== i))} aria-label={`Quitar ${p.nombre}`} className="rounded-full p-1.5 text-muted hover:bg-soft hover:text-rojo">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-soft px-4 py-3 text-sm text-muted">Sin descansos: todo el horario de cada especialista cuenta como tiempo de atención.</p>
      )}
      <MensajeError texto={error} />
      {cambiada && (
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setLista(pausas)} className={btnBorde}>
            Descartar
          </button>
          <button onClick={guardar} className={btnNegro}>
            <Check className="size-4" /> Guardar descansos
          </button>
        </div>
      )}
    </section>
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
    <Formulario titulo="Nueva cuenta" onSubmit={crear}>
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
          <span className="mt-1 block text-xs font-normal text-muted">Verá solo los pacientes y cupos de esta agenda. Su horario se define después con el botón «Horario».</span>
        </label>
      )}
      <label className="block text-sm font-medium">
        Contraseña <span className="font-normal text-muted">(opcional)</span>
        <input type="password" minLength={8} autoComplete="new-password" {...campo('password')} className="field mt-1" />
        <span className="mt-1 block text-xs font-normal text-muted">Déjala vacía si la persona entrará con su cuenta de Google.</span>
      </label>
      <MensajeError texto={error} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={enviando} className={btnNegro}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>
    </Formulario>
  );
}
