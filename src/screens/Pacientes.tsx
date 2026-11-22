import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarCheck, ChevronDown, ChevronRight, Flag, Megaphone, MessageCircle, MessagesSquare, Plus, RotateCcw, Search, SlidersHorizontal, StickyNote, UserMinus, X } from 'lucide-react';
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
  porQueSemaforo,
  PASO_TXT,
  semaforo,
  linkWhatsApp,
  pesos,
  pesosCorto,
  ultimoContacto,
} from '../lib/reglas';
import { Encabezado, EtiquetaEstado, Iniciales, Insignias, Meta, Modal, Punto, ComoSePrioriza, SEMAFORO_TXT, btnBorde, btnChico, btnNegro, textoRiesgo } from '../components/ui';

type FiltroEstado = 'todos' | Estado;
type Orden = 'proximo' | 'valor' | 'reciente' | 'nombre' | 'fallos';

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
  soloLectura = false,
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
  soloLectura?: boolean; // especialista: ve y deja notas; contactar y cambiar el seguimiento es de recepción
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
        soloLectura={soloLectura}
      />
    );
  return <Lista pacientes={datos.pacientes} hoy={hoy} onAbrir={onAbrir} onCrear={onCrear} soloLectura={soloLectura} />;
}

const ETIQUETAS: [string, string][] = [
  ['VIP', 'VIP'],
  ['Valoración virtual', 'Valoración virtual'],
  ['Rehabilitación', 'Rehabilitación'],
  ['Alineadores', 'Alineadores'],
  ['Convenio FLAIRES', 'Convenio FLAIRES'],
  ['sincel', 'Sin celular'],
];

function Campo({ t, children }: { t: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {t}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

// ---------------- lista ----------------
function Lista({ pacientes, hoy, onAbrir, onCrear, soloLectura }: { pacientes: Paciente[]; hoy: string; onAbrir: (id: string) => void; onCrear: (p: Paciente) => void; soloLectura: boolean }) {
  const [estado, setEstado] = useState<FiltroEstado>('todos');
  const [caso, setCaso] = useState<Caso | ''>('');
  const [grupo, setGrupo] = useState<Grupo | 0>(0);
  const [antiguedad, setAntiguedad] = useState<Antiguedad | ''>('');
  const [riesgo, setRiesgo] = useState(false);
  const [etiqueta, setEtiqueta] = useState('');
  const [orden, setOrden] = useState<Orden>('proximo');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [verFiltros, setVerFiltros] = useState(false);
  type Chip = [string, () => void];
  const chips: Chip[] = [
    ...(caso ? [[CASO_TXT[caso], () => setCaso('')] as Chip] : []),
    ...(grupo ? [[GRUPO_TXT[grupo], () => setGrupo(0)] as Chip] : []),
    ...(antiguedad ? [[antiguedad === 'Nuevo' ? 'Solo nuevos' : 'Solo antiguos', () => setAntiguedad('')] as Chip] : []),
    ...(etiqueta ? [[ETIQUETAS.find(([v]) => v === etiqueta)?.[1] ?? etiqueta, () => setEtiqueta('')] as Chip] : []),
    ...(riesgo ? [['Riesgo alto', () => setRiesgo(false)] as Chip] : []),
  ];
  const activos = [caso, grupo, antiguedad, etiqueta, riesgo].filter(Boolean).length;
  const limpiar = () => {
    setCaso('');
    setGrupo(0);
    setAntiguedad('');
    setEtiqueta('');
    setRiesgo(false);
  };

  const n = (e: Estado) => pacientes.filter((p) => p.estado === e).length;
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pacientes
      .filter(
        (p) =>
          (estado === 'todos' || p.estado === estado) &&
          (!caso || p.caso === caso) &&
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
            : orden === 'proximo'
              ? (fechaQueToca(a, hoy) ?? '9').localeCompare(fechaQueToca(b, hoy) ?? '9') || b.valor - a.valor
            : (ultimoContacto(b)?.fecha ?? b.fechaEvento).localeCompare(ultimoContacto(a)?.fecha ?? a.fechaEvento)
      );
  }, [pacientes, hoy, estado, caso, grupo, antiguedad, riesgo, etiqueta, orden, q]);

  return (
    <div>
      <Encabezado
        titulo="Pacientes"
        descripcion="Todos los pacientes que la app sigue. Toca uno para ver su historia: por qué entró a la lista, cada mensaje que se le envió y cómo terminó."
      >
        {!soloLectura && (
          <button onClick={() => setNuevo(true)} className={btnNegro}>
            <Plus className="size-4" /> Nuevo paciente
          </button>
        )}
      </Encabezado>

      {/* una sola barra: buscar, filtrar y ordenar */}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar paciente</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, # o celular" className="field rounded-full pl-10" />
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setVerFiltros((v) => !v)}
            aria-expanded={verFiltros}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ring-1 ${verFiltros || activos ? 'bg-ink text-white ring-ink' : 'bg-card text-ink/75 ring-line hover:text-ink'}`}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {activos > 0 && <span className="num rounded-full bg-white px-1.5 text-[11px] leading-4 text-ink">{activos}</span>}
          </button>
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <span className="sr-only">Ordenar</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="field rounded-full py-2.5 text-sm sm:w-56">
              <option value="proximo">A quién toca primero</option>
              <option value="reciente">Movimiento más reciente</option>
              <option value="valor">Mayor valor</option>
              <option value="nombre">Nombre A-Z</option>
              <option value="fallos">Más citas incumplidas</option>
            </select>
          </label>
        </div>
      </div>

      {verFiltros && (
        <div className="hoja card mt-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Campo t="Por qué está en la lista">
              <select value={caso} onChange={(e) => setCaso(e.target.value as Caso | '')} className="field py-2 text-sm">
                <option value="">Todos los casos</option>
                {Object.entries(CASO_TXT).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo t="Dónde quedó en la agenda">
              <select value={grupo} onChange={(e) => setGrupo(Number(e.target.value) as Grupo | 0)} className="field py-2 text-sm">
                <option value={0}>Todos</option>
                {([1, 2, 3, 4] as Grupo[]).map((g) => (
                  <option key={g} value={g}>
                    {GRUPO_TXT[g]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo t="Paciente">
              <select value={antiguedad} onChange={(e) => setAntiguedad(e.target.value as Antiguedad | '')} className="field py-2 text-sm">
                <option value="">Nuevos y antiguos</option>
                <option value="Nuevo">Solo nuevos</option>
                <option value="Antiguo">Solo antiguos</option>
              </select>
            </Campo>
            <Campo t="Etiqueta">
              <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className="field py-2 text-sm">
                <option value="">Todas</option>
                {ETIQUETAS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={riesgo} onChange={(e) => setRiesgo(e.target.checked)} className="size-4 accent-ink" />
              Solo riesgo alto <span className="text-muted">(3 o más citas seguidas sin asistir)</span>
            </label>
            <div className="flex gap-2">
              {activos > 0 && (
                <button onClick={limpiar} className={`${btnChico} text-muted hover:text-ink`}>
                  Quitar filtros
                </button>
              )}
              <button onClick={() => setVerFiltros(false)} className={`${btnChico} bg-ink text-white`}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* estados: solo los que tienen pacientes; se acomodan sin cortarse */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Estado del seguimiento">
        {(
          [
            ['todos', 'Todos', pacientes.length],
            ['pendiente', 'En seguimiento', n('pendiente')],
            ['recuperado', 'Recuperados', n('recuperado')],
            ['agotado', 'Sin respuesta', n('agotado')],
            ['descartado', 'No les interesa', n('descartado')],
            ['activo', 'Activos con cita', n('activo')],
          ] as [FiltroEstado, string, number][]
        )
          .filter(([id, , c]) => id === 'todos' || c > 0 || estado === id)
          .map(([id, t, c]) => (
            <button
              key={id}
              onClick={() => setEstado(id)}
              aria-pressed={estado === id}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${estado === id ? 'bg-ink text-white' : 'bg-card text-ink/70 ring-1 ring-line hover:text-ink'}`}
            >
              {t} <span className={`num ${estado === id ? 'text-white/60' : 'text-muted'}`}>{c}</span>
            </button>
          ))}
        {/* filtros activos a la vista: cada uno se quita con su X */}
        {chips.map(([t, quitar]) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-sky/25 py-1 pl-3 pr-1 text-[13px] font-medium">
            {t}
            <button onClick={quitar} aria-label={`Quitar filtro ${t}`} className="grid size-5 place-items-center rounded-full hover:bg-white">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="font-medium text-ink/70">Mensajes 3-7-15:</span>
        {[
          ['iris', 'agendó cita'],
          ['bg-ink', 'enviado, sin cita aún'],
          ['bg-rojo', 'no le interesa'],
          ['bg-line', 'por enviar'],
        ].map(([c, t]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2 w-4 rounded-full ${c}`} aria-hidden /> {t}
          </span>
        ))}
        <span className="ml-auto">
          {visibles.length.toLocaleString('es-CO')} {visibles.length === 1 ? 'paciente' : 'pacientes'}
        </span>
      </p>
      <div className="card mt-2 overflow-hidden">
        <div className="hidden grid-cols-[2fr_1.4fr_1fr_1.1fr_.7fr_1rem] gap-4 border-b border-line px-5 py-3 xl:grid">
          {['Paciente', 'Por qué está en la lista', 'Mensajes 3-7-15', 'Estado', 'Valor', ''].map((t, i) => (
            <span key={i} className={`kicker ${t === 'Valor' ? 'text-right' : ''}`}>
              {t}
            </span>
          ))}
        </div>
        <ul key={estado + caso + grupo + antiguedad + etiqueta + orden} className="escalonado divide-y divide-line">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onAbrir(p.id)}
                className="group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-5 py-4 text-left hover:bg-soft/60 xl:grid-cols-[2fr_1.4fr_1fr_1.1fr_.7fr_1rem] xl:gap-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Iniciales nombre={p.nombre} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold">{p.nombre}</span>
                      <Insignias p={p} />
                    </span>
                    <Meta p={p} className="block truncate" />
                  </span>
                </span>
                <span className="col-span-2 min-w-0 text-sm xl:col-span-1">
                  <span className="block truncate">{CASO_TXT[p.caso]}</span>
                  <span className="block truncate text-xs text-muted">{p.tratamiento}</span>
                </span>
                <span className="num col-start-2 row-start-1 text-sm font-semibold xl:col-start-5 xl:text-right">{p.valor ? pesosCorto(p.valor) : '—'}</span>
                <span className="col-span-2 flex items-center gap-3 xl:contents">
                  <MiniProceso p={p} />
                  <span className="min-w-0">
                    <EtiquetaEstado estado={p.estado} />
                    <Siguiente p={p} hoy={hoy} />
                  </span>
                </span>
                <ChevronRight className="hidden size-4 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/60 xl:block" aria-hidden />
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

// qué sigue con este paciente, en una frase corta
function Siguiente({ p, hoy }: { p: Paciente; hoy: string }) {
  const f = fechaQueToca(p, hoy);
  if (!f) return null;
  return <span className={`mt-0.5 block text-xs ${f <= hoy ? 'font-semibold text-rojo' : 'text-muted'}`}>{f <= hoy ? 'Toca contactar hoy' : `Próximo mensaje: ${fechaCorta(f)}`}</span>;
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
  soloLectura,
}: {
  p: Paciente;
  datos: Datos;
  hoy: string;
  onVolver: () => void;
  onContactar: (p: Paciente) => void;
  onNota: (id: string, texto: string) => void;
  onReactivar: (id: string) => void;
  onDescartar: (id: string) => void;
  soloLectura: boolean;
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
          {soloLectura ? (
            <p className="max-w-56 shrink-0 rounded-2xl bg-soft px-3.5 py-2.5 text-xs leading-relaxed text-ink/75">
              Recepción se encarga de contactarlo. Si quieres orientar el contacto, déjale una nota en la historia.
            </p>
          ) : (
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
          )}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line lg:grid-cols-4">
          <Clave k="Etapa">
            <span className="flex items-center gap-2">
              {color && <Punto color={color} />}
              {paso ? `${color ? SEMAFORO_TXT[color] : ''} · ${PASO_TXT[paso]}` : ESTADO_TXT[p.estado]}
            </span>
            {color && <span className="mt-0.5 block text-xs font-normal text-muted">{porQueSemaforo(p, hoy)}</span>}
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
          {p.estado === 'pendiente' && !soloLectura && (
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
