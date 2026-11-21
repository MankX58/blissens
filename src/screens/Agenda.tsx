import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRightLeft, Check, ChevronDown, Clock, MessageCircle, Phone, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, UserX, X } from 'lucide-react';
import type { Hueco, Paciente, Profesional } from '../types';
import { fechaLarga, guionHueco, horaLarga, oficial, rellenar, N_UBICACION } from '../lib/guiones';
import { CASO_TXT, ESPECIALISTAS, ESTADO_TXT, altoValor, diasEntre, fechaCorta, linkWhatsApp, pesosCorto, riesgoAlto, sumarDias } from '../lib/reglas';
import { Encabezado, Etiqueta, Iniciales, InsigniaRiesgo, Insignias, Vacio, btnBorde, btnChico, btnNegro } from '../components/ui';

// ---------- estado de cada cupo: dice qué hay que hacer con él ----------
type EstadoEspacio = 'libre' | 'ofrecido' | 'asignado' | 'confirmar' | 'confirmado' | 'asistencia' | 'asistio' | 'no_asistio' | 'perdido';

const INFO: Record<EstadoEspacio, { t: string; cls: string }> = {
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

function estadoDe(h: Hueco, hoy: string): EstadoEspacio {
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

const dr = (e: Profesional) => (e === 'Dra. Sara López' ? 'Dra. Sara' : 'Dr. Olarte');
const horaFin = (h: Hueco) => {
  const [hh, mm] = h.hora.split(':').map(Number);
  const t = hh * 60 + mm + h.minutos;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
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
        (p.estado === 'pendiente' || p.estado === 'agotado') &&
        !ofrecidos.has(p.id) &&
        (p.especialista === h.especialista || (cruzar && p.especialista === 'Dr. Juan Manuel Olarte')) &&
        (!f.tipo || p.ultimaCita?.tipo === f.tipo) &&
        (!f.soloCelular || !!p.telefono) &&
        (!clave || p.nombre.toLowerCase().includes(clave) || p.idPaciente.includes(clave) || p.tratamiento.toLowerCase().includes(clave) || p.etiquetas.some((e) => e.toLowerCase().includes(clave)))
    )
    .sort((a, b) => {
      if (!!a.telefono !== !!b.telefono) return a.telefono ? -1 : 1;
      if ((a.especialista === h.especialista) !== (b.especialista === h.especialista)) return a.especialista === h.especialista ? -1 : 1;
      if (altoValor(a) !== altoValor(b)) return altoValor(a) ? -1 : 1;
      return b.valor - a.valor;
    });
}

interface Props {
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
}

export function Agenda(props: Props) {
  const { huecos, hoy, pacientes } = props;
  const [form, setForm] = useState(false);
  const [historial, setHistorial] = useState(false);
  const detalle = useRef<HTMLDivElement>(null);

  const conEstado = useMemo(
    () => huecos.map((h) => ({ h, e: estadoDe(h, hoy) })).sort((a, b) => (a.h.fecha + a.h.hora < b.h.fecha + b.h.hora ? -1 : 1)),
    [huecos, hoy]
  );
  const activos = conEstado.filter((x) => !resuelto(x.e));
  const pasados = conEstado.filter((x) => resuelto(x.e)).reverse();
  const n = (e: EstadoEspacio) => conEstado.filter((x) => x.e === e).length;

  const primeroCon = (estados: EstadoEspacio[]) => conEstado.find((x) => estados.includes(x.e))?.h.id;
  const [sel, setSel] = useState<string | undefined>(() => PRIORIDAD.map((e) => primeroCon([e])).find(Boolean) ?? conEstado[0]?.h.id);
  const elegido = conEstado.find((x) => x.h.id === sel) ?? activos[0];

  const elegir = (id?: string) => {
    if (!id) return;
    setSel(id);
    if (window.innerWidth < 1024) setTimeout(() => detalle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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

  return (
    <div>
      <Encabezado
        roles={['recepcion']}
        titulo="Agenda libre"
        descripcion="Los cupos que dejaron las cancelaciones. Elige uno, ofrécelo a los pacientes sugeridos, asígnalo cuando alguien acepte y confirma la cita un día antes."
      >
        <button onClick={() => setForm((v) => !v)} className={btnNegro}>
          <Plus className="size-4" /> Nuevo cupo
        </button>
      </Encabezado>

      {form && (
        <NuevoEspacio
          hoy={hoy}
          onCancelar={() => setForm(false)}
          onGuardar={(h) => {
            props.onAgregar(h);
            setForm(false);
            setSel(h.id);
          }}
        />
      )}

      {/* lista de tareas del día */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="kicker">Tu lista de hoy</h2>
          <p className="text-xs text-muted">
            {horas.toFixed(1).replace('.', ',')} h de sillón recuperadas · {pesosCorto(valor)} en tratamientos agendados · {n('perdido')} cupos perdidos
          </p>
        </div>
        <div className="escalonado mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tareas.map((t) => {
            const c = t.e.reduce((s, e) => s + n(e), 0);
            const activo = elegido && t.e.includes(elegido.e);
            return (
              <button
                key={t.t}
                disabled={!c}
                onClick={() => elegir(primeroCon(t.e))}
                className={`group rounded-[22px] p-4 text-left ${c ? (activo ? 'bg-ink text-white' : 'card lift') : 'border border-dashed border-line bg-transparent'}`}
              >
                <span className="flex items-center justify-between">
                  <t.icono className={`size-4 ${c ? (activo ? 'text-white/70' : 'text-muted') : 'text-line'}`} />
                  {c ? <span className="num text-2xl font-bold">{c}</span> : <Check className="size-4 text-verde" />}
                </span>
                <span className={`mt-3 block text-sm font-semibold ${c ? '' : 'text-muted'}`}>{t.t}</span>
                <span className={`block text-xs ${activo ? 'text-white/55' : 'text-muted'}`}>{c ? t.d : 'Todo al día'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {conEstado.length === 0 ? (
        <div className="mt-8">
          <Vacio titulo="No hay cupos registrados" texto="Agrega los cupos que se liberaron en la agenda del software para empezar a llenarlos.">
            <button onClick={() => setForm(true)} className={btnBorde}>
              <Plus className="size-4" /> Nuevo cupo
            </button>
          </Vacio>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          {/* cupos por día */}
          <aside className="card min-w-0 self-start p-3 lg:sticky lg:top-6">
            {[...dias.entries()].map(([fecha, lista]) => (
              <div key={fecha} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{nombreDia(fecha, hoy)}</p>
                {lista.map(({ h, e }) => (
                  <ItemEspacio key={h.id} h={h} e={e} activo={elegido?.h.id === h.id} paciente={pacientes.find((p) => p.id === h.ocupadoPor)} onClick={() => elegir(h.id)} />
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
                    <ItemEspacio key={h.id} h={h} e={e} activo={elegido?.h.id === h.id} paciente={pacientes.find((p) => p.id === h.ocupadoPor)} onClick={() => elegir(h.id)} conFecha />
                  ))}
              </div>
            )}
          </aside>

          <div ref={detalle} className="min-w-0 scroll-mt-20">
            {elegido ? <Detalle key={elegido.h.id} h={elegido.h} e={elegido.e} {...props} /> : <Vacio titulo="Elige un cupo" texto="Selecciona un cupo de la lista para ver qué hacer con él." />}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemEspacio({ h, e, activo, paciente, onClick, conFecha }: { h: Hueco; e: EstadoEspacio; activo: boolean; paciente?: Paciente; onClick: () => void; conFecha?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${activo ? 'bg-ink text-white' : 'hover:bg-soft'}`}>
      <span className="w-12 shrink-0">
        <span className="num block text-[15px] font-bold leading-none">{h.hora}</span>
        <span className={`text-[11px] ${activo ? 'text-white/50' : 'text-muted'}`}>{conFecha ? fechaCorta(h.fecha) : `${h.minutos} min`}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{paciente ? paciente.nombre : dr(h.especialista)}</span>
        <span className={`block truncate text-[11px] ${activo ? 'text-white/50' : 'text-muted'}`}>{paciente ? dr(h.especialista) : h.ofertas.length ? `Ofrecido a ${h.ofertas.length}` : 'Sin ofrecer'}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${activo ? 'bg-white/15 text-white' : INFO[e].cls}`}>{INFO[e].t}</span>
    </button>
  );
}

// ---------- detalle del cupo elegido ----------
const PASOS_FLUJO = ['Ofrecer', 'Asignar', 'Confirmar', 'Asistencia'];
const pasoDe = (e: EstadoEspacio) => (e === 'libre' ? 0 : e === 'ofrecido' ? 1 : e === 'asignado' || e === 'confirmar' ? 2 : e === 'confirmado' || e === 'asistencia' ? 3 : 4);

function Detalle({ h, e, ...p }: Props & { h: Hueco; e: EstadoEspacio }) {
  const paciente = p.pacientes.find((x) => x.id === h.ocupadoPor);
  const paso = pasoDe(e);
  return (
    <div className="space-y-4">
      <section className="entrar relative overflow-hidden rounded-[28px] bg-ink p-6 text-white sm:p-7">
        <div className="aura iris pointer-events-none absolute -right-16 -top-24 size-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">{nombreDia(h.fecha, p.hoy)} · {fechaLarga(h.fecha)}</p>
            <p className="num mt-1 text-4xl font-bold tracking-tight">
              {h.hora} <span className="text-white/40">–</span> {horaFin(h)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {h.especialista} · {h.minutos} min · Consultorio 1157
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">{INFO[e].t}</span>
            {!h.ocupadoPor && (
              <button onClick={() => p.onBorrar(h.id)} aria-label="Eliminar cupo" title="Eliminar cupo" className="rounded-full p-2 text-white/45 hover:bg-white/10 hover:text-white">
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
              <span className={`mt-2 block text-[11px] font-semibold ${i <= paso ? 'text-white' : 'text-white/40'}`}>
                {i + 1}. {t}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {paciente ? <Asignado h={h} e={e} paciente={paciente} {...p} /> : e === 'perdido' ? (
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
          <p className="text-sm text-muted">Cuando te contesten, registra lo que dijeron. Si acepta, el cupo queda asignado.</p>
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
              <button key={t} onClick={() => setF({ ...f, tipo: t })} className={`rounded-full px-3 py-1.5 ${f.tipo === t ? 'bg-white shadow-sm' : 'text-ink/55'}`}>
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
    <li className="flex flex-wrap items-center gap-3 py-3.5">
      <Iniciales nombre={x.nombre} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => onAbrir(x.id)} className="mr-1 font-medium hover:underline">
            {x.nombre}
          </button>
          <Insignias p={x} />
          {x.especialista !== h.especialista && <Etiqueta tono="oscuro">Del Dr. Olarte</Etiqueta>}
        </span>
        <span className="block truncate text-xs text-muted">
          {CASO_TXT[x.caso]} hace {diasEntre(x.fechaEvento, hoy)} días · {x.tratamiento} · <b className="text-ink/70">{pesosCorto(x.valor)}</b>
        </span>
      </span>
      {x.telefono ? (
        <a href={linkWhatsApp(x.telefono, guionHueco(x, h, { asesora }))} target="_blank" rel="noopener" onClick={onOfrecer} className={`${btnNegro} px-4 py-2`}>
          <MessageCircle className="size-4" /> Ofrecer
        </a>
      ) : (
        <span className="text-xs text-amarillo">Sin celular</span>
      )}
      <button onClick={onAsignar} className={`${btnChico} text-muted hover:bg-soft hover:text-ink`} title="Si ya aceptó por llamada o en persona">
        Asignar directo
      </button>
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
  const [especialista, setEspecialista] = useState<Profesional>(ESPECIALISTAS[0]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({ id: `h-${Date.now()}`, fecha, hora, minutos, especialista, ofertas: [] });
      }}
      className="hoja card mt-6 p-5"
    >
      <p className="font-semibold">¿Qué cupo se liberó?</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1.6fr_auto] sm:items-end">
        <label className="text-xs font-medium text-muted">
          Fecha
          <input type="date" min={hoy} required value={fecha} onChange={(e) => setFecha(e.target.value)} className="field mt-1" />
        </label>
        <label className="text-xs font-medium text-muted">
          Hora
          <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="field mt-1" />
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
