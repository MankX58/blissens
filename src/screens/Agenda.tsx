import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRightLeft, CalendarDays, ChevronLeft, ChevronRight, List, Lock, CalendarSearch, Check, ChevronDown, Clock, MessageCircle, Phone, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, UserX, X } from 'lucide-react';
import type { Cita, Datos, Franja, Hueco, Paciente, Pausa, Profesional } from '../types';
import { api } from '../lib/api';
import { resumenHorario } from './Cuentas';
import { fechaLarga, guionHueco, horaLarga, oficial, rellenar, N_UBICACION } from '../lib/guiones';
import { CASO_TXT, DIAS_CUPOS, ESPECIALISTAS, ESTADO_TXT, esVIP, diasEntre, fechaCorta, linkWhatsApp, noContactar, pesosCorto, quiereAdelantar, riesgoAlto, sumarDias } from '../lib/reglas';
import { Encabezado, Etiqueta, Iniciales, InsigniaRiesgo, Insignias, Vacio, btnBorde, btnChico, btnNegro } from '../components/ui';

// ---------- estado de cada cupo: dice qué hay que hacer con él ----------
export type EstadoEspacio = 'ocupado' | 'libre' | 'ofrecido' | 'asignado' | 'confirmar' | 'confirmado' | 'asistencia' | 'asistio' | 'no_asistio' | 'perdido';

const INFO: Record<EstadoEspacio, { t: string; cls: string }> = {
  ocupado: { t: 'Ocupado', cls: 'bg-ink/10 text-ink/60' },
  libre: { t: 'Por llenar', cls: 'bg-rojo/10 text-rojo' },
  ofrecido: { t: 'Esperando respuesta', cls: 'bg-amarillo/15 text-amarillo' },
  asignado: { t: 'Asignado', cls: 'bg-soft text-ink/70' },
  confirmar: { t: 'Confirmar hoy', cls: 'bg-amarillo/15 text-amarillo' },
  confirmado: { t: 'Confirmado', cls: 'bg-verde/12 text-verde' },
  asistencia: { t: '¿Asistió?', cls: 'bg-sky/30 text-ink' },
  asistio: { t: 'Asistió', cls: 'bg-verde/12 text-verde' },
  no_asistio: { t: 'No asistió', cls: 'bg-rojo/10 text-rojo' },
  perdido: { t: 'Se perdió', cls: 'bg-soft text-muted' },
};

export function estadoDe(h: Hueco, hoy: string): EstadoEspacio {
  if (h.verificacion === 'ocupado') return 'ocupado'; // al agendarlo, ya estaba tomado en el software
  if (h.asistencia) return h.asistencia;
  if (h.ocupadoPor) {
    if (h.fecha <= hoy) return 'asistencia';
    if (h.confirmadoEl) return 'confirmado';
    return h.fecha <= sumarDias(hoy, 1) ? 'confirmar' : 'asignado';
  }
  if (h.fecha < hoy) return 'perdido';
  return h.ofertas.some((o) => !o.rechazo) ? 'ofrecido' : 'libre';
}
const resuelto = (e: EstadoEspacio) => e === 'asistio' || e === 'no_asistio' || e === 'perdido';
const PRIORIDAD: EstadoEspacio[] = ['asistencia', 'confirmar', 'ofrecido', 'libre', 'asignado', 'confirmado'];

// qué tan vieja está la agenda cargada: lo agendado después de la última carga no aparece en el cálculo
export const horasDesdeCarga = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / 36e5 : Infinity);
export const AGENDA_VIEJA_H = 24;
export const haceTexto = (h: number) =>
  h < 1 ? 'hace menos de una hora' : h < 24 ? `hace ${Math.round(h)} h` : `hace ${Math.floor(h / 24)} ${Math.floor(h / 24) === 1 ? 'día' : 'días'}`;

const clave = (h: Hueco) => `${h.fecha}|${h.hora}|${h.especialista}`;
const dr = (e: Profesional) => (e === 'Dra. Sara López' ? 'Dra. Sara' : e === 'Dr. Juan Esteban' ? 'Dr. Juan Esteban' : 'Dr. Olarte');
// un cupo con más de 24 h se ofrece con calma; el del mismo día, a quien pueda venir ya (la clínica acepta ambos)
const ventana = (h: Hueco, hoy: string) => h.ventanaAnticipacion ?? (h.fecha <= sumarDias(hoy, 1) ? 'mismo_dia' : 'mas_24h');
const horaFin = (h: Hueco) => {
  const [hh, mm] = h.hora.split(':').map(Number);
  const t = hh * 60 + mm + h.minutos;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
// «Hoy · 11 de noviembre» o «Miércoles, 11 de nov» (sin decir la fecha dos veces)
const diaCompleto = (f: string, hoy: string) => {
  const n = nombreDia(f, hoy);
  return ['Hoy', 'Mañana', 'Ayer'].includes(n) ? `${n} · ${fechaLarga(f)}` : n;
};
const nombreDia = (f: string, hoy: string) => {
  if (f === hoy) return 'Hoy';
  if (f === sumarDias(hoy, 1)) return 'Mañana';
  if (f === sumarDias(hoy, -1)) return 'Ayer';
  const d = new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
  return d[0].toUpperCase() + d.slice(1);
};

// RN-06: doble confirmación 24 h antes para pacientes con riesgo alto (guiones 02 + 09)
const textoConfirmacion = (p: Paciente, h: Hueco, asesora: string) =>
  `${rellenar(oficial(6).texto, { ...p, especialista: h.especialista }, { asesora })} Tu cita es el ${fechaLarga(h.fecha)} a las ${horaLarga(h.hora)}.\n\n${oficial(N_UBICACION).texto}`;

// ---------- candidatos para un cupo (HU-04, RF-10) ----------
interface Filtros {
  clave: string;
  tipo: '' | 'Diagnóstico' | 'Tratamiento';
  soloCelular: boolean;
  cruce: boolean;
}

function candidatos(h: Hueco, pacientes: Paciente[], f: Filtros) {
  const clave = f.clave.trim().toLowerCase();
  const ofrecidos = new Set(h.ofertas.map((o) => o.pacienteId));
  const cruzar = f.cruce && h.especialista === 'Dra. Sara López';
  return pacientes
    .filter(
      (p) =>
        // en seguimiento, o con cita pero pidió adelantarla (la clínica quiere marcar a esos pacientes)
        (p.estado === 'pendiente' || p.estado === 'agotado' || (p.estado === 'activo' && quiereAdelantar(p))) &&
        !noContactar(p) &&
        !ofrecidos.has(p.id) &&
        (p.especialista === h.especialista || (cruzar && p.especialista === 'Dr. Juan Manuel Olarte')) &&
        (!f.tipo || p.ultimaCita?.tipo === f.tipo) &&
        (!f.soloCelular || !!p.telefono) &&
        (!clave || p.nombre.toLowerCase().includes(clave) || p.idPaciente.includes(clave) || p.tratamiento.toLowerCase().includes(clave) || p.etiquetas.some((e) => e.toLowerCase().includes(clave)))
    )
    .sort((a, b) => {
      if (!!a.telefono !== !!b.telefono) return a.telefono ? -1 : 1;
      if (quiereAdelantar(a) !== quiereAdelantar(b)) return quiereAdelantar(a) ? -1 : 1;
      // cupo de primera valoración (45 min): primero los valorados que no han iniciado
      if (h.tipoCupo === 'valoracion_45' && (a.grupo === 2) !== (b.grupo === 2)) return a.grupo === 2 ? -1 : 1;
      if ((a.especialista === h.especialista) !== (b.especialista === h.especialista)) return a.especialista === h.especialista ? -1 : 1;
      if (esVIP(a) !== esVIP(b)) return esVIP(a) ? -1 : 1;
      return b.valor - a.valor;
    });
}

interface Props {
  citas: Cita[]; // las citas del software: el calendario las pinta para ver qué ya está agendado
  pacientes: Paciente[];
  huecos: Hueco[];
  hoy: string;
  asesora: string;
  onAsignar: (huecoId: string, pacienteId: string) => void;
  onRevertir: (huecoId: string) => void;
  onOfrecer: (huecoId: string, pacienteId: string) => void;
  onRechazar: (huecoId: string, pacienteId: string) => void;
  onConfirmar: (huecoId: string) => void;
  onAsistencia: (huecoId: string, a: 'asistio' | 'no_asistio') => void;
  onReasignar: (id: string) => void;
  onAbrir: (id: string) => void;
  onAgregar: (h: Hueco) => void;
  onBorrar: (id: string) => void;
  soloLectura?: boolean; // especialista: ve su tiempo libre; ofrecer y asignar es de recepción
  sinHora: Datos['agendaSinHora'];
  sinHorario: Profesional[];
  onIrHorarios?: () => void; // gerencia: ir a definir horarios
  onIrCargar?: () => void; // recepción y gerencia: cargar el Excel nuevo
  ultimaCarga?: string;
  onVerificar: (ids: string[], libre: boolean | null) => void;
  ocupados: Hueco[]; // marcados como «ya estaba ocupado»
  cargaAutomatica: boolean;
  fuenteAgenda?: 'carpeta' | 'enlace' | 'base' | null;
  fuenteError?: string;
  onRecargar: () => void;
  agendaSinCitas: number;
  cubiertaHasta?: string;
}

export function Agenda(props: Props) {
  const { huecos, hoy, pacientes } = props;
  const [form, setForm] = useState(false);
  const [historial, setHistorial] = useState(false);
  // calendario (por defecto) o lista; se recuerda en este navegador
  const [vista, setVista] = useState<'calendario' | 'lista'>(() => {
    try {
      return localStorage.getItem('blissens-agenda-vista') === 'lista' ? 'lista' : 'calendario';
    } catch {
      return 'calendario';
    }
  });
  const cambiarVista = (v: 'calendario' | 'lista') => {
    setVista(v);
    try {
      localStorage.setItem('blissens-agenda-vista', v);
    } catch {
      /* sin almacenamiento: dura hasta recargar */
    }
  };
  const detalle = useRef<HTMLDivElement>(null);

  const conEstado = useMemo(
    () =>
      [...huecos, ...props.ocupados.filter((o) => !huecos.some((h) => h.id === o.id))]
        .map((h) => ({ h, e: estadoDe(h, hoy) }))
        .sort((a, b) => (a.h.fecha + a.h.hora < b.h.fecha + b.h.hora ? -1 : 1)),
    [huecos, props.ocupados, hoy]
  );
  const activos = conEstado.filter((x) => !resuelto(x.e));
  const pasados = conEstado.filter((x) => resuelto(x.e)).reverse();
  const n = (e: EstadoEspacio) => conEstado.filter((x) => x.e === e).length;

  // se elige por fecha+hora+especialista: al marcar o desmarcar «ocupado» el cupo puede cambiar de id
  const primeroCon = (estados: EstadoEspacio[]) => {
    const x = conEstado.find((y) => estados.includes(y.e));
    return x && clave(x.h);
  };
  const [sel, setSel] = useState<string | undefined>(() => PRIORIDAD.map((e) => primeroCon([e])).find(Boolean) ?? (conEstado[0] && clave(conEstado[0].h)));
  const elegido = conEstado.find((x) => clave(x.h) === sel) ?? activos[0];

  const elegir = (id?: string) => {
    if (!id) return;
    setSel(id);
    if (window.innerWidth < 1024 || vista === 'calendario') setTimeout(() => detalle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const agendados = huecos.filter((h) => h.ocupadoPor && h.fecha >= hoy);
  const horas = agendados.reduce((s, h) => s + h.minutos, 0) / 60;
  const valor = agendados.reduce((s, h) => s + (pacientes.find((p) => p.id === h.ocupadoPor)?.valor ?? 0), 0);

  // agrupado por día
  const dias = new Map<string, typeof activos>();
  for (const x of activos) dias.set(x.h.fecha, [...(dias.get(x.h.fecha) ?? []), x]);

  const tareas: { e: EstadoEspacio[]; t: string; d: string; icono: typeof Clock }[] = [
    { e: ['libre'], t: 'Cupos por llenar', d: 'Elige a quién ofrecerlos', icono: Search },
    { e: ['ofrecido'], t: 'Esperando respuesta', d: 'Registra si aceptó o no', icono: Clock },
    { e: ['confirmar'], t: 'Confirmar citas de mañana', d: 'Recordatorio 24 h antes', icono: ShieldCheck },
    { e: ['asistencia'], t: 'Registrar asistencia', d: 'Citas que ya pasaron', icono: UserCheck },
  ];
  const pendientesLista = tareas.filter((t) => t.e.some((e) => n(e) > 0)).length;
  const alDiaLista = tareas.filter((t) => !t.e.some((e) => n(e) > 0)).map((t) => t.t);

  return (
    <div>
      <Encabezado
        titulo={props.soloLectura ? 'Mi agenda libre' : 'Agenda libre'}
        descripcion={
          props.soloLectura
            ? 'Tu tiempo libre del próximo mes y una semana. Recepción lo ofrece a tus pacientes pendientes.'
            : 'Cupos libres del próximo mes y una semana, ya sin descansos, citas ni vacaciones. Elige uno, ofrécelo y confírmalo un día antes.'
        }
      >
        {!props.soloLectura && (
          <button onClick={() => setForm((v) => !v)} className={btnBorde} title="Para una cancelación que aún no llega en el Excel">
            <Plus className="size-4" /> Agregar cupo a mano
          </button>
        )}
      </Encabezado>

      <Avisos {...props} />

      {form && (
        <NuevoEspacio
          hoy={hoy}
          onCancelar={() => setForm(false)}
          onGuardar={(h) => {
            props.onAgregar(h);
            setForm(false);
            setSel(clave(h));
          }}
        />
      )}

      {/* lista de tareas del día */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="kicker">{props.soloLectura ? 'Cómo va tu agenda' : 'Tu lista de hoy'}</h2>
          <p className="text-xs text-muted">
            {horas.toFixed(1).replace('.', ',')} h de sillón recuperadas · {pesosCorto(valor)} en tratamientos agendados · {n('perdido')} cupos perdidos
            {n('ocupado') > 0 && ` · ${n('ocupado')} ${n('ocupado') === 1 ? 'marcado' : 'marcados'} como ocupado`}
          </p>
        </div>
        <div className="escalonado mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* (las tarjetas «al día» se ocultan en el celular) */}
          {tareas.map((t) => {
            const c = t.e.reduce((s, e) => s + n(e), 0);
            const activo = elegido && t.e.includes(elegido.e);
            const solo = pendientesLista === 1; // en el celular, la única tarea pendiente ocupa todo el ancho
            return (
              <button
                key={t.t}
                disabled={!c}
                onClick={() => elegir(primeroCon(t.e))}
                className={`group rounded-[22px] p-4 text-left ${c ? (solo ? 'col-span-2 lg:col-span-1 ' : '') : 'hidden sm:block '}${c ? (activo ? 'bg-ink text-white' : 'card lift') : 'border border-dashed border-line bg-transparent'}`}
              >
                <span className="flex items-center justify-between">
                  <t.icono className={`size-4 ${c ? (activo ? 'text-white/70' : 'text-muted') : 'text-line'}`} />
                  {c ? <span className="num text-2xl font-bold">{c}</span> : <Check className="size-4 text-verde" />}
                </span>
                <span className={`mt-3 block text-sm font-semibold ${c ? '' : 'text-muted'}`}>{t.t}</span>
                <span className={`block text-xs ${activo ? 'text-white/55' : 'text-muted'}`}>{c ? (props.soloLectura ? 'Los gestiona recepción' : t.d) : 'Todo al día'}</span>
              </button>
            );
          })}
        </div>
        {/* en el celular, lo que ya está al día cabe en una línea */}
        {alDiaLista.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted sm:hidden">
            <Check className="size-3.5 shrink-0 text-verde" aria-hidden /> Al día: {alDiaLista.join(' · ')}
          </p>
        )}
      </section>

      {conEstado.length === 0 ? (
        <div className="mt-8">
          <Vacio
            titulo="No hay tiempo libre por ahora"
            texto={
              props.sinHorario.length
                ? 'El tiempo libre se calcula cuando gerencia define el horario de cada especialista.'
                : props.agendaSinCitas
                  ? 'Los próximos días aún no tienen citas en la agenda cargada, así que no hay huecos que llenar todavía.'
                  : 'La agenda del próximo mes y una semana está llena o no hay horario de atención esos días.'
            }
          />
        </div>
      ) : (
        <>
        <div className="mt-6 flex items-center justify-between gap-3">
          <h2 className="kicker">Cupos</h2>
          <div className="inline-flex rounded-full bg-soft p-1" role="radiogroup" aria-label="Vista de la agenda">
            {(['calendario', 'lista'] as const).map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={vista === v}
                onClick={() => cambiarVista(v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${vista === v ? 'bg-white shadow-sm' : 'text-ink/60 hover:text-ink'}`}
              >
                {v === 'calendario' ? <CalendarDays className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                {v === 'calendario' ? 'Calendario' : 'Lista'}
              </button>
            ))}
          </div>
        </div>
        {vista === 'calendario' ? (
          <div className="mt-3 space-y-5">
            <Calendario items={conEstado} citas={props.citas} hoy={hoy} sel={elegido && clave(elegido.h)} pacientes={pacientes} onElegir={elegir} onAbrir={props.onAbrir} />
            <div ref={detalle} className="min-w-0 scroll-mt-6">
              {elegido ? <Detalle key={clave(elegido.h) + elegido.e} h={elegido.h} e={elegido.e} {...props} /> : <Vacio titulo="Elige un cupo" texto="Toca un cupo del calendario para ofrecerlo o asignarlo." />}
            </div>
          </div>
        ) : (
        <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          {/* cupos por día */}
          <aside className="card min-w-0 self-start p-3 lg:sticky lg:top-6">
            {[...dias.entries()].map(([fecha, lista]) => (
              <div key={fecha} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{nombreDia(fecha, hoy)}</p>
                {lista.map(({ h, e }) => (
                  <ItemEspacio key={h.id} h={h} e={e} activo={elegido?.h.id === h.id} paciente={pacientes.find((p) => p.id === h.ocupadoPor)} onClick={() => elegir(clave(h))} />
                ))}
              </div>
            ))}
            {activos.length === 0 && <p className="px-3 py-4 text-sm text-muted">No hay cupos próximos.</p>}
            {pasados.length > 0 && (
              <div className="mt-2 border-t border-line pt-2">
                <button onClick={() => setHistorial((v) => !v)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-soft">
                  Historial · {pasados.length}
                  <ChevronDown className={`size-4 transition-transform ${historial ? 'rotate-180' : ''}`} />
                </button>
                {historial &&
                  pasados.map(({ h, e }) => (
                    <ItemEspacio key={h.id} h={h} e={e} activo={elegido?.h.id === h.id} paciente={pacientes.find((p) => p.id === h.ocupadoPor)} onClick={() => elegir(clave(h))} conFecha />
                  ))}
              </div>
            )}
          </aside>

          <div ref={detalle} className="min-w-0 scroll-mt-20">
            {elegido ? <Detalle key={clave(elegido.h) + elegido.e} h={elegido.h} e={elegido.e} {...props} /> : <Vacio titulo="Elige un cupo" texto="Selecciona un cupo de la lista para ver qué hacer con él." />}
          </div>
        </div>
        )}
        </>
      )}
    </div>
  );
}

// ---------- calendario: cada semana con lo que ya está agendado y los cupos libres en su hora real ----------
const ALTO_HORA = 68; // px por hora
// cada especialista con su tono: cita = relleno suave; cupo libre = borde punteado del mismo color
const TONO_DR: Record<Profesional, { fondo: string; texto: string; borde: string }> = {
  'Dra. Sara López': { fondo: '#fdeaf1', texto: '#9d1750', borde: '#ec6a9c' },
  'Dr. Juan Manuel Olarte': { fondo: '#e6efff', texto: '#1e3f8f', borde: '#5b8def' },
  'Dr. Juan Esteban': { fondo: '#e3f6ec', texto: '#17603a', borde: '#3fb57a' },
};
// estados con los que la cita ya no ocupa el sillón (igual que el cálculo de tiempo libre del backend)
const LIBERAN = ['Anulado', 'Anulado por pcte. via Whatsapp', 'Cambio de fecha'];
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const diaSemana = (f: string) => new Date(`${f}T12:00:00`).getDay();
const lunesDe = (f: string) => sumarDias(f, -((diaSemana(f) + 6) % 7));
const aMin = (hora: string) => {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
};

// un bloque del calendario: una cita del software o un cupo del panel
type Bloque =
  | { tipo: 'cita'; id: string; fecha: string; prof: Profesional; ini: number; fin: number; c: Cita; paciente?: Paciente }
  | { tipo: 'cupo'; id: string; fecha: string; prof: Profesional; ini: number; fin: number; h: Hueco; e: EstadoEspacio; paciente?: Paciente };

// columnas dentro del carril cuando dos bloques se cruzan (dos sillones a la misma hora)
function acomodar(bloques: Bloque[]) {
  const orden = [...bloques].sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const pos = new Map<string, { col: number; cols: number }>();
  let grupo: Bloque[] = [];
  let finGrupo = -1;
  const cerrar = () => {
    const cols: number[] = [];
    for (const b of grupo) {
      let c = cols.findIndex((fin) => fin <= b.ini);
      if (c < 0) c = cols.push(0) - 1;
      cols[c] = b.fin;
      pos.set(b.id, { col: c, cols: 0 });
    }
    for (const b of grupo) pos.get(b.id)!.cols = cols.length;
    grupo = [];
  };
  for (const b of orden) {
    if (b.ini >= finGrupo && grupo.length) cerrar();
    grupo.push(b);
    finGrupo = Math.max(finGrupo, b.fin);
  }
  if (grupo.length) cerrar();
  return pos;
}

function Calendario({
  items,
  citas,
  hoy,
  sel,
  pacientes,
  onElegir,
  onAbrir,
}: {
  items: { h: Hueco; e: EstadoEspacio }[];
  citas: Cita[];
  hoy: string;
  sel?: string;
  pacientes: Paciente[];
  onElegir: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const porId = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes]);
  // todo lo que se puede pintar, una sola vez
  const bloques = useMemo<Bloque[]>(() => {
    const deCitas: Bloque[] = citas
      .filter((c) => c.hora && !LIBERAN.includes(c.estado))
      .map((c) => {
        const ini = aMin(c.hora!);
        return { tipo: 'cita', id: `c${c.id}`, fecha: c.fecha, prof: c.profesional, ini, fin: c.horaFin ? Math.max(aMin(c.horaFin), ini + 15) : ini + 60, c, paciente: porId.get(String(c.paciente)) };
      });
    const deCupos: Bloque[] = items.map(({ h, e }) => ({ tipo: 'cupo', id: `h${h.id}`, fecha: h.fecha, prof: h.especialista, ini: aMin(h.hora), fin: aMin(h.hora) + h.minutos, h, e, paciente: h.ocupadoPor ? porId.get(h.ocupadoPor) : undefined }));
    return [...deCitas, ...deCupos];
  }, [citas, items, porId]);
  const sinHora = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of citas) if (!c.hora && !LIBERAN.includes(c.estado)) m.set(c.fecha, (m.get(c.fecha) ?? 0) + 1);
    return m;
  }, [citas]);

  // semanas: de la primera a la última con datos (y siempre la de hoy)
  // todas las semanas con citas cargadas, tengan hora o no (las sin hora se avisan)
  const fechas = [hoy, ...bloques.map((b) => b.fecha), ...citas.map((c) => c.fecha)].sort();
  const primera = lunesDe(fechas[0]);
  const ultima = lunesDe(fechas.at(-1)!);
  const [semana, setSemana] = useState(() => lunesDe(hoy));
  const mover = (n: number) => setSemana((s) => {
    const nueva = sumarDias(s, 7 * n);
    return nueva < primera ? primera : nueva > ultima ? ultima : nueva;
  });

  const profes = ESPECIALISTAS.filter((e) => bloques.some((b) => b.prof === e));
  const [filtro, setFiltro] = useState<Profesional | 'todos'>('todos');
  const carriles = filtro === 'todos' ? profes : [filtro];
  const sabado = bloques.some((b) => b.fecha === sumarDias(semana, 5)) || citas.some((c) => c.fecha === sumarDias(semana, 5));
  const dias = Array.from({ length: sabado ? 6 : 5 }, (_, i) => sumarDias(semana, i));
  const visibles = bloques.filter((b) => dias.includes(b.fecha) && carriles.includes(b.prof));
  const cuenta = (f: string) => ({
    citas: visibles.filter((b) => b.fecha === f && b.tipo === 'cita').length,
    libres: visibles.filter((b) => b.fecha === f && b.tipo === 'cupo' && (b.e === 'libre' || b.e === 'ofrecido')).length,
  });
  // horario visible: 8 a 17, y se estira si alguna cita empieza antes o termina después
  const ini = Math.min(8, ...visibles.map((b) => Math.floor(b.ini / 60)));
  const fin = Math.max(17, ...visibles.map((b) => Math.ceil(b.fin / 60)));
  const horas = Array.from({ length: fin - ini + 1 }, (_, k) => ini + k);
  const alto = (fin - ini) * ALTO_HORA;
  const posiciones = new Map<string, { col: number; cols: number }>();
  for (const d of dias) for (const pr of carriles) acomodar(visibles.filter((b) => b.fecha === d && b.prof === pr)).forEach((v, k) => posiciones.set(k, v));

  // en el celular, un día a la vez
  const [diaMovil, setDiaMovil] = useState(hoy);
  const dia = dias.includes(diaMovil) ? diaMovil : dias.includes(hoy) ? hoy : dias[0];
  const fmt = (f: string, mes = true) => new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', mes ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  const vacia = visibles.length === 0;
  const sinHoraSemana = dias.reduce((n, d) => n + (sinHora.get(d) ?? 0), 0);
  const limiteCalculo = sumarDias(hoy, DIAS_CUPOS - 1); // hasta dónde calcula el backend el tiempo libre

  return (
    <section aria-label="Calendario de la agenda" className="card overflow-hidden p-0">
      {/* barra: semana y especialistas */}
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => mover(-1)} disabled={semana <= primera} aria-label="Semana anterior" className="grid size-9 place-items-center rounded-full border border-line hover:bg-soft disabled:opacity-30">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => mover(1)} disabled={semana >= ultima} aria-label="Semana siguiente" className="grid size-9 place-items-center rounded-full border border-line hover:bg-soft disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
          <p className="ml-2 text-[15px] font-semibold">
            {fmt(dias[0])} – {fmt(dias.at(-1)!)}
          </p>
          {semana !== lunesDe(hoy) && (
            <button onClick={() => setSemana(lunesDe(hoy))} className={`${btnChico} ml-1 bg-soft text-ink/75 hover:text-ink`}>
              Hoy
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Especialista">
          {(['todos', ...profes] as const).map((pr) => (
            <button
              key={pr}
              role="radio"
              aria-checked={filtro === pr}
              onClick={() => setFiltro(pr)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === pr ? 'bg-ink text-white' : 'bg-soft text-ink/70 hover:text-ink'}`}
            >
              {pr !== 'todos' && <span className="size-2.5 rounded-full" style={{ background: TONO_DR[pr].borde }} aria-hidden />}
              {pr === 'todos' ? 'Todos' : dr(pr)}
            </button>
          ))}
        </div>
      </div>

      {/* celular: elegir el día */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5 sm:hidden">
        {dias.map((d) => {
          const k = cuenta(d);
          return (
            <button key={d} onClick={() => setDiaMovil(d)} className={`flex min-w-[58px] shrink-0 flex-col items-center rounded-2xl px-2.5 py-1.5 text-xs ${d === dia ? 'bg-ink text-white' : d === hoy ? 'bg-soft' : 'text-ink/70'}`}>
              <span className="font-semibold">{DIA_CORTO[diaSemana(d)]}</span>
              <span className="num text-[15px] font-bold">{fmt(d, false)}</span>
              <span className={`text-[10px] ${d === dia ? 'text-white/60' : 'text-muted'}`}>{k.libres} libres</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <div className="grid grid-cols-[46px_1fr] sm:[grid-template-columns:56px_repeat(var(--n),minmax(0,1fr))]" style={{ '--n': dias.length } as React.CSSProperties}>
          {/* encabezados (escritorio) */}
          <div className="sticky top-0 z-20 hidden border-b border-line bg-white sm:block" />
          {dias.map((d) => {
            const k = cuenta(d);
            const sh = sinHora.get(d) ?? 0;
            return (
              <div key={d} className={`sticky top-0 z-20 hidden border-b border-l border-line px-2 py-2.5 text-center sm:block ${d === hoy ? 'bg-ink text-white' : 'bg-white'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[.12em] ${d === hoy ? 'text-white/70' : 'text-muted'}`}>{d === hoy ? 'Hoy' : DIA_CORTO[diaSemana(d)]}</p>
                <p className="num text-xl font-bold leading-tight">{fmt(d, false)}</p>
                <p className={`text-[11px] ${d === hoy ? 'text-white/70' : 'text-muted'}`}>
                  {k.citas} {k.citas === 1 ? 'cita' : 'citas'} ·{' '}
                  {d < hoy ? <span>pasado</span> : d > limiteCalculo ? <span title={`El tiempo libre se calcula para los ${DIAS_CUPOS} días siguientes a la fecha de trabajo`}>sin calcular</span> : <b className={d === hoy ? 'text-white' : 'text-ink'}>{k.libres} libres</b>}
                </p>
                {sh > 0 && <p className="text-[10px] text-amarillo">{sh} sin hora</p>}
              </div>
            );
          })}

          {/* horas */}
          <div className="relative bg-white" style={{ height: alto + 16 }}>
            {horas.map((hh) => (
              <span key={hh} className="num absolute right-2 -translate-y-1/2 text-[11px] font-medium text-muted" style={{ top: (hh - ini) * ALTO_HORA + 8 }}>
                {hh}:00
              </span>
            ))}
          </div>

          {/* días */}
          {dias.map((d) => (
            <div key={d} className={`relative border-l border-line ${d === dia ? '' : 'hidden sm:block'} ${d === hoy ? 'bg-soft/50' : 'bg-white'}`} style={{ height: alto + 16 }}>
              <div className="absolute inset-x-0 top-2" style={{ height: alto }}>
                {horas.slice(0, -1).map((hh) => (
                  <div key={hh} className="absolute inset-x-0 border-t border-line/60" style={{ top: (hh - ini) * ALTO_HORA }} />
                ))}
                {horas.slice(0, -1).map((hh) => (
                  <div key={`m${hh}`} className="absolute inset-x-0 border-t border-dashed border-line/40" style={{ top: (hh - ini) * ALTO_HORA + ALTO_HORA / 2 }} />
                ))}
                <div className="rayado absolute inset-x-0 grid place-items-center text-[10px] font-semibold uppercase tracking-[.16em] text-muted/80" style={{ top: (12 - ini) * ALTO_HORA, height: ALTO_HORA }}>
                  Almuerzo
                </div>
                {visibles
                  .filter((b) => b.fecha === d)
                  .map((b) => {
                    const carril = carriles.indexOf(b.prof);
                    const anchoCarril = 100 / carriles.length;
                    const { col, cols } = posiciones.get(b.id) ?? { col: 0, cols: 1 };
                    const ancho = anchoCarril / cols;
                    const top = ((b.ini - ini * 60) / 60) * ALTO_HORA + 1;
                    const altoB = Math.max(20, ((b.fin - b.ini) / 60) * ALTO_HORA - 3);
                    const tono = TONO_DR[b.prof];
                    const nombre = b.paciente?.nombre.split(' ')[0];
                    const estilo: React.CSSProperties = { top, height: altoB, left: `calc(${carril * anchoCarril + col * ancho}% + 3px)`, width: `calc(${ancho}% - 6px)` };
                    if (b.tipo === 'cita') {
                      return (
                        <button
                          key={b.id}
                          onClick={() => b.paciente && onAbrir(b.paciente.id)}
                          title={`${b.c.hora}${b.c.horaFin ? `–${b.c.horaFin}` : ''} · ${b.prof} · ${b.c.estado}${b.paciente ? ` · ${b.paciente.nombre}` : ''}`}
                          className="absolute overflow-hidden rounded-[10px] px-2 py-1 text-left text-[11px] leading-tight hover:z-10 hover:brightness-95"
                          style={{ ...estilo, background: tono.fondo, color: tono.texto, boxShadow: `inset 3px 0 0 ${tono.borde}` }}
                        >
                          <span className="num block font-bold">{b.c.hora}</span>
                          {altoB >= 36 && <span className="block truncate font-medium">{nombre ?? 'Cita'}</span>}
                          {altoB >= 52 && <span className="block truncate opacity-70">{b.c.estado}</span>}
                        </button>
                      );
                    }
                    const { h, e } = b;
                    const activo = sel === clave(h);
                    const libre = e === 'libre';
                    const ofrecido = e === 'ofrecido';
                    const lleno = !!b.paciente;
                    return (
                      <button
                        key={b.id}
                        onClick={() => onElegir(clave(h))}
                        title={`${h.hora}–${horaFin(h)} · ${h.especialista} · ${INFO[e].t}${b.paciente ? ` · ${b.paciente.nombre}` : ''}`}
                        className={`absolute overflow-hidden rounded-[10px] px-2 py-1 text-left text-[11px] leading-tight transition-shadow hover:z-10 hover:shadow-md ${activo ? 'z-10 ring-2 ring-ink ring-offset-2' : ''} ${
                          e === 'ocupado' ? 'rayado text-ink/40 line-through' : lleno ? 'bg-ink text-white' : ofrecido ? 'bg-amarillo/15 text-[#7a5200]' : 'bg-white'
                        }`}
                        style={{
                          ...estilo,
                          ...(libre && { border: `1.5px dashed ${tono.borde}`, color: tono.texto }),
                          ...(ofrecido && { border: '1.5px dashed #dc9411' }),
                        }}
                      >
                        <span className="num flex items-center gap-1 font-bold">
                          {libre && <Plus className="size-3" aria-hidden />}
                          {h.hora}
                        </span>
                        {altoB >= 36 && <span className="block truncate font-medium">{lleno ? nombre : libre ? 'Libre' : INFO[e].t}</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
        {vacia && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-white px-4 py-2 text-sm text-muted shadow">
            {sinHoraSemana ? `Esta semana tiene ${sinHoraSemana} citas, pero el Excel no trae su hora` : 'No hay citas cargadas para esta semana'}
          </p>
        )}
      </div>

      {/* leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-[11px] text-muted sm:px-5">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded" style={{ background: TONO_DR['Dr. Juan Manuel Olarte'].fondo, boxShadow: `inset 3px 0 0 ${TONO_DR['Dr. Juan Manuel Olarte'].borde}` }} /> Cita agendada (color del doctor)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded bg-white" style={{ border: `1.5px dashed ${TONO_DR['Dr. Juan Manuel Olarte'].borde}` }} /> Libre: tócalo para ofrecerlo
        </span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded bg-amarillo/15" style={{ border: '1.5px dashed #dc9411' }} /> Esperando respuesta</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded bg-ink" /> Agendado desde el panel</span>
        <span className="flex items-center gap-1.5"><span className="rayado h-3.5 w-5 rounded" /> Ya ocupado</span>
      </div>
    </section>
  );
}

function ItemEspacio({ h, e, activo, paciente, onClick, conFecha }: { h: Hueco; e: EstadoEspacio; activo: boolean; paciente?: Paciente; onClick: () => void; conFecha?: boolean }) {
  const ocupado = e === 'ocupado';
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${activo ? (ocupado ? 'bg-ink/75 text-white' : 'bg-ink text-white') : ocupado ? 'rayado text-ink/50 hover:bg-soft' : 'hover:bg-soft'}`}
    >
      <span className="w-12 shrink-0">
        <span className={`num block text-[15px] font-bold leading-none ${ocupado ? 'line-through decoration-2' : ''}`}>{h.hora}</span>
        <span className={`text-[11px] ${activo ? 'text-white/50' : 'text-muted'}`}>{conFecha ? fechaCorta(h.fecha) : `${h.minutos} min`}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{paciente ? paciente.nombre : dr(h.especialista)}</span>
        <span className={`block truncate text-[11px] ${activo ? 'text-white/50' : 'text-muted'}`}>
          {ocupado ? 'Ya estaba tomado en el software' : paciente ? dr(h.especialista) : h.ofertas.length ? `Ofrecido a ${h.ofertas.length}` : 'Sin ofrecer'}
        </span>
      </span>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${activo ? 'bg-white/15 text-white' : INFO[e].cls}`}>
        {ocupado && <Lock className="size-3" aria-hidden />}
        {INFO[e].t}
      </span>
    </button>
  );
}

// ---------- detalle del cupo elegido ----------
const PASOS_FLUJO = ['Ofrecer', 'Asignar', 'Confirmar', 'Asistencia'];
const pasoDe = (e: EstadoEspacio) => (e === 'libre' ? 0 : e === 'ofrecido' ? 1 : e === 'asignado' || e === 'confirmar' ? 2 : e === 'confirmado' || e === 'asistencia' ? 3 : 4);

function Detalle({ h, e, ...p }: Props & { h: Hueco; e: EstadoEspacio }) {
  if (e === 'ocupado') return <Ocupado h={h} {...p} />;
  const paciente = p.pacientes.find((x) => x.id === h.ocupadoPor);
  const puedeBloquear = !p.soloLectura && h.origen === 'calculado' && !h.ocupadoPor && (e === 'libre' || e === 'ofrecido');
  const paso = pasoDe(e);
  return (
    <div className="space-y-4">
      <section className="entrar relative overflow-hidden rounded-[28px] bg-ink p-6 text-white sm:p-7">
        <div className="aura iris pointer-events-none absolute -right-16 -top-24 size-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">{diaCompleto(h.fecha, p.hoy)}</p>
            <p className="num mt-1 text-4xl font-bold tracking-tight">
              {h.hora} <span className="text-white/60">–</span> {horaFin(h)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {h.especialista} · {h.minutos} min{h.tipoCupo === 'valoracion_45' ? ' · primera valoración' : ''}{h.origen === 'manual' ? ' · agregado a mano' : ''}
            </p>
            <p className="mt-1 text-xs text-white/55">
              {ventana(h, p.hoy) === 'mismo_dia' ? 'Mismo día o mañana: ofrézcalo primero a quien quiere adelantar su cita.' : 'Con más de 24 h: hay tiempo para ofrecerlo y confirmar.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">{INFO[e].t}</span>
            {puedeBloquear && (
              <button
                onClick={() => p.onVerificar([h.id], false)}
                title="Úsalo si al agendarlo en el software este horario ya estaba tomado"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
              >
                <Lock className="size-3.5" aria-hidden /> Ya está ocupado
              </button>
            )}
            {/* un cupo calculado no se borra: volvería a aparecer mientras el horario diga que está libre */}
            {!p.soloLectura && !h.ocupadoPor && (h.origen === 'manual' || e === 'perdido') && (
              <button onClick={() => p.onBorrar(h.id)} aria-label="Eliminar cupo" title="Eliminar cupo" className="rounded-full p-2 text-white/65 hover:bg-white/10 hover:text-white">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
        {/* pasos */}
        <ol className="relative mt-6 grid grid-cols-4 gap-2">
          {PASOS_FLUJO.map((t, i) => (
            <li key={t}>
              <span className={`block h-1 rounded-full ${i < paso ? 'bg-white' : i === paso ? 'iris' : 'bg-white/15'}`} />
              <span className={`mt-2 block text-[11px] font-semibold ${i <= paso ? 'text-white' : 'text-white/60'}`}>
                {i + 1}. {t}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {p.soloLectura ? (
        <SoloVer h={h} e={e} paciente={paciente} pacientes={p.pacientes} onAbrir={p.onAbrir} />
      ) : paciente ? <Asignado h={h} e={e} paciente={paciente} {...p} /> : e === 'perdido' ? (
        <div className="card p-6 text-sm">
          <p className="font-semibold">Nadie ocupó este cupo.</p>
          <p className="mt-1 text-muted">
            Se ofreció a {h.ofertas.length} {h.ofertas.length === 1 ? 'paciente' : 'pacientes'}. Puedes eliminarlo de la lista.
          </p>
        </div>
      ) : (
        <PorLlenar h={h} {...p} />
      )}
    </div>
  );
}

function PorLlenar({ h, ...p }: Props & { h: Hueco }) {
  const [f, setF] = useState<Filtros>({ clave: '', tipo: '', soloCelular: true, cruce: false });
  const [ver, setVer] = useState(6);
  const lista = useMemo(() => candidatos(h, p.pacientes, f), [h, p.pacientes, f]);
  const esperando = h.ofertas.filter((o) => !o.rechazo).map((o) => ({ o, x: p.pacientes.find((y) => y.id === o.pacienteId) })).filter((v) => v.x);
  const rechazos = h.ofertas.filter((o) => o.rechazo).length;
  const asignar = (pid: string) => {
    const x = p.pacientes.find((y) => y.id === pid);
    if (x && x.especialista !== h.especialista && h.especialista === 'Dra. Sara López') p.onReasignar(pid);
    p.onAsignar(h.id, pid);
  };
  useEffect(() => setVer(6), [f]);

  return (
    <>
      {esperando.length > 0 && (
        <section className="entrar card p-5 sm:p-6">
          <h3 className="font-semibold">Esperando respuesta</h3>
          <p className="text-sm text-muted">Cuando acepte, agéndalo en el software de la clínica y marca «Aceptó».</p>
          <ul className="mt-3 divide-y divide-line">
            {esperando.map(({ o, x }) => (
              <li key={o.pacienteId} className="flex flex-wrap items-center gap-3 py-3">
                <Iniciales nombre={x!.nombre} />
                <span className="min-w-0 flex-1">
                  <button onClick={() => p.onAbrir(x!.id)} className="font-medium hover:underline">
                    {x!.nombre}
                  </button>
                  <span className="block text-xs text-muted">
                    Ofrecido {o.fecha === p.hoy ? 'hoy' : `el ${fechaCorta(o.fecha)}`} · {x!.telefono}
                  </span>
                </span>
                <button onClick={() => asignar(x!.id)} className={`${btnNegro} px-4 py-2`}>
                  <Check className="size-4" /> Aceptó
                </button>
                <button onClick={() => p.onRechazar(h.id, x!.id)} className={`${btnBorde} px-4 py-2`}>
                  <X className="size-4" /> No puede
                </button>
                <a href={linkWhatsApp(x!.telefono, guionHueco(x!, h, { asesora: p.asesora }))} target="_blank" rel="noopener" className="rounded-full p-2 text-muted hover:bg-soft hover:text-ink" title="Volver a escribir">
                  <MessageCircle className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="entrar card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-semibold">{esperando.length ? '¿A quién más se lo ofrecemos?' : '¿A quién se lo ofrecemos?'}</h3>
            <p className="text-sm text-muted">
              Pacientes en seguimiento de {dr(h.especialista)}, primero los que tienen celular y más valor.
              {rechazos > 0 && ` ${rechazos} ya dijeron que no.`}
            </p>
          </div>
          <span className="num text-xs text-muted">{lista.length} candidatos</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} placeholder="Buscar: nombre, limpieza, corona…" className="field rounded-full py-2 pl-9" />
          </label>
          <div className="inline-flex rounded-full bg-soft p-1 text-xs font-semibold">
            {(['', 'Diagnóstico', 'Tratamiento'] as const).map((t) => (
              <button key={t} onClick={() => setF({ ...f, tipo: t })} className={`rounded-full px-3 py-1.5 ${f.tipo === t ? 'bg-white shadow-sm' : 'text-ink/65'}`}>
                {t || 'Todos'}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-soft px-3 py-2 text-xs font-semibold">
            <input type="checkbox" checked={f.soloCelular} onChange={(e) => setF({ ...f, soloCelular: e.target.checked })} className="size-3.5 accent-ink" />
            Solo con celular
          </label>
        </div>
        {h.especialista === 'Dra. Sara López' && (
          <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-2xl bg-sky/15 px-3 py-2.5 text-sm">
            <input type="checkbox" checked={f.cruce} onChange={(e) => setF({ ...f, cruce: e.target.checked })} className="size-4 accent-ink" />
            <ArrowRightLeft className="size-4 text-muted" />
            <span>
              <b>¿El Dr. Olarte está de viaje?</b> <span className="text-muted">Incluir a sus pacientes; al asignarlos pasan a la Dra. Sara.</span>
            </span>
          </label>
        )}

        <ul className="mt-3 divide-y divide-line">
          {lista.slice(0, ver).map((x) => (
            <Candidato key={x.id} x={x} h={h} hoy={p.hoy} asesora={p.asesora} onAbrir={p.onAbrir} onOfrecer={() => p.onOfrecer(h.id, x.id)} onAsignar={() => asignar(x.id)} />
          ))}
          {lista.length === 0 && <li className="py-6 text-center text-sm text-muted">Nadie coincide. Prueba quitando filtros{h.especialista === 'Dra. Sara López' ? ' o incluyendo a los pacientes del Dr. Olarte' : ''}.</li>}
        </ul>
        {lista.length > ver && (
          <button onClick={() => setVer((v) => v + 10)} className={`${btnBorde} mt-3 w-full`}>
            Ver más candidatos · quedan {lista.length - ver}
          </button>
        )}
      </section>
    </>
  );
}

function Candidato({ x, h, hoy, asesora, onAbrir, onOfrecer, onAsignar }: { x: Paciente; h: Hueco; hoy: string; asesora: string; onAbrir: (id: string) => void; onOfrecer: () => void; onAsignar: () => void }) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 py-3.5 sm:flex sm:gap-3">
      <Iniciales nombre={x.nombre} />
      <span className="min-w-0 sm:flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => onAbrir(x.id)} className="mr-1 text-left font-medium leading-snug hover:underline">
            {x.nombre}
          </button>
          <Insignias p={x} hoy={hoy} />
          {x.especialista !== h.especialista && <Etiqueta tono="oscuro">De {dr(x.especialista)}</Etiqueta>}
          {x.estado === 'activo' && <Etiqueta>Ya tiene cita</Etiqueta>}
        </span>
        <span className="block truncate text-xs text-muted">
          {CASO_TXT[x.caso]} {diasEntre(x.fechaEvento, hoy) >= 0 ? `hace ${diasEntre(x.fechaEvento, hoy)} días` : `· seguimiento desde el ${fechaCorta(x.fechaEvento)}`} · {x.tratamiento} ·{' '}
          <b className="text-ink/70">{pesosCorto(x.valor)}</b>
        </span>
      </span>
      {/* en el celular, las acciones van debajo y a todo el ancho */}
      <span className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:shrink-0">
        {x.telefono ? (
          <a href={linkWhatsApp(x.telefono, guionHueco(x, h, { asesora }))} target="_blank" rel="noopener" onClick={onOfrecer} className={`${btnNegro} flex-1 px-4 py-2 sm:flex-none`}>
            <MessageCircle className="size-4" /> Ofrecer
          </a>
        ) : (
          <span className="flex-1 text-xs text-amarillo sm:flex-none">Sin celular</span>
        )}
        <button onClick={onAsignar} className={`${btnChico} shrink-0 bg-soft text-ink/70 hover:text-ink sm:bg-transparent sm:text-muted sm:hover:bg-soft`} title="Si ya aceptó por llamada o en persona">
          Asignar directo
        </button>
      </span>
    </li>
  );
}

function Asignado({ h, e, paciente: x, ...p }: Props & { h: Hueco; e: EstadoEspacio; paciente: Paciente }) {
  const riesgo = riesgoAlto(x);
  const diaConfirmar = sumarDias(h.fecha, -1);
  return (
    <>
      <section className="entrar card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Iniciales nombre={x.nombre} grande />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => p.onAbrir(x.id)} className="mr-1 text-xl font-bold tracking-tight hover:underline">
                {x.nombre}
              </button>
              <InsigniaRiesgo p={x} detalle />
            </div>
            <p className="text-sm text-muted">
              {x.idPaciente} · {x.tratamiento} · {pesosCorto(x.valor)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Asignado el {h.asignadoEl ? fechaCorta(h.asignadoEl) : '—'}
              {h.estadoPrevio && ` · venía de “${ESTADO_TXT[h.estadoPrevio]}”`}
            </p>
          </div>
          {x.telefono && (
            <a href={`tel:${x.telefono}`} className={btnBorde}>
              <Phone className="size-4" /> {x.telefono}
            </a>
          )}
        </div>
      </section>

      {/* siguiente paso */}
      {e === 'asistencia' && (
        <Accion titulo="¿Vino a la cita?" texto="Si no asistió, vuelve automáticamente a la bandeja con la regla 3-7-15.">
          <button onClick={() => p.onAsistencia(h.id, 'asistio')} className={`${btnNegro} flex-1 py-3`}>
            <UserCheck className="size-4" /> Sí, asistió
          </button>
          <button onClick={() => p.onAsistencia(h.id, 'no_asistio')} className={`${btnBorde} flex-1 py-3`}>
            <UserX className="size-4" /> No asistió
          </button>
        </Accion>
      )}
      {(e === 'confirmar' || e === 'asignado') && (
        <Accion
          destacado={e === 'confirmar'}
          titulo={e === 'confirmar' ? (riesgo ? 'Haz la doble confirmación hoy' : 'Confirma la cita hoy') : `Siguiente paso: confirmar el ${fechaCorta(diaConfirmar)}`}
          texto={
            riesgo
              ? `${x.nombre.split(' ')[0]} lleva ${x.fallosSeguidos} citas seguidas sin asistir: envía la confirmación con la ubicación y, si no responde, llámala.`
              : 'Envía el recordatorio 24 h antes con fecha, hora y ubicación.'
          }
        >
          {x.telefono && (
            <a href={linkWhatsApp(x.telefono, textoConfirmacion(x, h, p.asesora))} target="_blank" rel="noopener" className={`${e === 'confirmar' ? btnNegro : btnBorde} flex-1 py-3`}>
              <ShieldCheck className="size-4" /> Enviar confirmación
            </a>
          )}
          <button onClick={() => p.onConfirmar(h.id)} className={`${btnBorde} flex-1 py-3`}>
            <Check className="size-4" /> Ya confirmó
          </button>
        </Accion>
      )}
      {e === 'confirmado' && <Accion titulo={`Confirmó el ${fechaCorta(h.confirmadoEl!)}`} texto="Todo listo. El día de la cita registra si asistió." ok />}
      {(e === 'asistio' || e === 'no_asistio') && (
        <Accion
          titulo={e === 'asistio' ? 'Asistió a la cita' : 'No asistió'}
          texto={e === 'asistio' ? 'Cupo recuperado con éxito.' : 'Volvió a la bandeja “Hoy toca contactar” con un nuevo proceso 3-7-15.'}
          ok={e === 'asistio'}
        />
      )}

      <Revertir onConfirmar={() => p.onRevertir(h.id)} />
    </>
  );
}

function Accion({ titulo, texto, children, destacado, ok }: { titulo: string; texto: string; children?: ReactNode; destacado?: boolean; ok?: boolean }) {
  return (
    <section className={`entrar rounded-[24px] p-5 sm:p-6 ${destacado ? 'border-2 border-amarillo/50 bg-amarillo/8' : ok ? 'bg-verde/10' : 'card'}`}>
      <h3 className="flex items-center gap-2 font-semibold">
        {ok && <Check className="size-4 text-verde" />}
        {titulo}
      </h3>
      <p className="mt-0.5 text-sm text-muted">{texto}</p>
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </section>
  );
}

// revertir pide confirmación en el mismo botón, sin ventanas emergentes
function Revertir({ onConfirmar }: { onConfirmar: () => void }) {
  const [seguro, setSeguro] = useState(false);
  return (
    <div className="flex justify-end">
      {seguro ? (
        <span className="pop inline-flex items-center gap-1 rounded-full bg-soft p-1 text-xs">
          <span className="px-2 font-medium">¿Liberar el cupo? El paciente vuelve a seguimiento.</span>
          <button onClick={onConfirmar} className={`${btnChico} bg-ink text-white`}>
            Sí, revertir
          </button>
          <button onClick={() => setSeguro(false)} className={`${btnChico} text-muted hover:text-ink`}>
            No
          </button>
        </span>
      ) : (
        <button onClick={() => setSeguro(true)} className={`${btnChico} text-muted hover:bg-soft hover:text-ink`}>
          <RotateCcw className="size-3.5" /> Revertir asignación
        </button>
      )}
    </div>
  );
}

function NuevoEspacio({ hoy, onGuardar, onCancelar }: { hoy: string; onGuardar: (h: Hueco) => void; onCancelar: () => void }) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1));
  const [hora, setHora] = useState('09:00');
  const [minutos, setMinutos] = useState(60);
  const [tipo, setTipo] = useState<'control' | 'valoracion_45'>('control');
  const [especialista, setEspecialista] = useState<Profesional>(ESPECIALISTAS[0]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({ id: `h-${Date.now()}`, fecha, hora, minutos, especialista, origen: 'manual', ofertas: [], tipoCupo: tipo });
      }}
      className="hoja card mt-6 p-5"
    >
      <p className="font-semibold">¿Qué cupo se liberó?</p>
      <p className="text-xs text-muted">Solo para lo que el cálculo aún no ve, como una cancelación que llegó por WhatsApp y todavía no está en el Excel.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.3fr_1fr_1.6fr_auto] sm:items-end">
        <label className="text-xs font-medium text-muted">
          Fecha
          <input type="date" min={hoy} required value={fecha} onChange={(e) => setFecha(e.target.value)} className="field mt-1" />
        </label>
        <label className="text-xs font-medium text-muted">
          Hora
          <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="field mt-1" />
        </label>
        <label className="text-xs font-medium text-muted">
          Tipo
          <select
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as typeof tipo;
              setTipo(t);
              if (t === 'valoracion_45') setMinutos(45); // la primera valoración dura 45 min
            }}
            className="field mt-1"
          >
            <option value="control">Control / tratamiento</option>
            <option value="valoracion_45">Primera valoración</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Duración
          <select value={minutos} onChange={(e) => setMinutos(+e.target.value)} className="field mt-1">
            {[30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Especialista
          <select value={especialista} onChange={(e) => setEspecialista(e.target.value as Profesional)} className="field mt-1">
            {ESPECIALISTAS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} className={btnBorde}>
            Cancelar
          </button>
          <button className={btnNegro}>Guardar</button>
        </div>
      </div>
    </form>
  );
}

// avisos del cálculo: especialistas sin horario y días que no se pudieron calcular
function Avisos({ sinHora, sinHorario, onIrHorarios, soloLectura, agendaSinCitas, cubiertaHasta, hoy, onRecargar, ultimaCarga, onIrCargar, huecos, cargaAutomatica, fuenteAgenda, fuenteError }: Props) {
  const [verSinHora, setVerSinHora] = useState(false);
  const sinDatos = !!cubiertaHasta && cubiertaHasta < hoy; // el Excel no llega a los días que se calculan
  const horas = horasDesdeCarga(ultimaCarga);
  const vieja = horas > AGENDA_VIEJA_H && huecos.some((h) => h.origen === 'calculado');
  if (!sinHora.length && !sinHorario.length && !agendaSinCitas && !vieja && !fuenteError) return null;
  // qué hacer para ponerla al día, en una frase
  const comoActualizar = cargaAutomatica
    ? fuenteAgenda === 'carpeta'
      ? 'Guarda la exportación de hoy en la carpeta: se carga sola.'
      : 'Revisa que el software siga actualizando el archivo en línea.'
    : onIrCargar
      ? 'Carga el Excel de hoy.'
      : 'Recepción la actualiza al cargar el Excel del día.';
  const alertas = (fuenteError && !soloLectura) || vieja || sinHorario.length > 0;
  return (
    <section aria-label="Estado de la agenda" className="entrar mt-6 overflow-hidden rounded-[22px] border border-line bg-white">
      {/* lo que pide una acción: una fila corta por alerta, con su botón */}
      {fuenteError && !soloLectura && (
        <Alerta tono="rojo" titulo="No se pudo actualizar la agenda en línea" texto={fuenteError}>
          {onIrCargar && (
            <button onClick={onIrCargar} className={`${btnChico} bg-ink text-white`}>
              Revisar conexión
            </button>
          )}
        </Alerta>
      )}
      {vieja && !fuenteError && (
        <Alerta tono="amarillo" titulo={`Agenda cargada ${haceTexto(horas)}`} texto={`Algún cupo podría estar ya ocupado. ${comoActualizar}`}>
          {onIrCargar && (
            <button onClick={onIrCargar} className={`${btnChico} bg-ink text-white`}>
              Cargar Excel de hoy
            </button>
          )}
        </Alerta>
      )}
      {sinHorario.length > 0 && (
        <Alerta
          tono="amarillo"
          titulo={soloLectura ? 'Falta tu horario' : `Falta el horario de ${sinHorario.join(' y ')}`}
          texto="Sin horario no se puede calcular su tiempo libre."
        >
          {onIrHorarios && (
            <button onClick={onIrHorarios} className={`${btnChico} bg-soft text-ink/80 hover:text-ink`}>
              Ajustar en Equipo
            </button>
          )}
        </Alerta>
      )}
      {sinHorario.length > 0 && onIrHorarios && (
        <div className="px-4 pb-3">
          <Sugerido sinHorario={sinHorario} onAplicado={onRecargar} />
        </div>
      )}

      {/* lo informativo: datos sueltos en una sola línea, el detalle al tocar */}
      {(agendaSinCitas > 0 || sinHora.length > 0) && (
        <div className={`flex flex-wrap items-center gap-2 px-4 py-3 text-[13px] ${alertas ? 'border-t border-line bg-paper/60' : ''}`}>
          <span className="mr-1 text-xs font-medium text-muted">No se ofrecen:</span>
          {agendaSinCitas > 0 && (
            <span
              className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-soft px-3 py-1"
              title={
                sinDatos
                  ? `La agenda cargada llega hasta el ${fechaLarga(cubiertaHasta!)}: después no se sabe qué está ocupado.`
                  : 'Días sin ninguna cita todavía: es normal en fechas lejanas o festivos, no son huecos por llenar.'
              }
            >
              <CalendarSearch className="size-3.5 text-muted" aria-hidden />
              {sinDatos ? `Días después del ${fechaLarga(cubiertaHasta!)}` : `${agendaSinCitas} ${agendaSinCitas === 1 ? 'día' : 'días'} sin citas aún`}
            </span>
          )}
          {sinHora.length > 0 && (
            <button
              onClick={() => setVerSinHora((v) => !v)}
              aria-expanded={verSinHora}
              className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 hover:bg-line"
            >
              <Clock className="size-3.5 text-muted" aria-hidden />
              {sinHora.length} {sinHora.length === 1 ? 'día' : 'días'} con citas sin hora
              <ChevronDown className={`size-3.5 transition-transform ${verSinHora ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          )}
          {verSinHora && (
            <div className="hoja mt-1 w-full rounded-2xl bg-soft p-3">
              <ul className="grid gap-x-6 gap-y-0.5 text-ink/75 sm:grid-cols-2">
                {sinHora.map((d) => (
                  <li key={d.fecha + d.profesional}>
                    {fechaLarga(d.fecha)} · {d.profesional}: {d.citas} {d.citas === 1 ? 'cita' : 'citas'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Carga el archivo de detalle de la agenda (el que trae la hora de cada cita) para calcularlos.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Alerta({ tono, titulo, texto, children }: { tono: 'rojo' | 'amarillo'; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <p className="flex min-w-0 flex-1 items-start gap-2.5 text-sm">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${tono === 'rojo' ? 'bg-rojo' : 'bg-amarillo'}`} aria-hidden />
        <span>
          <b className="font-semibold">{titulo}</b> <span className="hidden text-muted sm:inline">· {texto}</span>
        </span>
      </p>
      <span className="flex shrink-0 gap-2 pl-[18px] sm:pl-0">{children}</span>
    </div>
  );
}

// vista del especialista: qué pasa con el cupo, sin acciones
function SoloVer({ h, e, paciente, pacientes, onAbrir }: { h: Hueco; e: EstadoEspacio; paciente?: Paciente; pacientes: Paciente[]; onAbrir: (id: string) => void }) {
  const ofrecidos = h.ofertas.map((o) => ({ o, x: pacientes.find((y) => y.id === o.pacienteId) })).filter((v) => v.x);
  return (
    <section className="entrar card p-5 sm:p-6 text-sm">
      {paciente ? (
        <>
          <p className="font-semibold">Asignado a</p>
          <button onClick={() => onAbrir(paciente.id)} className="mt-2 flex items-center gap-3 text-left">
            <Iniciales nombre={paciente.nombre} />
            <span>
              <span className="block font-medium hover:underline">{paciente.nombre}</span>
              <span className="text-xs text-muted">
                {paciente.tratamiento} · {INFO[e].t}
              </span>
            </span>
          </button>
        </>
      ) : (
        <>
          <p className="font-semibold">
            {e === 'perdido' ? 'Nadie ocupó este cupo' : ofrecidos.length ? 'Recepción lo está ofreciendo' : 'Recepción se lo ofrecerá a tus pacientes pendientes'}
          </p>
          {ofrecidos.length > 0 ? (
            <ul className="mt-2 space-y-1 text-ink/75">
              {ofrecidos.map(({ o, x }) => (
                <li key={o.pacienteId}>
                  {x!.nombre} · {o.rechazo ? 'no puede' : 'esperando respuesta'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">Aún no se ha ofrecido a nadie.</p>
          )}
        </>
      )}
      <p className="mt-4 text-xs text-muted">Si quieres que se le dé prioridad a alguien, déjale una nota en su expediente.</p>
    </section>
  );
}

// horario y almuerzo deducidos de las citas: gerencia los aplica con un clic
function Sugerido({ sinHorario, onAplicado }: { sinHorario: Profesional[]; onAplicado: () => void }) {
  const [s, setS] = useState<{ horarios: Record<string, Franja[]>; pausas: Pausa[]; citas: number } | null>(null);
  const [pausasActuales, setPausasActuales] = useState<Pausa[]>([]);
  const [estado, setEstado] = useState<'' | 'cargando' | 'aplicando' | string>('');
  const ver = async () => {
    setEstado('cargando');
    try {
      const [sug, eq] = await Promise.all([api.horarioSugerido(), api.equipo()]);
      setS(sug);
      setPausasActuales(eq.pausas);
      setEstado('');
    } catch (e) {
      setEstado((e as Error).message);
    }
  };
  const aplicables = sinHorario.filter((p) => s?.horarios[p]?.length);
  const pausas = pausasActuales.length ? [] : (s?.pausas ?? []);
  const aplicar = async () => {
    setEstado('aplicando');
    try {
      for (const p of aplicables) await api.guardarHorario(p, s!.horarios[p]);
      if (pausas.length) await api.guardarPausas(pausas);
      onAplicado();
    } catch (e) {
      setEstado((e as Error).message);
    }
  };
  if (!s)
    return (
      <button onClick={ver} disabled={estado === 'cargando'} className={`${btnChico} mt-2 bg-ink text-white`}>
        {estado === 'cargando' ? 'Calculando…' : 'Ver el horario sugerido según las citas'}
      </button>
    );
  return (
    <div className="hoja mt-3 rounded-2xl bg-white p-4">
      <p className="font-semibold">Horario sugerido</p>
      <p className="text-xs text-muted">Deducido de {s.citas} citas con hora del Excel cargado. Revísalo; podrás ajustarlo en Equipo cuando quieras.</p>
      <ul className="mt-2 space-y-1">
        {sinHorario.map((p) => (
          <li key={p}>
            <b className="font-medium">{p}:</b> {s.horarios[p]?.length ? resumenHorario(s.horarios[p]) : <span className="text-muted">sin citas suficientes para sugerir</span>}
          </li>
        ))}
        {pausas.map((p) => (
          <li key={p.nombre}>
            <b className="font-medium">{p.nombre}:</b> {p.inicio}–{p.fin} <span className="text-muted">(casi no hay citas a esa hora)</span>
          </li>
        ))}
      </ul>
      {typeof estado === 'string' && estado && estado !== 'aplicando' && <p className="mt-2 text-xs text-rojo">{estado}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={aplicar} disabled={!aplicables.length || estado === 'aplicando'} className={`${btnChico} bg-ink text-white disabled:opacity-40`}>
          <Check className="size-3.5" aria-hidden /> {estado === 'aplicando' ? 'Aplicando…' : 'Aplicar'}
        </button>
        <button onClick={() => setS(null)} className={`${btnChico} text-muted hover:text-ink`}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// cupo marcado como «ya estaba ocupado»: se ve sellado y se puede devolver con un clic
function Ocupado({ h, ...p }: Props & { h: Hueco }) {
  return (
    <div className="space-y-4">
      <section className="entrar rayado relative overflow-hidden rounded-[28px] bg-soft p-6 ring-1 ring-line sm:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">
              {diaCompleto(h.fecha, p.hoy)}
            </p>
            <p className="num relative mt-1 inline-block text-4xl font-bold tracking-tight text-ink/35">
              {h.hora} – {horaFin(h)}
              <span className="crecer-x absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/55" aria-hidden />
            </p>
            <p className="mt-1 text-sm text-muted">
              {h.especialista} · {h.minutos} min
            </p>
          </div>
          <span className="sello select-none rounded-xl border-[3px] border-rojo/70 bg-paper/70 px-3 py-1 text-lg font-black uppercase tracking-[.22em] text-rojo/80" aria-hidden>
            Ocupado
          </span>
        </div>
      </section>

      <section className="entrar card p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <Lock className="size-4 text-muted" aria-hidden /> Ocupado en el software de la clínica
        </h3>
        <p className="mt-1 text-sm text-muted">
          Se marcó porque, al agendarlo, este horario ya estaba tomado. Ya no se ofrece a ningún paciente ni cuenta como agenda libre.
        </p>
        {!p.soloLectura && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => p.onVerificar([h.id], null)} className={`${btnNegro} group`}>
              <RotateCcw className="size-4 transition-transform group-hover:-rotate-90" aria-hidden /> Volver a ofrecerlo
            </button>
            <span className="text-xs text-muted">¿Fue un error? Vuelve a la agenda libre tal como estaba.</span>
          </div>
        )}
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Esto solo cambia el panel: no modifica nada en el software de la clínica.</p>
      </section>
    </div>
  );
}
