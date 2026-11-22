import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarCheck, ChevronDown, Flag, Megaphone, MessageCircle, MessagesSquare, Plus, RotateCcw, Search, SlidersHorizontal, StickyNote, UserMinus } from 'lucide-react';
import type { Antiguedad, Caso, Datos, Estado, Grupo, Paciente, Profesional, Segmento } from '../types';
import { lineaDeTiempo, type TipoEvento } from '../lib/expediente';
import {
  CASO_TXT,
  ESPECIALISTAS,
  ESTADO_TXT,
  GRUPO_TXT,
  normalizarCelular,
  MOTIVO_TXT,
  PASOS,
  RESULTADO_TXT,
  SEGMENTO_TXT,
  fechaCorta,
  fechaQueToca,
  pasoActual,
  semaforo,
  linkWhatsApp,
  pesos,
  pesosCorto,
  ultimoContacto,
} from '../lib/reglas';
import { Encabezado, EtiquetaEstado, Iniciales, Insignias, Meta, Modal, Pestanas, Punto, ComoSePrioriza, SEMAFORO_TXT, btnBorde, btnNegro, textoRiesgo } from '../components/ui';

type FiltroEstado = 'todos' | Estado;
type Orden = 'valor' | 'reciente' | 'nombre' | 'fallos';

export function Pacientes({
  datos,
  hoy,
  abierto,
  onAbrir,
  onContactar,
  onNota,
  onReactivar,
  onDescartar,
  onCrear,
}: {
  datos: Datos;
  hoy: string;
  abierto: string | null;
  onAbrir: (id: string | null) => void;
  onContactar: (p: Paciente) => void;
  onNota: (id: string, texto: string) => void;
  onReactivar: (id: string) => void;
  onDescartar: (id: string) => void;
  onCrear: (p: Paciente) => void;
}) {
  const p = abierto ? datos.pacientes.find((x) => x.id === abierto) : undefined;
  if (p)
    return (
      <Expediente
        p={p}
        datos={datos}
        hoy={hoy}
        onVolver={() => onAbrir(null)}
        onContactar={onContactar}
        onNota={onNota}
        onReactivar={onReactivar}
        onDescartar={onDescartar}
      />
    );
  return <Lista pacientes={datos.pacientes} hoy={hoy} onAbrir={onAbrir} onCrear={onCrear} />;
}

// ---------------- lista ----------------
function Lista({ pacientes, hoy, onAbrir, onCrear }: { pacientes: Paciente[]; hoy: string; onAbrir: (id: string) => void; onCrear: (p: Paciente) => void }) {
  const [estado, setEstado] = useState<FiltroEstado>('todos');
  const [caso, setCaso] = useState<Caso | ''>('');
  const [segmento, setSegmento] = useState<Segmento | ''>('');
  const [grupo, setGrupo] = useState<Grupo | 0>(0);
  const [antiguedad, setAntiguedad] = useState<Antiguedad | ''>('');
  const [riesgo, setRiesgo] = useState(false);
  const [etiqueta, setEtiqueta] = useState('');
  const [orden, setOrden] = useState<Orden>('reciente');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const activos = [caso, grupo, antiguedad, etiqueta, riesgo, segmento].filter(Boolean).length;
  const limpiar = () => {
    setCaso('');
    setGrupo(0);
    setAntiguedad('');
    setEtiqueta('');
    setRiesgo(false);
    setSegmento('');
  };

  const n = (e: Estado) => pacientes.filter((p) => p.estado === e).length;
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pacientes
      .filter(
        (p) =>
          (estado === 'todos' || p.estado === estado) &&
          (!caso || p.caso === caso) &&
          (!segmento || p.segmento === segmento) &&
          (!grupo || p.grupo === grupo) &&
          (!antiguedad || p.antiguedad === antiguedad) &&
          (!riesgo || p.fallosSeguidos >= 3) &&
          (!etiqueta || (etiqueta === 'sincel' ? !p.telefono : p.etiquetas.includes(etiqueta))) &&
          (!t || p.nombre.toLowerCase().includes(t) || p.idPaciente.includes(t) || p.telefono.includes(t) || p.email.toLowerCase().includes(t) || p.tratamiento.toLowerCase().includes(t))
      )
      .sort((a, b) =>
        orden === 'valor'
          ? b.valor - a.valor
          : orden === 'nombre'
            ? a.nombre.localeCompare(b.nombre)
            : orden === 'fallos'
              ? b.fallosSeguidos - a.fallosSeguidos || b.fallosHistoricos - a.fallosHistoricos
            : (ultimoContacto(b)?.fecha ?? b.fechaEvento).localeCompare(ultimoContacto(a)?.fecha ?? a.fechaEvento)
      );
  }, [pacientes, estado, caso, segmento, grupo, antiguedad, riesgo, etiqueta, orden, q]);

  return (
    <div>
      <Encabezado
        titulo="Pacientes"
        descripcion="El expediente de seguimiento de cada paciente: por qué entró a la lista, cada intento de contacto, campañas, citas y notas."
      >
        <button onClick={() => setNuevo(true)} className={btnNegro}>
          <Plus className="size-4" /> Nuevo paciente
        </button>
      </Encabezado>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Pestanas
          valor={estado}
          onCambio={setEstado}
          opciones={[
            ['todos', `Todos · ${pacientes.length}`],
            ['pendiente', `En seguimiento · ${n('pendiente')}`],
            ['recuperado', `Recuperados · ${n('recuperado')}`],
            ['agotado', `Sin respuesta · ${n('agotado')}`],
            ['descartado', `No les interesa · ${n('descartado')}`],
            ['activo', `Activos con cita · ${n('activo')}`],
          ]}
        />
        <label className="relative lg:w-72">
          <span className="sr-only">Buscar paciente</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, # paciente, celular, correo" className="field rounded-full pl-10" />
        </label>
      </div>
      {/* filtros secundarios plegados: la lista queda a la vista y se ve cuántos hay activos */}
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <details className="group" open={activos > 0 || undefined}>
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-card px-3.5 py-2 text-xs font-semibold ring-1 ring-line hover:ring-ink/30 [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filtros
            {activos > 0 && <span className="num rounded-full bg-ink px-1.5 text-[10px] leading-4 text-white">{activos}</span>}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
        <select value={caso} onChange={(e) => setCaso(e.target.value as Caso | '')} className="field w-auto rounded-full py-1.5 text-xs" aria-label="Caso">
          <option value="">Todos los casos</option>
          {Object.entries(CASO_TXT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={grupo} onChange={(e) => setGrupo(Number(e.target.value) as Grupo | 0)} className="field w-auto rounded-full py-1.5 text-xs" aria-label="Segmento del SRS">
          <option value={0}>Los 4 segmentos</option>
          {([1, 2, 3, 4] as Grupo[]).map((g) => (
            <option key={g} value={g}>
              {g}. {GRUPO_TXT[g]}
            </option>
          ))}
        </select>
        <select value={antiguedad} onChange={(e) => setAntiguedad(e.target.value as Antiguedad | '')} className="field w-auto rounded-full py-1.5 text-xs" aria-label="Antigüedad">
          <option value="">Nuevos y antiguos</option>
          <option value="Nuevo">Nuevos</option>
          <option value="Antiguo">Antiguos</option>
        </select>
        <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className="field w-auto rounded-full py-1.5 text-xs" aria-label="Etiqueta">
          <option value="">Todas las etiquetas</option>
          {['VIP', 'Valoración virtual', 'Rehabilitación', 'Alineadores', 'Convenio FLAIRES'].map((e) => (
            <option key={e}>{e}</option>
          ))}
          <option value="sincel">⚠️ Sin celular</option>
        </select>
        <button
          onClick={() => setRiesgo((r) => !r)}
          aria-pressed={riesgo}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${riesgo ? 'bg-rojo text-white' : 'bg-card text-ink/70 ring-1 ring-line'}`}
        >
          Riesgo alto
        </button>
        <select value={segmento} onChange={(e) => setSegmento(e.target.value as Segmento | '')} className="field w-auto rounded-full py-1.5 text-xs" aria-label="Segmento">
          <option value="">Todos los segmentos</option>
          {Object.entries(SEGMENTO_TXT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {activos > 0 && (
          <button onClick={limpiar} className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink/70 underline underline-offset-2 hover:text-ink">
            Quitar filtros
          </button>
        )}
          </div>
        </details>
        <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="field w-auto rounded-full py-1.5 text-xs" aria-label="Ordenar">
          <option value="reciente">Movimiento más reciente</option>
          <option value="valor">Mayor valor</option>
          <option value="nombre">Nombre A-Z</option>
          <option value="fallos">Más fallos históricos</option>
        </select>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="hidden grid-cols-[2fr_1.3fr_1fr_1fr_.9fr] gap-4 border-b border-line px-5 py-3 md:grid">
          {['Paciente', 'Caso', 'Proceso 3-7-15', 'Estado', 'Valor'].map((t) => (
            <span key={t} className="kicker">
              {t}
            </span>
          ))}
        </div>
        <ul key={estado + caso + segmento + grupo + antiguedad + etiqueta + orden} className="escalonado divide-y divide-line">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onAbrir(p.id)}
                className="grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-5 py-4 text-left hover:bg-soft/60 md:grid-cols-[2fr_1.3fr_1fr_1fr_.9fr] md:gap-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Iniciales nombre={p.nombre} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.nombre}</span>
                    <Meta p={p} className="block truncate" />
                  </span>
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block truncate">{CASO_TXT[p.caso]}</span>
                  <span className="block truncate text-xs text-muted">{p.tratamiento}</span>
                </span>
                <MiniProceso p={p} />
                <span className="flex flex-wrap gap-1">
                  <EtiquetaEstado estado={p.estado} />
                  <Insignias p={p} />
                </span>
                <span className="num text-sm font-semibold md:text-right">{p.valor ? pesosCorto(p.valor) : '—'}</span>
              </button>
            </li>
          ))}
        </ul>
        {visibles.length === 0 && <p className="p-10 text-center text-sm text-muted">Ningún paciente coincide con esos filtros.</p>}
      </div>

      <NuevoPaciente
        key={String(nuevo)}
        abierto={nuevo}
        hoy={hoy}
        onCerrar={() => setNuevo(false)}
        onCrear={(p) => {
          onCrear(p);
          setNuevo(false);
        }}
      />
    </div>
  );
}

function MiniProceso({ p }: { p: Paciente }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${p.contactos.length} intentos`}>
      {PASOS.map((d) => {
        const c = p.contactos.find((x) => x.paso === d);
        const cls = !c ? 'bg-line' : c.resultado === 'agendo' ? 'iris' : c.resultado === 'no_interesa' ? 'bg-rojo' : 'bg-ink';
        return <span key={d} className={`h-2 w-5 rounded-full ${cls}`} title={c ? `Día ${d}: ${RESULTADO_TXT[c.resultado]}` : `Día ${d}`} />;
      })}
    </span>
  );
}

// ---------------- expediente ----------------
const ICONO: Record<TipoEvento, typeof Flag> = {
  cita: CalendarCheck,
  evento: Flag,
  contacto: MessagesSquare,
  agenda: CalendarCheck,
  campana: Megaphone,
  nota: StickyNote,
  cierre: Flag,
};

function Expediente({
  p,
  datos,
  hoy,
  onVolver,
  onContactar,
  onNota,
  onReactivar,
  onDescartar,
}: {
  p: Paciente;
  datos: Datos;
  hoy: string;
  onVolver: () => void;
  onContactar: (p: Paciente) => void;
  onNota: (id: string, texto: string) => void;
  onReactivar: (id: string) => void;
  onDescartar: (id: string) => void;
}) {
  const [nota, setNota] = useState('');
  const eventos = lineaDeTiempo(p, datos.huecos, datos.campanas, datos.citas);
  const paso = pasoActual(p, hoy);
  const color = semaforo(p, hoy);
  const toca = fechaQueToca(p, hoy);
  const guardarNota = () => {
    if (!nota.trim()) return;
    onNota(p.id, nota.trim());
    setNota('');
  };

  return (
    <div>
      <button onClick={onVolver} className="entrar mb-4 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </button>

      {/* quién es, en qué va y qué hacer */}
      <section className="entrar card p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Iniciales nombre={p.nombre} grande />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                <EtiquetaEstado estado={p.estado} />
                <Insignias p={p} detalle />
              </div>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{p.nombre}</h1>
              <p className="mt-0.5 truncate text-sm text-muted">
                {p.idPaciente} · {p.especialista}
                {p.tratamiento && ` · ${p.tratamiento}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {p.estado === 'pendiente' && (
              <button onClick={() => onContactar(p)} className={btnNegro}>
                <MessageCircle className="size-4" aria-hidden /> Contactar
              </button>
            )}
            {p.estado !== 'pendiente' && (
              <button onClick={() => onReactivar(p.id)} className={btnNegro}>
                <RotateCcw className="size-4" aria-hidden /> Reactivar seguimiento
              </button>
            )}
            {p.telefono && (
              <a href={linkWhatsApp(p.telefono, '')} target="_blank" rel="noopener" className={btnBorde} aria-label="Abrir WhatsApp sin mensaje">
                WhatsApp
              </a>
            )}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line lg:grid-cols-4">
          <Clave k="Etapa">
            <span className="flex items-center gap-2">
              {color && <Punto color={color} />}
              {paso ? `${color ? SEMAFORO_TXT[color] : ''} · día ${paso}` : ESTADO_TXT[p.estado]}
            </span>
            <ProcesoMini p={p} paso={paso} />
          </Clave>
          <Clave k={p.estado === 'pendiente' ? 'Siguiente contacto' : 'Cierre'}>
            {toca ? (toca <= hoy ? 'Hoy' : fechaCorta(toca)) : p.recuperadoEl ? `Recuperado el ${fechaCorta(p.recuperadoEl)}` : '—'}
            <span className="block text-xs font-normal text-muted">
              {CASO_TXT[p.caso]} · {fechaCorta(p.fechaEvento)}
            </span>
          </Clave>
          <Clave k="Valor estimado">
            {p.valor ? pesosCorto(p.valor) : '—'}
            <span className="block text-xs font-normal text-muted">según el arancel</span>
          </Clave>
          <Clave k="Riesgo de inasistencia">
            {p.nivelRiesgo}
            <span className="block text-xs font-normal text-muted">
              {p.fallosSeguidos} seguidas · {p.fallosHistoricos} en total
            </span>
          </Clave>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* historia: lo que pasó, con la nota interna arriba */}
        <section className="entrar card p-5 sm:p-7" aria-labelledby="t-historia">
          <h2 id="t-historia" className="text-lg font-semibold">
            Historia
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              guardarNota();
            }}
            className="mt-4 flex gap-2"
          >
            <label className="sr-only" htmlFor="nota-interna">
              Nota interna
            </label>
            <input id="nota-interna" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Agregar una nota interna…" className="field rounded-full" />
            <button disabled={!nota.trim()} className={`${btnNegro} shrink-0 px-4`}>
              <StickyNote className="size-4" aria-hidden /> Guardar
            </button>
          </form>
          {eventos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Aquí aparecerán los contactos, campañas, citas y notas.</p>
          ) : (
            <ol className="relative mt-6 space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
              {eventos.map((e, i) => {
                const Ico = ICONO[e.tipo];
                return (
                  <li key={i} className="relative flex gap-4">
                    <span
                      className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${
                        e.tono === 'ok' ? 'iris text-ink' : e.tono === 'mal' ? 'bg-rojo/10 text-rojo' : 'bg-soft text-ink/70'
                      }`}
                    >
                      <Ico className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-[14px] font-semibold">{e.titulo}</p>
                        <p className="num text-xs text-muted">{fechaCorta(e.fecha)}</p>
                      </div>
                      {e.detalle && <p className="mt-0.5 text-sm leading-relaxed text-muted">{e.detalle}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ficha: solo lo útil a la vista; el resto, plegado */}
        <aside className="entrar card h-fit p-5 sm:p-6" aria-labelledby="t-ficha">
          <h2 id="t-ficha" className="text-lg font-semibold">
            Ficha
          </h2>
          <Grupo titulo="Contacto">
            <Fila k="Celular" v={p.telefono || 'Sin celular'} />
            <Fila k="Correo" v={p.email || '—'} />
            {p.apoderado && <Fila k="Apoderado" v={p.apoderado} />}
          </Grupo>
          {p.motivoVip && (
            <Grupo titulo="Por qué es VIP">
              <p className="text-sm font-medium">{p.motivoVip}</p>
            </Grupo>
          )}
          <Grupo titulo="Atención">
            <Fila k="Especialista" v={p.especialista} />
            {p.ultimaCita && <Fila k="Última cita" v={`${fechaCorta(p.ultimaCita.fecha)} · ${p.ultimaCita.estado}`} />}
            <Fila k="Última vez que asistió" v={p.ultimaAtendida ? fechaCorta(p.ultimaAtendida) : 'Nunca'} />
            <Fila k="Motivo registrado" v={MOTIVO_TXT[p.motivo]} />
          </Grupo>
          <details className="group mt-5 border-t border-line pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink/75 hover:text-ink [&::-webkit-details-marker]:hidden">
              Más datos <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Fila k="Segmento" v={`${p.grupo}. ${GRUPO_TXT[p.grupo]}`} />
              <Fila k="Antigüedad" v={p.antiguedad} />
              {p.valorReferencia && <Fila k="Valor calculado con" v={p.valorReferencia.acciones.join(' + ')} />}
              {p.valor > 0 && <Fila k="Valor exacto" v={pesos(p.valor)} />}
              <Fila k="Origen" v={{ excel: 'Agenda en Excel', manual: 'Registro manual' }[p.origen]} />
              <Fila k="En el panel desde" v={fechaCorta(p.creadoEl)} />
              {p.ciclos.length > 0 && <Fila k="Procesos anteriores" v={String(p.ciclos.length)} />}
            </dl>
            <p className="mt-3 text-xs text-muted">{textoRiesgo(p)}.</p>
            <ComoSePrioriza className="mt-2" />
          </details>
          {p.estado === 'pendiente' && (
            <button onClick={() => onDescartar(p.id)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-rojo">
              <UserMinus className="size-3.5" aria-hidden /> Sacar del seguimiento
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function Clave({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="bg-white p-4">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="mt-1 text-[15px] font-semibold">{children}</dd>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="kicker">{titulo}</h3>
      <dl className="mt-2 space-y-2.5 text-sm">{children}</dl>
    </section>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{v}</dd>
    </div>
  );
}

// los tres intentos del 3-7-15 en una línea
function ProcesoMini({ p, paso }: { p: Paciente; paso: number | null }) {
  return (
    <span className="mt-2 flex items-center gap-1" aria-hidden>
      {PASOS.map((d) => {
        const c = p.contactos.find((x) => x.paso === d);
        const cls = c ? (c.resultado === 'agendo' ? 'iris' : c.resultado === 'no_interesa' ? 'bg-rojo' : 'bg-ink') : d === paso ? 'bg-ink/30' : 'bg-line';
        return <span key={d} className={`h-1.5 w-6 rounded-full ${cls}`} title={c ? `Día ${d}: ${RESULTADO_TXT[c.resultado]}` : `Día ${d}`} />;
      })}
    </span>
  );
}

// ---------------- alta manual ----------------
function NuevoPaciente({ abierto, hoy, onCerrar, onCrear }: { abierto: boolean; hoy: string; onCerrar: () => void; onCrear: (p: Paciente) => void }) {
  const [f, setF] = useState({
    nombre: '',
    telefono: '',
    ciudad: 'Medellín',
    segmento: 'local' as Segmento,
    caso: 'cancelo' as Caso,
    fechaEvento: hoy,
    tratamiento: '',
    especialista: ESPECIALISTAS[0] as Profesional,
    valor: '',
    email: '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Nuevo paciente" ancho="max-w-2xl">
      <form
        className="p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          const id = Date.now();
          onCrear({
            id: `m-${id}`,
            idPaciente: `#M-${String(id).slice(-5)}`,
            nombre: f.nombre.trim(),
            telefono: normalizarCelular(f.telefono),
            email: f.email.trim(),
            apoderado: '',
            antiguedad: 'Nuevo',
            etiquetas: [],
            grupo: f.caso === 'diagnostico' ? 2 : f.caso === 'pausa' || f.caso === 'limpieza' ? 3 : 1,
            fallosHistoricos: f.caso === 'cancelo' || f.caso === 'no_asistio' ? 1 : 0,
            fallosSeguidos: f.caso === 'cancelo' || f.caso === 'no_asistio' ? 1 : 0,
            nivelRiesgo: f.caso === 'cancelo' || f.caso === 'no_asistio' ? 'Medio' : 'Bajo',
            ciudad: f.ciudad.trim(),
            segmento: f.segmento,
            caso: f.caso,
            fechaEvento: f.fechaEvento,
            tratamiento: f.tratamiento.trim() || 'Valoración',
            especialista: f.especialista,
            valor: Number(f.valor.replace(/\D/g, '')) || 0,
            motivo: 'sin_dato',
            estado: 'pendiente',
            contactos: [],
            notas: [],
            ciclos: [],
            origen: 'manual',
            creadoEl: hoy,
          });
        }}
      >
        <h2 className="text-2xl font-bold tracking-tight">Nuevo paciente en seguimiento</h2>
        <p className="mt-1 text-sm text-muted">Para casos que no vienen en el Excel: una llamada, una cancelación por WhatsApp, etc.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <L t="Nombre completo">
            <input required value={f.nombre} onChange={set('nombre')} className="field" />
          </L>
          <L t="Celular">
            <input required value={f.telefono} onChange={set('telefono')} className="field" placeholder="+57 300 000 0000" />
          </L>
          <L t="Caso">
            <select value={f.caso} onChange={set('caso')} className="field">
              {Object.entries(CASO_TXT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </L>
          <L t="Fecha del evento">
            <input type="date" max={hoy} required value={f.fechaEvento} onChange={set('fechaEvento')} className="field" />
          </L>
          <L t="Tratamiento">
            <input value={f.tratamiento} onChange={set('tratamiento')} className="field" placeholder="Ej: Implante unitario" />
          </L>
          <L t="Especialista">
            <select value={f.especialista} onChange={set('especialista')} className="field">
              {ESPECIALISTAS.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </L>
          <L t="Segmento">
            <select value={f.segmento} onChange={set('segmento')} className="field">
              {Object.entries(SEGMENTO_TXT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </L>
          <L t="Valor del plan (COP)">
            <input inputMode="numeric" value={f.valor} onChange={set('valor')} className="field" placeholder="0" />
          </L>
          <L t="Correo">
            <input type="email" value={f.email} onChange={set('email')} className="field" />
          </L>
          <L t="Ciudad o país">
            <input value={f.ciudad} onChange={set('ciudad')} className="field" />
          </L>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={btnBorde}>
            Cancelar
          </button>
          <button className={btnNegro}>Agregar al seguimiento</button>
        </div>
      </form>
    </Modal>
  );
}

function L({ t, children }: { t: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {t}
      <div className="mt-1">{children}</div>
    </label>
  );
}
