import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  HeartPulse,
  Megaphone,
  PhoneOff,
  Sparkles,
  Stethoscope,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Datos, Motivo, Paciente, Pantalla, Profesional, Resultado } from '../types';
import { CASO_TXT, ESPECIALISTAS, GRUPO_TXT, MOTIVO_TXT, RESULTADO_TXT, SEMAFORO_INFO, esVIP, diasEntre, fechaCorta, pesosCorto, riesgoAlto, semaforo, sumarDias, tocaHoy } from '../lib/reglas';
import { AUDIENCIAS } from '../lib/campanas';
import { ROLES, type Rol } from '../lib/roles';
import { AGENDA_VIEJA_H, estadoDe, haceTexto, horasDesdeCarga } from './Agenda';
import { Cifra, Iniciales, Insignias, SEMAFORO_TXT, Vacio, btnNegro } from '../components/ui';

type Tono = 'urgente' | 'atencion' | 'ok';
interface Resp {
  titulo: string;
  icono: LucideIcon;
  valor?: number;
  formato?: (n: number) => string;
  unidad: string;
  detalle: string;
  tono: Tono;
  avance?: [number, number];
  desglose?: { k: string; v: number; color?: string }[]; // se muestra en la tarjeta destacada
  accion: string;
  ir: Pantalla;
}
interface Barra {
  k: string;
  v: number;
  txt?: string;
}
interface Lectura {
  titulo: string;
  vacia?: boolean; // sin datos todavía: no ocupa una tarjeta
  texto: ReactNode;
  barras?: Barra[];
}
interface Kpi {
  k: string;
  v: number;
  formato?: (n: number) => string;
  sub: string;
}
interface Resumen {
  foco: { texto: ReactNode; accion?: string; ir?: Pantalla };
  kpis?: Kpi[];
  resps: Resp[];
  lecturas: Lectura[];
  prioridad?: Paciente[];
}

interface Props {
  datos: Datos; // ya filtrados para el rol (el especialista solo recibe lo suyo)
  hoy: string;
  usuario: { nombre: string; rol: Rol; profesional?: Profesional };
  onIr: (p: Pantalla) => void;
  onAbrir: (id: string) => void;
}

// Inicio de cada rol: su foco del día, sus responsabilidades (que también son el acceso a cada sección) y una lectura de sus datos
export function Inicio({ datos, hoy, usuario, onIr, onAbrir }: Props) {
  const rol = ROLES[usuario.rol];
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fecha = new Date(`${hoy}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  if (usuario.rol === 'especialista' && !usuario.profesional)
    return (
      <Vacio titulo="Tu cuenta aún no tiene agenda asignada" texto="Pídele a gerencia que, en Cuentas, te asigne tu agenda (Dra. Sara López o Dr. Juan Manuel Olarte). Así verás solo tus pacientes y tus cupos." />
    );

  const r = RESUMEN[usuario.rol](datos, hoy);
  const ordenadas = [...r.resps].sort((a, b) => PESO[a.tono] - PESO[b.tono]);
  const pendientes = ordenadas.filter((x) => x.tono !== 'ok');
  const alDia = ordenadas.filter((x) => x.tono === 'ok');
  const [destacada, ...resto] = pendientes;
  const lecturas = r.lecturas.filter((l) => !l.vacia);

  return (
    <div className="space-y-10">
      <header className="entrar">
        <p className="kicker flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: rol.color }} aria-hidden />
          {rol.nombre}
          {usuario.profesional && ` · ${usuario.profesional}`}
        </p>
        <h1 className="mt-2 text-[30px] font-bold leading-[1.05] tracking-tight sm:text-[40px]">
          {saludo}, <span className="iris-text">{usuario.nombre.split(' ')[0]}</span>
        </h1>
        <p className="mt-1 text-sm text-muted first-letter:uppercase">{fecha}</p>
        <div className="mt-6 flex flex-col gap-4 rounded-[24px] bg-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="flex gap-3 text-[15px] leading-relaxed sm:text-base">
            <Sparkles className="mt-1 size-4 shrink-0 text-ink/60" aria-hidden />
            <span>
              <b className="font-semibold">Tu foco hoy:</b> {r.foco.texto}
            </span>
          </p>
          {r.foco.ir && (
            <button onClick={() => onIr(r.foco.ir!)} className={`${btnNegro} group shrink-0`}>
              {r.foco.accion} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          )}
        </div>
      </header>

      {r.kpis && (
        <section aria-label="Indicadores clave" className="entrar card grid grid-cols-2 gap-px overflow-hidden bg-line p-0 lg:grid-cols-4">
          {r.kpis.map((k) => (
            <div key={k.k} className="bg-white p-4 sm:p-5">
              <p className="text-xs font-medium text-muted">{k.k}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
                <Cifra valor={k.v} formato={k.formato} />
              </p>
              <p className="mt-0.5 text-xs text-muted">{k.sub}</p>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="t-resp">
        <h2 id="t-resp" className="kicker mb-3">
          {usuario.rol === 'direccion' ? 'Cómo va cada área' : 'Tus responsabilidades'}
        </h2>
        {destacada ? (
          <div className="escalonado grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Tarjeta r={destacada} oscura sola={!resto.length} onIr={onIr} />
            {resto.map((x) => (
              <Tarjeta key={x.titulo} r={x} onIr={onIr} />
            ))}
          </div>
        ) : (
          <p className="card flex items-center gap-3 p-5 text-sm">
            <Check className="size-5 text-verde" aria-hidden /> Todo al día: no hay nada pendiente en tus responsabilidades.
          </p>
        )}
        {alDia.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-muted">Al día</p>
            <ul className="flex flex-wrap gap-2">
              {alDia.map((x) => (
                <li key={x.titulo}>
                  <button
                    onClick={() => onIr(x.ir)}
                    className="group inline-flex items-center gap-2 rounded-full border border-line bg-white py-2 pl-3 pr-3.5 text-sm hover:border-ink/30"
                  >
                    <x.icono className="size-4 text-ink/60" aria-hidden />
                    <span className="font-medium">{x.titulo}</span>
                    {x.valor !== undefined && (
                      <span className="num text-muted">
                        {x.formato ? x.formato(x.valor) : x.valor} {x.unidad}
                      </span>
                    )}
                    <ArrowRight className="size-3.5 text-ink/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {r.prioridad && r.prioridad.length > 0 && (
        <section aria-labelledby="t-prio" className="card p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="t-prio" className="text-lg font-semibold">
              A quién retomar primero
            </h2>
            <button onClick={() => onIr('pacientes')} className="text-sm font-semibold text-ink/70 underline-offset-2 hover:text-ink hover:underline">
              Ver todos
            </button>
          </div>
          <p className="text-sm text-muted">Tus pacientes pendientes de mayor valor. Ábrelos para dejar una nota a recepción.</p>
          <ul className="mt-3 divide-y divide-line">
            {r.prioridad.map((p) => (
              <li key={p.id}>
                <button onClick={() => onAbrir(p.id)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-soft/60">
                  <Iniciales nombre={p.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                      {p.nombre} <Insignias p={p} />
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {CASO_TXT[p.caso]} · {p.tratamiento} · hace {diasEntre(p.fechaEvento, hoy)} días
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm font-semibold">{pesosCorto(p.valor)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lecturas.length > 0 && (
      <section aria-labelledby="t-lect">
        <h2 id="t-lect" className="kicker mb-3">
          Lectura de tus datos
        </h2>
        <div className={`grid gap-3 ${lecturas.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
          {lecturas.map((l) => (
            <article key={l.titulo} className="card flex flex-col rounded-[22px] p-5">
              <h3 className="text-sm font-semibold">{l.titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{l.texto}</p>
              {l.barras && l.barras.length > 0 && <Barras barras={l.barras} />}
            </article>
          ))}
        </div>
      </section>
      )}

      <TuRol rol={usuario.rol} />
    </div>
  );
}

const PESO: Record<Tono, number> = { urgente: 0, atencion: 1, ok: 2 };
const TONO: Record<Tono, { t: string; cls: string; oscuro: string }> = {
  urgente: { t: 'Urgente', cls: 'bg-rojo/10 text-rojo', oscuro: 'bg-rojo text-white' },
  atencion: { t: 'Pendiente', cls: 'bg-amarillo/15 text-[#8a5d00]', oscuro: 'bg-amarillo text-ink' },
  ok: { t: 'Al día', cls: 'bg-verde/12 text-verde', oscuro: 'bg-verde text-white' },
};

// sola = la única pendiente: ocupa todo el ancho, con el desglose a la derecha
function Tarjeta({ r, oscura = false, sola = false, onIr }: { r: Resp; oscura?: boolean; sola?: boolean; onIr: (p: Pantalla) => void }) {
  const t = TONO[r.tono];
  const pct = r.avance && r.avance[1] ? Math.round((r.avance[0] / r.avance[1]) * 100) : null;
  return (
    <button
      onClick={() => onIr(r.ir)}
      className={`group relative flex min-h-[190px] flex-col overflow-hidden rounded-[24px] p-5 text-left sm:p-6 ${
        oscura ? `bg-ink text-white sm:col-span-2 ${sola ? 'xl:col-span-3' : `xl:col-span-1 ${r.desglose ? 'xl:row-span-2' : ''}`}` : 'card lift'
      } ${sola && r.desglose ? 'lg:grid lg:grid-cols-[1fr_320px] lg:content-start lg:gap-x-12' : ''}`}
    >
      {oscura && <span className="aura iris pointer-events-none absolute -right-20 -top-24 size-64 rounded-full opacity-30 blur-3xl" aria-hidden />}
      <span className="relative flex items-start justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className={`grid size-9 place-items-center rounded-full ${oscura ? 'bg-white/10' : 'bg-soft'}`}>
            <r.icono className="size-[18px]" aria-hidden />
          </span>
          <span className="font-semibold">{r.titulo}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${oscura ? t.oscuro : t.cls}`}>{t.t}</span>
      </span>

      <span className="relative mt-5 flex items-baseline gap-2">
        {r.valor !== undefined && (
          <span className={`font-bold tracking-tight ${oscura ? 'text-5xl sm:text-6xl' : 'text-4xl'}`}>
            <Cifra valor={r.valor} formato={r.formato} />
          </span>
        )}
        <span className={`text-sm ${oscura ? 'text-white/70' : 'text-muted'}`}>{r.unidad}</span>
      </span>
      <span className={`relative mt-1 text-sm ${oscura ? 'text-white/75' : 'text-ink/70'}`}>{r.detalle}</span>

      {pct !== null && (
        <span className="relative mt-4 block">
          <span className={`block h-1.5 overflow-hidden rounded-full ${oscura ? 'bg-white/15' : 'bg-soft'}`}>
            <span className="iris crecer-x block h-full rounded-full" style={{ width: `${pct}%` }} />
          </span>
          <span className={`mt-1.5 block text-xs ${oscura ? 'text-white/65' : 'text-muted'}`}>
            {r.avance![0]} de {r.avance![1]} · {pct} %
          </span>
        </span>
      )}

      {oscura && r.desglose && (
        <span className={`relative mt-6 block space-y-2 border-t border-white/10 pt-4 ${sola ? 'lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:mt-0 lg:self-center lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0' : ''}`}>
          {r.desglose.map((x) => (
            <span key={x.k} className="flex items-center gap-2.5 text-sm">
              <span className="size-2 rounded-full" style={{ background: x.color ?? 'rgb(255 255 255 / .5)' }} aria-hidden />
              <span className="flex-1 text-white/80">{x.k}</span>
              <span className="num font-semibold">{x.v}</span>
            </span>
          ))}
        </span>
      )}

      <span className={`relative mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold ${oscura ? 'text-white' : 'text-ink'}`}>
        {r.accion}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </span>
    </button>
  );
}

function Barras({ barras }: { barras: Barra[] }) {
  const max = Math.max(1, ...barras.map((b) => b.v));
  return (
    <ul className="mt-4 space-y-2.5">
      {barras.map((b, i) => (
        <li key={b.k}>
          <span className="flex justify-between gap-3 text-xs">
            <span className="truncate text-ink/75">{b.k}</span>
            <span className="num shrink-0 font-semibold">{b.txt ?? b.v}</span>
          </span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-soft">
            <span className={`crecer-x block h-full rounded-full ${i === 0 ? 'iris' : 'bg-ink/25'}`} style={{ width: `${(b.v / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function TuRol({ rol }: { rol: Rol }) {
  const d = ROLES[rol];
  const col = (titulo: string, icono: LucideIcon, items: string[]) =>
    items.length > 0 && (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-muted">{titulo}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {items.map((x) => {
            const I = icono;
            return (
              <li key={x} className="flex gap-2">
                <I className="mt-0.5 size-4 shrink-0 text-ink/50" aria-hidden />
                {x}
              </li>
            );
          })}
        </ul>
      </div>
    );
  return (
    <details className="group rounded-[24px] border border-line p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold">Qué incluye tu rol: {d.nombre}</span>
          <span className="block text-xs text-muted">{d.quien}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mt-1 text-sm text-ink/75">{d.proposito}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {col('Tu trabajo', Check, d.hace)}
        {col('Ves', Eye, d.ve)}
        {col('No ves', EyeOff, d.noVe)}
      </div>
    </details>
  );
}

// ---------- cálculos por rol ----------
const COLOR = { rojo: '#d93f45', amarillo: '#dc9411', verde: '#2f9e62' };
const porColor = (lista: Paciente[], hoy: string) =>
  (['rojo', 'amarillo', 'verde'] as const).map((c) => ({ k: `${SEMAFORO_TXT[c]} · ${SEMAFORO_INFO[c].corto.toLowerCase()}`, v: lista.filter((p) => semaforo(p, hoy) === c).length, color: COLOR[c] }));
const pendiente = (p: Paciente) => p.estado === 'pendiente' || p.estado === 'agotado';
const suma = (ps: Paciente[]) => ps.reduce((s, p) => s + p.valor, 0);
const contar = <K extends string>(claves: K[], de: K[]) => claves.map((k) => ({ k, v: de.filter((x) => x === k).length })).filter((x) => x.v).sort((a, b) => b.v - a.v);

function motivos(pacientes: Paciente[]): Lectura {
  const con = pacientes.filter((p) => p.motivo !== 'sin_dato' && p.estado !== 'activo');
  const sin = pacientes.filter((p) => p.motivo === 'sin_dato' && pendiente(p)).length;
  const top = contar(Object.keys(MOTIVO_TXT).filter((m) => m !== 'sin_dato') as Motivo[], con.map((p) => p.motivo));
  return {
    titulo: 'Por qué se van',
    vacia: !top.length,
    texto: top.length ? (
      <>
        El motivo más frecuente es <b>{MOTIVO_TXT[top[0].k].toLowerCase()}</b>. Aún faltan {sin} pacientes sin motivo registrado.
      </>
    ) : (
      <>Todavía no hay motivos registrados. Pregúntalo en cada contacto: es el dato que la clínica nunca ha tenido.</>
    ),
    barras: top.slice(0, 4).map((x) => ({ k: MOTIVO_TXT[x.k], v: x.v })),
  };
}

function recuperados(pacientes: Paciente[], hoy: string, quien = 'Se recuperaron'): Lectura {
  const rec = pacientes.filter((p) => p.recuperadoEl && p.recuperadoEl >= sumarDias(hoy, -30));
  return {
    titulo: 'Últimos 30 días',
    vacia: !rec.length,
    texto: rec.length ? (
      <>
        {quien} <b>{rec.length}</b> {rec.length === 1 ? 'paciente' : 'pacientes'}, con <b>{pesosCorto(suma(rec))}</b> en tratamientos retomados.
      </>
    ) : (
      <>Aún no hay pacientes recuperados en este periodo. Cada cita que se agende desde el panel suma aquí.</>
    ),
  };
}

const RESUMEN: Record<Rol, (d: Datos, hoy: string) => Resumen> = {
  auxiliar: (d, hoy) => {
    const { pacientes, huecos } = d;
    const delDia = pacientes.filter((p) => tocaHoy(p, hoy));
    const hechos = pacientes.filter((p) => p.contactos.some((c) => c.fecha === hoy)).length;
    const urgentes = delDia.filter((p) => semaforo(p, hoy) === 'rojo').length;
    const colores = porColor(delDia, hoy);
    const est = huecos.map((h) => estadoDe(h, hoy));
    const n = (e: string) => est.filter((x) => x === e).length;
    const futuros = huecos.filter((h) => h.fecha >= hoy);
    const sinCel = pacientes.filter((p) => p.estado === 'pendiente' && !p.telefono).length;
    const semana = pacientes.flatMap((p) => p.contactos).filter((c) => c.fecha >= sumarDias(hoy, -6));
    const res = contar(Object.keys(RESULTADO_TXT) as Resultado[], semana.map((c) => c.resultado));
    const porConfirmar = n('confirmar') + n('asistencia');
    // campañas: siguen al 3-7-15 (quien no respondió) y los envía la misma persona por WhatsApp
    const agotados = pacientes.filter(AUDIENCIAS.find((a) => a.id === 'agotado')!.filtro).filter((p) => p.telefono);
    const enCurso = d.campanas.filter((c) => c.estado === 'enviando' || c.estado === 'programada' || c.estado === 'pausada');
    return {
      foco: urgentes
        ? { texto: `empieza por los ${urgentes} urgentes: cancelaron o faltaron hace 3 días o menos, o son de alto riesgo.`, accion: 'Ir a la lista del día', ir: 'hoy' }
        : porConfirmar
          ? { texto: `confirma ${n('confirmar')} citas de mañana y registra ${n('asistencia')} asistencias.`, accion: 'Abrir agenda libre', ir: 'agenda' }
          : delDia.length
            ? { texto: `tienes ${delDia.length} pacientes para contactar hoy con la regla 3-7-15.`, accion: 'Ir a la lista del día', ir: 'hoy' }
            : agotados.length
              ? { texto: `${agotados.length} pacientes terminaron el 3-7-15 sin responder. Una campaña de WhatsApp les da otra oportunidad.`, accion: 'Crear campaña', ir: 'campanas' }
              : { texto: 'no hay contactos pendientes para hoy. Revisa los cupos libres para llenar la agenda.', accion: 'Abrir agenda libre', ir: 'agenda' },
      resps: [
        { titulo: 'Seguimiento 3-7-15', icono: Sparkles, valor: delDia.length, unidad: 'por contactar hoy', detalle: urgentes ? `${urgentes} urgentes: recientes, VIP o riesgo alto` : 'Sin urgentes', tono: urgentes ? 'urgente' : delDia.length ? 'atencion' : 'ok', avance: [hechos, hechos + delDia.length], desglose: colores, accion: 'Contactar', ir: 'hoy' },
        { titulo: 'Confirmar y registrar', icono: CalendarCheck, valor: porConfirmar, unidad: 'citas de cupos', detalle: `${n('confirmar')} por confirmar 24 h antes · ${n('asistencia')} por registrar asistencia`, tono: porConfirmar ? 'urgente' : 'ok', accion: 'Abrir agenda', ir: 'agenda' },
        { titulo: 'Cupos libres', icono: CalendarClock, valor: n('libre'), unidad: 'por llenar', detalle: `${n('ofrecido')} esperando respuesta del paciente`, tono: n('libre') ? 'atencion' : 'ok', avance: [futuros.filter((h) => h.ocupadoPor).length, futuros.length], accion: 'Llenar cupos', ir: 'agenda' },
        { titulo: 'Campañas de reactivación', icono: Megaphone, valor: agotados.length, unidad: 'sin respuesta tras 3-7-15', detalle: enCurso.length ? `${enCurso.length} ${enCurso.length === 1 ? 'campaña' : 'campañas'} en curso` : 'Ninguna campaña en curso', tono: agotados.length ? 'atencion' : 'ok', accion: agotados.length ? 'Crear campaña' : 'Ver campañas', ir: 'campanas' },
        { titulo: 'Datos de contacto', icono: PhoneOff, valor: sinCel, unidad: 'sin celular válido', detalle: 'Complétalo o usa correo / apoderado', tono: sinCel ? 'atencion' : 'ok', accion: 'Ver pacientes', ir: 'pacientes' },
        { titulo: 'Agenda del software', icono: FileSpreadsheet, unidad: `Cargada ${haceTexto(horasDesdeCarga(d.ultimaCarga))}`, detalle: horasDesdeCarga(d.ultimaCarga) > AGENDA_VIEJA_H ? 'Carga el Excel de hoy: así la agenda libre no ofrece horarios que ya se ocuparon' : 'Al día. Lo trabajado se conserva al recargar', tono: horasDesdeCarga(d.ultimaCarga) > AGENDA_VIEJA_H ? 'atencion' : 'ok', accion: 'Cargar Excel nuevo', ir: 'cargar' },
      ],
      lecturas: [
        {
          titulo: 'Tus contactos de la semana',
          vacia: !semana.length,
          texto: semana.length ? (
            <>
              <b>{semana.filter((c) => c.resultado === 'agendo').length}</b> de {semana.length} contactos terminaron en una cita.
            </>
          ) : (
            <>Aún no registras contactos esta semana. Cada respuesta que guardes alimenta esta lectura.</>
          ),
          barras: res.map((x) => ({ k: RESULTADO_TXT[x.k], v: x.v })),
        },
        motivos(pacientes),
        recuperados(pacientes, hoy),
      ],
    };
  },

  especialista: (d, hoy) => {
    const { pacientes, huecos } = d;
    const pend = pacientes.filter(pendiente);
    const pausa = pend.filter((p) => p.caso === 'pausa');
    const diag = pend.filter((p) => p.grupo === 2);
    const riesgo = pend.filter(riesgoAlto);
    const est = huecos.map((h) => estadoDe(h, hoy));
    const libres = est.filter((e) => e === 'libre' || e === 'ofrecido').length;
    const contactados = pend.filter((p) => p.contactos.length > 0).length;
    const porCaso = contar(Object.keys(CASO_TXT) as Paciente['caso'][], pend.map((p) => p.caso)).map((x) => ({ k: CASO_TXT[x.k], v: x.v }));
    return {
      foco: pausa.length
        ? { texto: `tienes ${pausa.length} tratamientos en pausa con ${pesosCorto(suma(pausa))} detenidos. Una nota tuya le dice a recepción cómo retomarlos.`, accion: 'Ver mis pacientes', ir: 'pacientes' }
        : { texto: 'tus pacientes están al día. Revisa si hay cupos libres en tu agenda.', accion: 'Ver mi agenda', ir: 'agenda' },
      resps: [
        { titulo: 'Tratamientos en pausa', icono: HeartPulse, valor: pausa.length, unidad: 'pacientes', detalle: `${pesosCorto(suma(pausa))} en tratamientos detenidos`, tono: pausa.length ? 'atencion' : 'ok', desglose: porCaso, accion: 'Revisar', ir: 'pacientes' },
        { titulo: 'Diagnósticos sin iniciar', icono: Stethoscope, valor: diag.length, unidad: 'valorados', detalle: 'Fueron a valoración y no empezaron su plan', tono: diag.length ? 'atencion' : 'ok', accion: 'Revisar', ir: 'pacientes' },
        { titulo: 'Riesgo alto', icono: AlertTriangle, valor: riesgo.length, unidad: 'pacientes', detalle: '3 o más citas seguidas sin asistir: doble confirmación', tono: riesgo.length ? 'urgente' : 'ok', desglose: porCaso, accion: 'Revisar', ir: 'pacientes' },
        { titulo: 'Cupos libres en tu agenda', icono: CalendarClock, valor: libres, unidad: 'por llenar', detalle: 'Recepción los ofrece a tus pacientes pendientes', tono: libres ? 'atencion' : 'ok', accion: 'Ver mi agenda', ir: 'agenda' },
      ],
      prioridad: [...pend].sort((a, b) => Number(esVIP(b)) - Number(esVIP(a)) || b.valor - a.valor).slice(0, 5),
      lecturas: [
        {
          titulo: 'Seguimiento de recepción',
          texto: (
            <>
              Recepción ya contactó a <b>{contactados}</b> de tus {pend.length} pacientes pendientes.
            </>
          ),
          barras: [
            { k: 'Contactados', v: contactados },
            { k: 'Sin contactar aún', v: pend.length - contactados },
          ],
        },
        motivos(pacientes),
        recuperados(pacientes, hoy, 'Volvieron'),
      ],
    };
  },

  direccion: (d, hoy) => {
    const { pacientes, huecos, campanas, citas } = d;
    const porRecuperar = pacientes.filter(pendiente);
    const detenido = suma(pacientes.filter((p) => p.estado === 'pendiente'));
    const rec = pacientes.filter((p) => p.estado === 'recuperado');
    const cerrados = pacientes.filter((p) => p.estado !== 'pendiente' && p.estado !== 'activo').length;
    const delDia = pacientes.filter((p) => tocaHoy(p, hoy));
    const hechos = pacientes.filter((p) => p.contactos.some((c) => c.fecha === hoy)).length;
    const urgentes = delDia.filter((p) => semaforo(p, hoy) === 'rojo').length;
    const futuros = huecos.filter((h) => h.fecha >= hoy);
    const llenos = futuros.filter((h) => h.ocupadoPor).length;
    const enviados = campanas.flatMap((c) => c.envios).filter((e) => e.estado === 'enviado' || e.estado === 'respondio');
    const resp = enviados.filter((e) => e.estado === 'respondio').length;
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
    const porDoctor = ESPECIALISTAS.map((e) => ({ k: e, v: suma(porRecuperar.filter((p) => p.especialista === e)) })).sort((a, b) => b.v - a.v);
    return {
      foco: {
        texto: (
          <>
            hay <b>{pesosCorto(detenido)}</b> detenidos en {pacientes.filter((p) => p.estado === 'pendiente').length} pacientes en seguimiento. {urgentes ? `Recepción tiene ${urgentes} urgentes hoy.` : 'Recepción no tiene urgentes hoy.'}
          </>
        ),
        accion: 'Ver indicadores',
        ir: 'indicadores',
      },
      kpis: [
        { k: 'Por recuperar', v: porRecuperar.length, sub: `de ${pacientes.length} pacientes` },
        { k: 'Dinero detenido', v: detenido, formato: pesosCorto, sub: 'según el arancel' },
        { k: 'Recuperados', v: rec.length, sub: `${pesosCorto(suma(rec))} retomados` },
        { k: 'Tasa de recuperación', v: pct(rec.length, cerrados), formato: (n) => `${Math.round(n)} %`, sub: `de ${cerrados} casos cerrados` },
      ],
      resps: [
        { titulo: 'Seguimiento diario', icono: Sparkles, valor: delDia.length, unidad: 'por contactar hoy', detalle: `${hechos} ya contactados${urgentes ? ` · ${urgentes} urgentes` : ''}`, tono: urgentes ? 'urgente' : delDia.length ? 'atencion' : 'ok', avance: [hechos, hechos + delDia.length], desglose: porColor(delDia, hoy), accion: 'Ver la lista del día', ir: 'hoy' },
        { titulo: 'Agenda libre', icono: CalendarClock, valor: pct(llenos, futuros.length), formato: (n) => `${Math.round(n)} %`, unidad: 'de cupos llenos', detalle: `${futuros.length - llenos} cupos libres por venir`, tono: futuros.length - llenos ? 'atencion' : 'ok', avance: [llenos, futuros.length], accion: 'Ver agenda', ir: 'agenda' },
        { titulo: 'Campañas', icono: Megaphone, valor: pct(resp, enviados.length), formato: (n) => `${Math.round(n)} %`, unidad: 'de respuesta', detalle: `${enviados.length} mensajes enviados`, tono: 'ok', accion: 'Ver campañas', ir: 'campanas' },
        { titulo: 'Indicadores', icono: BarChart3, valor: citas.length, unidad: 'citas analizadas', detalle: 'Fricción, motivos, segmentos y tablas en Excel', tono: 'ok', accion: 'Abrir indicadores', ir: 'indicadores' },
        { titulo: 'Equipo y accesos', icono: UserCog, unidad: 'Cuentas y roles', detalle: 'Crea cuentas y define qué ve cada persona', tono: 'ok', accion: 'Gestionar cuentas', ir: 'cuentas' },
      ],
      lecturas: [
        {
          titulo: 'Dinero detenido por especialista',
          texto: (
            <>
              <b>{porDoctor[0].k}</b> concentra {pct(porDoctor[0].v, porDoctor.reduce((s, x) => s + x.v, 0))} % del valor por recuperar.
            </>
          ),
          barras: porDoctor.map((x) => ({ ...x, txt: pesosCorto(x.v) })),
        },
        {
          titulo: 'Dónde se atasca el paciente',
          texto: <>Pacientes por recuperar según en qué punto del proceso se quedaron.</>,
          barras: ([1, 2, 3] as const).map((g) => ({ k: GRUPO_TXT[g], v: porRecuperar.filter((p) => p.grupo === g).length })).sort((a, b) => b.v - a.v),
        },
        motivos(pacientes),
      ],
    };
  },
};
