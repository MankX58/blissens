import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarCheck, Flag, Megaphone, MessageCircle, MessagesSquare, Plus, RotateCcw, Search, SlidersHorizontal, StickyNote, UserMinus } from 'lucide-react';
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
  diasEntre,
  fechaCorta,
  linkWhatsApp,
  pesos,
  pesosCorto,
  sumarDias,
  ultimoContacto,
} from '../lib/reglas';
import { Cifra, Encabezado, EtiquetaEstado, Iniciales, Insignias, Meta, Modal, Pestanas, QueEsFallo, Vacio, btnBorde, btnIris, btnNegro, textoRiesgo } from '../components/ui';

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
  const intentos = p.contactos.length + p.ciclos.reduce((s, c) => s + c.contactos.length, 0);
  const diasProceso = diasEntre(p.fechaEvento, p.recuperadoEl ?? hoy);
  const citas = datos.huecos.filter((h) => h.ocupadoPor === p.id).length;

  return (
    <div>
      <button onClick={onVolver} className="entrar mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Pacientes
      </button>

      <section className="entrar relative overflow-hidden rounded-[32px] bg-ink p-6 text-white sm:p-9">
        <div className="aura iris pointer-events-none absolute -right-20 -top-28 size-[340px] rounded-full opacity-30 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <Iniciales nombre={p.nombre} claro grande />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                <EtiquetaEstado estado={p.estado} />
                <Insignias p={p} oscuro detalle />
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{p.nombre}</h1>
              <p className="mt-1 text-sm text-white/55">
                {p.idPaciente} · {p.telefono || '⚠️ Sin celular'} {p.email && `· ${p.email}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.estado === 'pendiente' && (
              <button onClick={() => onContactar(p)} className={btnIris}>
                Contactar ahora
              </button>
            )}
            {p.telefono && (
              <a href={linkWhatsApp(p.telefono, '')} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
            {p.estado === 'pendiente' ? (
              <button onClick={() => onDescartar(p.id)} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white">
                <UserMinus className="size-4" /> Sacar del seguimiento
              </button>
            ) : (
              <button onClick={() => onReactivar(p.id)} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20">
                <RotateCcw className="size-4" /> Reactivar seguimiento
              </button>
            )}
          </div>
        </div>
      </section>

      <dl className="escalonado mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato k="Valor del plan" v={<Cifra valor={p.valor} formato={(n) => (p.valor ? pesosCorto(n) : '—')} />} />
        <Dato k={p.estado === 'recuperado' ? 'Días hasta recuperarlo' : 'Días en proceso'} v={<Cifra valor={diasProceso} />} />
        <Dato k="Intentos de contacto" v={<Cifra valor={intentos} />} />
        <Dato k="Citas por agenda libre" v={<Cifra valor={citas} />} />
      </dl>

      {/* proceso actual */}
      <section className="entrar card mt-4 p-6 sm:p-7">
        <h2 className="kicker">Proceso actual</h2>
        <ol className="mt-5 grid grid-cols-5 gap-2">
          <Nodo titulo={CASO_TXT[p.caso]} sub={fechaCorta(p.fechaEvento)} tono="mal" activo />
          {PASOS.map((d) => {
            const c = p.contactos.find((x) => x.paso === d);
            const tono = !c ? 'vacio' : c.resultado === 'agendo' ? 'ok' : c.resultado === 'no_interesa' ? 'mal' : 'hecho';
            return <Nodo key={d} titulo={`Día ${d}`} sub={c ? RESULTADO_TXT[c.resultado] : fechaCorta(sumarDias(p.fechaEvento, d))} tono={tono} activo={!!c} />;
          })}
          <Nodo
            titulo={p.estado === 'pendiente' ? 'Abierto' : ESTADO_TXT[p.estado]}
            sub={p.recuperadoEl ? fechaCorta(p.recuperadoEl) : p.estado === 'pendiente' ? 'en curso' : ''}
            tono={p.estado === 'recuperado' ? 'ok' : p.estado === 'pendiente' ? 'vacio' : 'hecho'}
            activo={p.estado !== 'pendiente'}
            ultimo
          />
        </ol>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <section className="entrar card p-6">
            <h2 className="kicker">Datos</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Fila k="Segmento SRS" v={`${p.grupo}. ${GRUPO_TXT[p.grupo]}`} />
              <Fila k="Riesgo de inasistencia" v={p.nivelRiesgo} />
              <Fila k="Seguidas sin asistir" v={String(p.fallosSeguidos)} />
              <Fila k="Fallos en todo el historial" v={String(p.fallosHistoricos)} />
              <Fila k="Última vez que asistió" v={p.ultimaAtendida ? fechaCorta(p.ultimaAtendida) : 'Nunca'} />
              <Fila k="Antigüedad" v={p.antiguedad} />
              {p.ultimaCita && <Fila k="Última cita" v={`${fechaCorta(p.ultimaCita.fecha)} · ${p.ultimaCita.estado}`} />}
              <Fila k="Comentario / tratamiento" v={p.tratamiento} />
              <Fila k="Especialista" v={p.especialista} />
              <Fila k="Motivo registrado" v={MOTIVO_TXT[p.motivo]} />
              <Fila k="Correo" v={p.email || '—'} />
              {p.apoderado && <Fila k="Apoderado" v={p.apoderado} />}
              {p.valor > 0 && <Fila k="Valor estimado (arancel)" v={pesos(p.valor)} />}
              {p.valorReferencia && <Fila k="Calculado con" v={`${p.valorReferencia.acciones.join(' + ')} (por ${p.valorReferencia.fuente})`} />}
              <Fila k="Origen" v={{ excel: 'Agenda en Excel', manual: 'Registro manual' }[p.origen]} />
              <Fila k="En el panel desde" v={fechaCorta(p.creadoEl)} />
              {p.ciclos.length > 0 && <Fila k="Procesos anteriores" v={String(p.ciclos.length)} />}
            </dl>
            <p className="mt-4 text-xs text-muted" title={textoRiesgo(p)}>
              {textoRiesgo(p)}.
            </p>
            <QueEsFallo className="mt-2" />
          </section>
          <section className="entrar card p-6">
            <h2 className="kicker">Nota interna</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!nota.trim()) return;
                onNota(p.id, nota.trim());
                setNota('');
              }}
            >
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder="Ej: prefiere que la llamen después de las 5 p. m."
                className="field mt-3"
              />
              <button disabled={!nota.trim()} className={`${btnNegro} mt-2 w-full`}>
                Guardar nota
              </button>
            </form>
          </section>
        </div>

        <section className="entrar card p-6 sm:p-7">
          <h2 className="kicker">Historia completa</h2>
          {eventos.length === 0 ? (
            <Vacio titulo="Sin movimientos" texto="Aquí aparecerán los contactos, campañas y citas del paciente." />
          ) : (
            <ol className="escalonado relative mt-5 space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
              {eventos.map((e, i) => {
                const Ico = ICONO[e.tipo];
                return (
                  <li key={i} className="relative flex gap-4">
                    <span
                      className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${
                        e.tono === 'ok' ? 'iris text-ink' : e.tono === 'mal' ? 'bg-rojo text-white' : 'bg-ink text-white'
                      }`}
                    >
                      <Ico className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="font-semibold">{e.titulo}</p>
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
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="card rounded-[22px] p-5">
      <dd className="text-[28px] font-bold leading-none tracking-tight">{v}</dd>
      <dt className="mt-2 text-xs text-muted">{k}</dt>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Nodo({ titulo, sub, tono, activo, ultimo }: { titulo: string; sub: string; tono: 'ok' | 'mal' | 'hecho' | 'vacio'; activo: boolean; ultimo?: boolean }) {
  const punto = { ok: 'iris', mal: 'bg-rojo', hecho: 'bg-ink', vacio: 'bg-white ring-2 ring-line' }[tono];
  return (
    <li className="relative">
      {!ultimo && <span className={`absolute left-3 right-0 top-[11px] h-0.5 ${activo ? 'bg-ink/80' : 'bg-line'} crecer-x`} />}
      <span className={`pop relative z-10 block size-6 rounded-full ${punto}`} />
      <p className="mt-3 text-[13px] font-semibold leading-tight">{titulo}</p>
      <p className="text-xs text-muted">{sub}</p>
    </li>
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
