import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarClock, CalendarDays, Check, ChevronDown, Coffee, Eye, EyeOff, Lock, Palmtree, Pencil, Plus, Stethoscope, Trash2, UserPlus, Users, UserX } from 'lucide-react';
import type { Ausencia, Equipo, Franja, Pausa, Profesional } from '../types';
import { api } from '../lib/api';
import { authClient, esRol } from '../lib/auth';
import { ESPECIALISTAS, fechaCorta, sumarDias } from '../lib/reglas';
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

const diaSemana = (f: string) => (new Date(`${f}T12:00:00`).getDay() + 6) % 7; // 0 = lunes
const cubre = (a: Ausencia, f: string) => a.desde <= f && f <= a.hasta;
const minutos = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const ORDEN_ROLES: Rol[] = ['direccion', 'auxiliar', 'especialista'];

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

  const ausencias = equipo?.ausencias ?? [];
  const lista = cuentas ?? [];
  const activas = lista.filter((c) => !c.banned);
  const ausentesHoy = activas.filter((c) => ausencias.some((a) => a.userId === c.id && cubre(a, hoy)));
  const proximas = ausencias.filter((a) => a.desde > hoy && a.desde <= sumarDias(hoy, 30));
  const atiendenHoy = ESPECIALISTAS.filter(
    (p) =>
      equipo?.horarios[p]?.some((f) => f.dia === diaSemana(hoy)) &&
      !lista.some((c) => c.profesional === p && ausencias.some((a) => a.userId === c.id && cubre(a, hoy)))
  );

  return (
    <div className="space-y-10">
      <Encabezado titulo="Equipo" descripcion="Quién trabaja, cuándo atiende y qué ve cada persona en el panel. Los horarios, descansos y vacaciones de aquí son los que calculan la agenda libre.">
        <button onClick={() => setDialogo({ tipo: 'nueva' })} className={btnNegro}>
          <UserPlus className="size-4" /> Nueva cuenta
        </button>
      </Encabezado>

      {error && <p className="rounded-2xl bg-rojo/10 px-4 py-3 text-sm text-rojo">{error}</p>}
      {!cuentas && !error && <p className="text-sm text-muted">Cargando el equipo…</p>}

      {cuentas && equipo && (
        <>
          {/* cómo está el equipo hoy, de un vistazo */}
          <section aria-label="El equipo hoy" className="entrar card grid grid-cols-2 gap-px overflow-hidden bg-line p-0 lg:grid-cols-4">
            <Dato icono={Users} k="Con acceso al panel" v={activas.length} sub={lista.length - activas.length ? `${lista.length - activas.length} sin acceso` : 'Todas las cuentas activas'} />
            <Dato icono={Stethoscope} k="Especialistas que atienden hoy" v={atiendenHoy.length} sub={atiendenHoy.length ? atiendenHoy.map((p) => p.split(' ').slice(0, 2).join(' ')).join(' · ') : 'Ninguno según los horarios'} />
            <Dato
              icono={Palmtree}
              k="Ausentes hoy"
              v={ausentesHoy.length}
              sub={ausentesHoy.length ? ausentesHoy.map((c) => c.name.split(' ')[0]).join(', ') : 'Todo el equipo disponible'}
              tono={ausentesHoy.length ? 'amarillo' : undefined}
            />
            <Dato icono={CalendarDays} k="Ausencias en 30 días" v={proximas.length} sub={proximas[0] ? `La próxima: ${proximas[0].nombre.split(' ')[0]}, ${rango(proximas[0])}` : 'Sin ausencias programadas'} />
          </section>

          <Semana
            hoy={hoy}
            equipo={equipo}
            cuentas={lista}
            onHorario={(c) => setDialogo({ tipo: 'horario', c })}
          />

          {/* personas, agrupadas por rol */}
          <section aria-labelledby="t-personas" className="space-y-6">
            <div>
              <h2 id="t-personas" className="text-xl font-bold tracking-tight">
                Personas
              </h2>
              <p className="text-sm text-muted">Toca «Editar» para cambiar datos, rol, agenda o contraseña.</p>
            </div>
            {[...ORDEN_ROLES, null].map((r) => {
              const grupo = lista.filter((c) => (r ? c.role === r : !esRol(c.role)));
              if (!grupo.length) return null;
              const d = r ? ROLES[r] : null;
              return (
                <div key={r ?? 'sin-rol'}>
                  <h3 className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: d?.color ?? 'var(--color-line)' }} aria-hidden />
                    <b className="font-semibold">{d?.nombre ?? 'Sin rol'}</b>
                    <span className="num rounded-full bg-soft px-1.5 text-xs text-muted">{grupo.length}</span>
                  </h3>
                  {d && <p className="mb-3 mt-0.5 pl-4.5 text-xs text-muted">{d.proposito}</p>}
                  <div className="escalonado grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {grupo.map((c) => (
                      <Persona
                        key={c.id}
                        c={c}
                        propia={c.id === yo}
                        hoy={hoy}
                        ausencias={ausencias.filter((a) => a.userId === c.id && a.hasta >= hoy)}
                        horario={c.role === 'especialista' && c.profesional ? equipo.horarios[c.profesional as Profesional] : undefined}
                        onDialogo={(tipo) => setDialogo({ tipo, c })}
                        onAcceso={() =>
                          c.banned
                            ? cambiar(authClient.admin.unbanUser({ userId: c.id }), `${c.name} puede volver a entrar`)
                            : confirm(`${c.name} no podrá entrar al panel y se cerrarán sus sesiones. ¿Continuar?`) &&
                              cambiar(authClient.admin.banUser({ userId: c.id }), `${c.name} ya no puede entrar`)
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          <Descansos pausas={equipo.pausas} onGuardado={trasCambio} />
        </>
      )}

      <details className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-semibold">¿Qué hace y qué ve cada rol?</span>
            <span className="text-sm text-muted">Cada persona entra a un inicio con sus responsabilidades; lo que no es de su rol no aparece.</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t border-line p-5 sm:p-6 md:grid-cols-3">
          {OPCIONES.map(([r]) => {
            const d = ROLES[r];
            return (
              <article key={r} className="rounded-[22px] bg-soft/60 p-5">
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
      </details>

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
              propia={dialogo.c.id === yo}
              onGuardada={(t) => {
                cerrar();
                onAviso(t);
                cargar();
                onEquipo();
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

function Dato({ icono: Icono, k, v, sub, tono }: { icono: typeof Users; k: string; v: number; sub: string; tono?: 'amarillo' }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icono className="size-3.5" aria-hidden /> {k}
      </p>
      <p className={`num mt-1 text-2xl font-bold tracking-tight sm:text-[28px] ${tono === 'amarillo' && v ? 'text-amarillo' : ''}`}>{v}</p>
      <p className="mt-0.5 truncate text-xs text-muted" title={sub}>
        {sub}
      </p>
    </div>
  );
}

// ---------- esta semana: horario de cada especialista como una línea de tiempo, con vacaciones y almuerzo ----------
const DESDE_H = 6 * 60;
const HASTA_H = 20 * 60;
const pos = (m: number) => `${((Math.min(Math.max(m, DESDE_H), HASTA_H) - DESDE_H) / (HASTA_H - DESDE_H)) * 100}%`;

function Semana({ hoy, equipo, cuentas, onHorario }: { hoy: string; equipo: Equipo; cuentas: Cuenta[]; onHorario: (c: Cuenta) => void }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i));
  const pausas = equipo.pausas.map((p) => [minutos(p.inicio), minutos(p.fin)] as const);
  const otrasAusencias = equipo.ausencias.filter((a) => {
    const c = cuentas.find((x) => x.id === a.userId);
    return c && c.role !== 'especialista' && a.desde <= dias[6] && a.hasta >= hoy;
  });
  return (
    <section aria-labelledby="t-semana" className="entrar card overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-3">
        <div>
          <h2 id="t-semana" className="text-xl font-bold tracking-tight">
            Esta semana en la clínica
          </h2>
          <p className="text-sm text-muted">Cuándo atiende cada especialista. El almuerzo y las vacaciones ya están descontados.</p>
        </div>
        <p className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-full bg-ink" aria-hidden /> Atiende
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-full bg-amarillo/40" aria-hidden /> Ausente
          </span>
        </p>
      </div>
      <div className="overflow-x-auto px-3 pb-4 sm:px-4">
        <table className="w-[max(100%,600px)] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-36" />
              {dias.map((d) => {
                const f = new Date(`${d}T12:00:00`);
                return (
                  <th key={d} scope="col" className={`rounded-xl px-1 py-1.5 text-center font-normal ${d === hoy ? 'bg-ink text-white' : 'text-muted'}`}>
                    <span className="block text-[11px] uppercase tracking-wider">{d === hoy ? 'Hoy' : f.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}</span>
                    <span className="num block text-sm font-semibold">{f.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ESPECIALISTAS.map((p) => {
              const franjas = equipo.horarios[p] ?? [];
              const personas = cuentas.filter((c) => c.role === 'especialista' && c.profesional === p);
              const ausencias = equipo.ausencias.filter((a) => personas.some((c) => c.id === a.userId));
              return (
                <tr key={p}>
                  <th scope="row" className="pr-2 text-left align-middle font-normal">
                    <span className="block font-semibold">{p}</span>
                    {personas[0] ? (
                      <button onClick={() => onHorario(personas[0])} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                        {franjas.length ? 'Ajustar horario' : 'Definir horario'}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">Sin cuenta asignada</span>
                    )}
                  </th>
                  {dias.map((d) => {
                    const aus = ausencias.find((a) => cubre(a, d));
                    const f = franjas.find((x) => x.dia === diaSemana(d));
                    if (aus)
                      return (
                        <td key={d} className="rounded-xl bg-amarillo/15 px-2 py-2.5 text-center text-xs font-semibold text-amarillo" title={`${aus.motivo}: ${rango(aus)}`}>
                          <Palmtree className="mx-auto mb-0.5 size-4" aria-hidden />
                          {aus.motivo}
                        </td>
                      );
                    if (!f)
                      return (
                        <td key={d} className="rayado rounded-xl px-2 py-2.5 text-center text-xs text-muted">
                          No atiende
                        </td>
                      );
                    const a = minutos(f.inicio);
                    const b = minutos(f.fin);
                    const huecos = pausas.filter(([x, y]) => x < b && y > a);
                    return (
                      <td key={d} className={`rounded-xl px-2 py-2.5 ${d === hoy ? 'bg-ink/5' : 'bg-soft/60'}`} title={`${f.inicio}–${f.fin}`}>
                        <span className="relative block h-2 rounded-full bg-line/70" aria-hidden>
                          <span className="crecer-x absolute inset-y-0 rounded-full bg-ink" style={{ left: pos(a), right: `calc(100% - ${pos(b)})` }} />
                          {huecos.map(([x, y]) => (
                            <span key={x} className="absolute -inset-y-0.5 w-0.75 rounded-full bg-paper" style={{ left: pos(x), width: `calc(${pos(y)} - ${pos(x)})` }} />
                          ))}
                        </span>
                        <span className="num mt-1.5 block text-center text-xs font-medium">
                          {f.inicio.replace(':00', '')}–{f.fin.replace(':00', '')}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {otrasAusencias.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-sm sm:px-6">
          <span className="text-muted">También fuera esta semana:</span>
          {otrasAusencias.map((a) => (
            <span key={a.id} className="rounded-full bg-amarillo/15 px-2.5 py-0.5 text-xs font-semibold text-amarillo">
              {a.nombre.split(' ')[0]} · {rango(a)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

// ---------- tarjeta de una persona ----------
function Persona({
  c,
  propia,
  hoy,
  ausencias,
  horario,
  onDialogo,
  onAcceso,
}: {
  c: Cuenta;
  propia: boolean;
  hoy: string;
  ausencias: Ausencia[];
  horario?: Franja[];
  onDialogo: (t: 'editar' | 'vacaciones' | 'horario') => void;
  onAcceso: () => void;
}) {
  const color = esRol(c.role) ? ROLES[c.role].color : 'var(--color-line)';
  const ahora = ausencias.find((a) => cubre(a, hoy));
  const siguiente = ausencias.find((a) => a.desde > hoy);
  return (
    <article className={`card flex flex-col p-5 transition-shadow hover:shadow-md ${c.banned ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-full p-0.75" style={{ background: color }}>
          <span className="block rounded-full bg-white p-0.5">
            <Iniciales nombre={c.name || c.email} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {c.name} {propia && <span className="text-xs font-normal text-muted">(tú)</span>}
          </p>
          <p className="truncate text-sm text-muted">{c.email}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.banned ? 'bg-soft text-muted' : ahora ? 'bg-amarillo/15 text-amarillo' : 'bg-verde/12 text-verde'}`}
        >
          {c.banned ? <Lock className="size-3" aria-hidden /> : ahora ? <Palmtree className="size-3" aria-hidden /> : <span className="size-1.5 rounded-full bg-verde" aria-hidden />}
          {c.banned ? 'Sin acceso' : ahora ? `${ahora.motivo} hasta el ${fechaCorta(ahora.hasta)}` : 'Activa'}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
        {c.role === 'especialista' && (
          <li className={`rounded-full px-2 py-0.5 ${c.profesional ? 'bg-soft text-ink/75' : 'bg-amarillo/15 text-amarillo'}`}>{c.profesional ? `Agenda: ${c.profesional}` : 'Sin agenda asignada'}</li>
        )}
        {horario && (
          <li className={`rounded-full px-2 py-0.5 ${horario.length ? 'bg-soft text-ink/75' : 'bg-amarillo/15 text-amarillo'}`}>{horario.length ? resumenHorario(horario) : 'Sin horario'}</li>
        )}
        {siguiente && (
          <li className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-ink/75">
            <Palmtree className="size-3" aria-hidden /> {siguiente.motivo}: {rango(siguiente)}
          </li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <Boton icono={Pencil} onClick={() => onDialogo('editar')} etiqueta={`Editar ${c.name}`}>
          Editar
        </Boton>
        <Boton icono={Palmtree} onClick={() => onDialogo('vacaciones')} etiqueta={`Vacaciones de ${c.name}`}>
          Vacaciones
        </Boton>
        {c.role === 'especialista' && c.profesional && (
          <Boton icono={CalendarClock} onClick={() => onDialogo('horario')} etiqueta={`Horario de ${c.name}`}>
            Horario
          </Boton>
        )}
        {!propia && (
          <button
            onClick={onAcceso}
            title={c.banned ? 'Devolverle el acceso al panel' : 'Quitar el acceso al panel (se cierran sus sesiones)'}
            aria-label={c.banned ? `Reactivar a ${c.name}` : `Quitar acceso a ${c.name}`}
            className={`ml-auto ${c.banned ? `${btnChico} bg-ink text-white` : 'grid size-8 place-items-center rounded-full text-muted hover:bg-rojo/10 hover:text-rojo'}`}
          >
            {c.banned ? 'Reactivar' : <UserX className="size-4" aria-hidden />}
          </button>
        )}
      </div>
    </article>
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
function EditarCuenta({ c, propia, onGuardada }: { c: Cuenta; propia: boolean; onGuardada: (t: string) => void }) {
  const [f, setF] = useState({ name: c.name, email: c.email, password: '', role: (esRol(c.role) ? c.role : 'auxiliar') as Rol, profesional: c.profesional ?? '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const email = f.email.trim().toLowerCase();
    if (f.role === 'especialista' && !f.profesional) {
      setEnviando(false);
      return setError('Elige la agenda del especialista.');
    }
    if (!propia && f.role !== c.role) {
      const { error } = await authClient.admin.setRole({ userId: c.id, role: f.role });
      if (error) {
        setEnviando(false);
        return setError(error.message || 'No se pudo cambiar el rol.');
      }
    }
    const profesional = f.role === 'especialista' ? f.profesional : '';
    const cambios = {
      ...(f.name.trim() !== c.name && { name: f.name.trim() }),
      ...(email !== c.email && { email }),
      ...(profesional !== (c.profesional ?? '') && { profesional: profesional || null }),
    };
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
    onGuardada(`${f.name.trim()}: cambios guardados`);
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Rol
          <select value={f.role} disabled={propia} onChange={(e) => setF({ ...f, role: e.target.value as Rol })} className="field mt-1 disabled:opacity-60">
            {OPCIONES.map(([r, x]) => (
              <option key={r} value={r}>
                {x.nombre}
              </option>
            ))}
          </select>
          {propia && <span className="mt-1 block text-xs font-normal text-muted">No puedes cambiar tu propio rol.</span>}
        </label>
        {f.role === 'especialista' && (
          <label className="block text-sm font-medium">
            Agenda
            <SelectAgenda etiqueta="Agenda del especialista" valor={f.profesional} onCambio={(p) => setF({ ...f, profesional: p })} className="mt-1" />
          </label>
        )}
      </div>
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
