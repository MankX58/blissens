import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Download, MessageCircle, Pause, Play, Plug, RotateCcw, Send, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Campana, ConfigWA, EstadoEnvio, Paciente } from '../types';
import { AUDIENCIAS, ESTADO_CAMPANA_TXT, apiConectada, personalizar } from '../lib/campanas';
import { linkWhatsApp } from '../lib/reglas';
import { Encabezado, Etiqueta, Modal, Vacio, btnBorde, btnChico, btnIris, btnNegro } from '../components/ui';

const RITMOS: [number, string][] = [
  [5, 'Cada 5 segundos'],
  [15, 'Cada 15 segundos'],
  [30, 'Cada 30 segundos'],
  [60, 'Cada minuto'],
];

const ESTADO_ENVIO: Record<EstadoEnvio, { t: string; tono: 'claro' | 'ok' | 'mal' | 'oscuro' | 'iris' }> = {
  pendiente: { t: 'En cola', tono: 'claro' },
  enviado: { t: 'Enviado', tono: 'oscuro' },
  respondio: { t: 'Respondió', tono: 'iris' },
  fallo: { t: 'Falló', tono: 'mal' },
  omitido: { t: 'Omitido', tono: 'claro' },
};

const duracion = (seg: number) => (seg < 60 ? `${seg} s` : seg < 3600 ? `${Math.round(seg / 60)} min` : `${(seg / 3600).toFixed(1)} h`);
const ahoraLocal = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function Campanas({
  pacientes,
  campanas,
  config,
  onCrear,
  onActualizar,
  onBorrar,
  onConfig,
  onAbrir,
}: {
  pacientes: Paciente[];
  campanas: Campana[];
  config: ConfigWA;
  onCrear: (c: Campana) => void;
  onActualizar: (id: string, fn: (c: Campana) => Campana) => void;
  onBorrar: (id: string) => void;
  onConfig: (c: ConfigWA) => void;
  onAbrir: (id: string) => void;
}) {
  const conectada = apiConectada(config);
  const [verConfig, setVerConfig] = useState(false);
  const [audId, setAudId] = useState(AUDIENCIAS[0].id);
  const aud = AUDIENCIAS.find((a) => a.id === audId)!;
  const mes = new Date().toLocaleDateString('es-CO', { month: 'long' });
  const [nombre, setNombre] = useState(`${aud.titulo} · ${mes}`);
  const [plantilla, setPlantilla] = useState(aud.plantilla);
  const [cuando, setCuando] = useState<'ahora' | 'programar'>('ahora');
  const [fecha, setFecha] = useState(ahoraLocal);
  const [ritmo, setRitmo] = useState(15);
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [verLista, setVerLista] = useState(false);

  const posibles = (filtro: (p: Paciente) => boolean) =>
    pacientes.filter((p) => (p.estado === 'pendiente' || p.estado === 'agotado') && p.telefono && filtro(p));
  const lista = useMemo(() => posibles(aud.filtro), [pacientes, aud]);
  const elegidos = lista.filter((p) => !quitados.has(p.id));

  const elegirAudiencia = (id: string) => {
    const a = AUDIENCIAS.find((x) => x.id === id)!;
    setAudId(id);
    setNombre(`${a.titulo} · ${mes}`);
    setPlantilla(a.plantilla);
    setQuitados(new Set());
  };

  const lanzar = () => {
    const inicio = cuando === 'ahora' ? new Date().toISOString() : new Date(fecha).toISOString();
    onCrear({
      id: `c-${Date.now()}`,
      nombre: nombre.trim() || aud.titulo,
      audiencia: aud.titulo,
      plantilla,
      creadaEl: new Date().toISOString(),
      inicio,
      ritmoSeg: ritmo,
      canal: conectada ? 'api' : 'simulado',
      estado: 'programada',
      envios: elegidos.map((p) => ({ pacienteId: p.id, nombre: p.nombre, telefono: p.telefono, texto: personalizar(plantilla, p), estado: 'pendiente' })),
    });
    setQuitados(new Set());
  };

  const insertar = (v: string) => setPlantilla((t) => `${t}${t.endsWith(' ') ? '' : ' '}${v}`);

  return (
    <div>
      <Encabezado
        roles={['mercadeo']}
        titulo="Campañas automáticas"
        descripcion="Elige un grupo de pacientes, escribe un mensaje y el panel lo envía a todos por WhatsApp, uno tras otro, sin que tengas que hacerlo a mano."
      >
        <button onClick={() => setVerConfig(true)} className={btnBorde}>
          <Plug className="size-4" /> {conectada ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
        </button>
      </Encabezado>

      {!conectada && (
        <div className="entrar mt-6 flex flex-col gap-3 rounded-[22px] border border-lilac/60 bg-lilac/15 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            <b>Modo simulación.</b> Las campañas corren y quedan registradas, pero los mensajes no salen. Conecta WhatsApp Business API para enviarlos de verdad.
          </p>
          <button onClick={() => setVerConfig(true)} className={`${btnChico} shrink-0 bg-ink text-white`}>
            Configurar
          </button>
        </div>
      )}

      {/* constructor */}
      <section className="entrar card mt-6 overflow-hidden">
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-8 p-6 sm:p-8">
            <Paso n={1} titulo="¿A quién le escribimos?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AUDIENCIAS.map((a) => {
                  const n = posibles(a.filtro).length;
                  const activo = a.id === audId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => elegirAudiencia(a.id)}
                      className={`rounded-2xl border p-3 text-left ${activo ? 'border-ink bg-ink text-white shadow-lg shadow-ink/10' : 'border-line bg-white hover:border-ink/30'}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{a.titulo}</span>
                        <span className={`num rounded-full px-1.5 text-[11px] font-bold ${activo ? 'iris text-ink' : 'bg-soft'}`}>{n}</span>
                      </span>
                      <span className={`mt-1 block text-[11.5px] leading-snug ${activo ? 'text-white/60' : 'text-muted'}`}>{a.descripcion}</span>
                    </button>
                  );
                })}
              </div>
            </Paso>

            <Paso n={2} titulo="Mensaje">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="field" aria-label="Nombre de la campaña" placeholder="Nombre de la campaña" />
              <textarea value={plantilla} onChange={(e) => setPlantilla(e.target.value)} rows={5} className="field mt-2 leading-relaxed" aria-label="Mensaje" />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                Insertar:
                {['{nombre}', '{tratamiento}', '{especialista}'].map((v) => (
                  <button key={v} onClick={() => insertar(v)} className={`${btnChico} bg-soft font-mono text-ink/70 hover:text-ink`}>
                    {v}
                  </button>
                ))}
              </div>
            </Paso>

            <Paso n={3} titulo="Envío">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full bg-soft p-1">
                  {(['ahora', 'programar'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCuando(c)}
                      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${cuando === c ? 'bg-white shadow-sm' : 'text-ink/55'}`}
                    >
                      {c === 'ahora' ? 'Enviar ahora' : 'Programar'}
                    </button>
                  ))}
                </div>
                {cuando === 'programar' && (
                  <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="field w-auto" aria-label="Fecha y hora" />
                )}
                <select value={ritmo} onChange={(e) => setRitmo(+e.target.value)} className="field w-auto" aria-label="Ritmo de envío">
                  {RITMOS.map(([s, t]) => (
                    <option key={s} value={s}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-xs text-muted">
                Enviar con pausas evita que WhatsApp marque el número como spam. Tiempo estimado: {duracion(elegidos.length * ritmo)}. El envío avanza mientras el panel esté
                abierto.
              </p>
            </Paso>
          </div>

          {/* vista previa + destinatarios */}
          <div className="flex flex-col border-t border-line bg-soft/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="kicker">Vista previa</p>
            <div className="mt-3 rounded-[26px] bg-[#e9e2d6] p-4">
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-4 py-3 text-[13.5px] leading-relaxed shadow-sm">
                {elegidos[0] ? personalizar(plantilla, elegidos[0]) : plantilla}
                <span className="mt-1 block text-right text-[10px] text-ink/40">
                  {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} ✓✓
                </span>
              </div>
            </div>

            <button onClick={() => setVerLista((v) => !v)} className="mt-6 flex items-center justify-between text-left">
              <span>
                <span className="kicker">Destinatarios</span>
                <span className="block text-sm">
                  <b>{elegidos.length}</b> de {lista.length} seleccionados
                </span>
              </span>
              <ChevronDown className={`size-4 transition-transform ${verLista ? 'rotate-180' : ''}`} />
            </button>
            {verLista && (
              <ul className="hoja mt-3 max-h-56 divide-y divide-line overflow-y-auto rounded-2xl bg-white px-3">
                {lista.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={!quitados.has(p.id)}
                        onChange={() =>
                          setQuitados((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                        className="size-4 accent-ink"
                      />
                      <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                      <span className="text-xs text-muted">{p.telefono}</span>
                    </label>
                  </li>
                ))}
                {lista.length === 0 && <li className="py-3 text-sm text-muted">Nadie en este grupo por ahora.</li>}
              </ul>
            )}

            <button disabled={!elegidos.length || !plantilla.trim()} onClick={lanzar} className={`${btnIris} mt-auto w-full py-3.5 text-[15px]`} style={{ marginTop: 24 }}>
              <Send className="size-4" />
              {cuando === 'ahora' ? `Lanzar campaña a ${elegidos.length}` : `Programar para ${elegidos.length}`}
            </button>
          </div>
        </div>
      </section>

      {/* campañas */}
      <h2 className="mt-12 text-xl font-bold tracking-tight">Campañas</h2>
      <div className="escalonado mt-4 space-y-3">
        {campanas.length === 0 && <Vacio titulo="Aún no hay campañas" texto="Lanza la primera arriba; aquí verás su avance en vivo." />}
        {campanas.map((c) => (
          <TarjetaCampana key={c.id} c={c} onActualizar={onActualizar} onBorrar={onBorrar} onAbrir={onAbrir} />
        ))}
      </div>

      <ConfigModal key={String(verConfig)} abierto={verConfig} config={config} onCerrar={() => setVerConfig(false)} onGuardar={(c) => (onConfig(c), setVerConfig(false))} />
    </div>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2.5 font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-xs font-bold text-white">{n}</span>
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function TarjetaCampana({
  c,
  onActualizar,
  onBorrar,
  onAbrir,
}: {
  c: Campana;
  onActualizar: (id: string, fn: (c: Campana) => Campana) => void;
  onBorrar: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const [abierta, setAbierta] = useState(c.estado === 'enviando');
  const n = (e: EstadoEnvio) => c.envios.filter((x) => x.estado === e).length;
  const total = c.envios.length || 1;
  const hechos = c.envios.filter((x) => x.estado !== 'pendiente').length;
  const activa = c.estado === 'enviando' || c.estado === 'programada';
  const set = (estado: Campana['estado']) => onActualizar(c.id, (x) => ({ ...x, estado }));
  const programadaFutura = c.estado === 'programada' && Date.parse(c.inicio) > Date.now();

  const descargar = () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(c.envios.map((e) => ({ Paciente: e.nombre, Celular: e.telefono, Estado: ESTADO_ENVIO[e.estado].t, Fecha: e.fecha ?? '', Mensaje: e.texto, Error: e.error ?? '' }))),
      'Envíos'
    );
    XLSX.writeFile(libro, `campana-${c.nombre.replace(/[^\w]+/g, '-').toLowerCase()}.xlsx`);
  };

  return (
    <article className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{c.nombre}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-semibold">
                <span className={`size-1.5 rounded-full ${c.estado === 'enviando' ? 'latido bg-lilac' : c.estado === 'completada' ? 'bg-verde' : c.estado === 'cancelada' ? 'bg-rojo' : 'bg-ink/40'}`} />
                {programadaFutura ? `Programada · ${new Date(c.inicio).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}` : ESTADO_CAMPANA_TXT[c.estado]}
              </span>
              <Etiqueta>{c.canal === 'api' ? 'WhatsApp API' : 'Simulación'}</Etiqueta>
            </div>
            <p className="mt-1 text-sm text-muted">
              {c.audiencia} · {c.envios.length} pacientes · 1 mensaje cada {c.ritmoSeg} s
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activa && (
              <button onClick={() => set('pausada')} className={`${btnChico} bg-soft hover:bg-line`}>
                <Pause className="size-3.5" /> Pausar
              </button>
            )}
            {c.estado === 'pausada' && (
              <button onClick={() => set('enviando')} className={`${btnChico} bg-ink text-white`}>
                <Play className="size-3.5" /> Reanudar
              </button>
            )}
            {n('fallo') > 0 && !activa && (
              <button
                onClick={() => onActualizar(c.id, (x) => ({ ...x, estado: 'enviando', envios: x.envios.map((e) => (e.estado === 'fallo' ? { ...e, estado: 'pendiente', error: undefined } : e)) }))}
                className={`${btnChico} bg-soft hover:bg-line`}
              >
                <RotateCcw className="size-3.5" /> Reintentar fallidos
              </button>
            )}
            {(activa || c.estado === 'pausada') && (
              <button onClick={() => set('cancelada')} className={`${btnChico} text-muted hover:bg-soft hover:text-ink`}>
                <X className="size-3.5" /> Cancelar
              </button>
            )}
            <button onClick={descargar} className={`${btnChico} text-muted hover:bg-soft hover:text-ink`} aria-label="Descargar envíos">
              <Download className="size-3.5" />
            </button>
            {!activa && c.estado !== 'pausada' && (
              <button onClick={() => onBorrar(c.id)} className={`${btnChico} text-muted hover:bg-soft hover:text-rojo`} aria-label="Eliminar campaña">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* progreso */}
        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-soft">
          <div className="bg-ink transition-[width] duration-700" style={{ width: `${(n('enviado') / total) * 100}%` }} />
          <div className="iris transition-[width] duration-700" style={{ width: `${(n('respondio') / total) * 100}%` }} />
          <div className="bg-rojo transition-[width] duration-700" style={{ width: `${(n('fallo') / total) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <b className="num text-ink">{hechos}</b>/{c.envios.length} procesados
            </span>
            <span>
              <b className="num text-ink">{n('respondio')}</b> respondieron
            </span>
            {n('fallo') > 0 && (
              <span className="text-rojo">
                <b className="num">{n('fallo')}</b> fallaron
              </span>
            )}
          </span>
          <button onClick={() => setAbierta((v) => !v)} className="flex items-center gap-1 font-semibold text-ink">
            {abierta ? 'Ocultar detalle' : 'Ver detalle'} <ChevronDown className={`size-3.5 transition-transform ${abierta ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {abierta && (
        <ul className="hoja max-h-80 divide-y divide-line overflow-y-auto border-t border-line bg-paper/60">
          {c.envios.map((e, i) => (
            <li key={e.pacienteId + i} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm sm:px-6">
              <button onClick={() => onAbrir(e.pacienteId)} className="min-w-0 flex-1 truncate text-left font-medium hover:underline">
                {e.nombre}
              </button>
              {e.error && <span className="max-w-[220px] truncate text-xs text-rojo" title={e.error}>{e.error}</span>}
              {e.fecha && <span className="num text-xs text-muted">{new Date(e.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
              <span key={e.estado} className="pop">
                <Etiqueta tono={ESTADO_ENVIO[e.estado].tono}>{ESTADO_ENVIO[e.estado].t}</Etiqueta>
              </span>
              {(e.estado === 'enviado' || e.estado === 'respondio') && (
                <button
                  onClick={() =>
                    onActualizar(c.id, (x) => ({
                      ...x,
                      envios: x.envios.map((y, j) => (j === i ? { ...y, estado: y.estado === 'respondio' ? 'enviado' : 'respondio' } : y)),
                    }))
                  }
                  className={`${btnChico} bg-soft text-ink/70 hover:text-ink`}
                >
                  {e.estado === 'respondio' ? 'Quitar respuesta' : 'Respondió'}
                </button>
              )}
              <a href={linkWhatsApp(e.telefono, e.texto)} target="_blank" rel="noopener" className="rounded-full p-1.5 text-muted hover:bg-soft hover:text-ink" aria-label="Abrir en WhatsApp">
                <MessageCircle className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ConfigModal({ abierto, config, onCerrar, onGuardar }: { abierto: boolean; config: ConfigWA; onCerrar: () => void; onGuardar: (c: ConfigWA) => void }) {
  const [c, setC] = useState(config);
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Conectar WhatsApp Business" ancho="max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGuardar(c);
        }}
        className="p-6 sm:p-8"
      >
        <h2 className="text-2xl font-bold tracking-tight">Conectar WhatsApp Business</h2>
        <p className="mt-2 text-sm text-muted">
          Con la API oficial de Meta (WhatsApp Cloud API) las campañas salen solas desde el número de la clínica. Los datos se obtienen en Meta for Developers → WhatsApp →
          Configuración de la API.
        </p>
        <div className="mt-6 space-y-3">
          <label className="block text-xs font-medium text-muted">
            Token de acceso
            <input type="password" value={c.token} onChange={(e) => setC({ ...c, token: e.target.value })} className="field mt-1" autoComplete="off" />
          </label>
          <label className="block text-xs font-medium text-muted">
            ID del número de teléfono
            <input value={c.phoneId} onChange={(e) => setC({ ...c, phoneId: e.target.value })} className="field mt-1" placeholder="Ej: 106540352242922" />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="block text-xs font-medium text-muted">
              Plantilla aprobada (opcional)
              <input value={c.plantilla} onChange={(e) => setC({ ...c, plantilla: e.target.value })} className="field mt-1" placeholder="recuperacion_pacientes" />
            </label>
            <label className="block text-xs font-medium text-muted">
              Idioma
              <input value={c.idioma} onChange={(e) => setC({ ...c, idioma: e.target.value })} className="field mt-1" placeholder="es" />
            </label>
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-soft p-3 text-xs leading-relaxed text-muted">
          WhatsApp solo permite mensajes libres a quien escribió en las últimas 24 h. Para campañas a pacientes que no han escrito, usa una plantilla aprobada por Meta; el
          panel le pasa el nombre del paciente como variable. En este prototipo el token se guarda en este navegador; en producción debe ir en un servidor.
        </p>
        <div className="mt-6 flex justify-between gap-2">
          <button type="button" onClick={() => onGuardar({ token: '', phoneId: '', plantilla: '', idioma: 'es' })} className={btnBorde}>
            Desconectar
          </button>
          <button className={btnNegro}>Guardar conexión</button>
        </div>
      </form>
    </Modal>
  );
}
