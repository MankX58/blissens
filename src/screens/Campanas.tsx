import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Download, MessageCircle, Pause, Play, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Campana, EstadoEnvio, Paciente } from '../types';
import { AUDIENCIAS, ESTADO_CAMPANA_TXT, personalizar, proximoHorario } from '../lib/campanas';
import { TEXTO_AUTORIZACION } from '../lib/guiones';
import type { AccionCampana, NuevaCampana } from '../lib/api';
import { consentimiento, enHorarioClinica, linkWhatsApp, noContactar, normalizarCelular } from '../lib/reglas';
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
const aLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const ahoraLocal = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return aLocal(proximoHorario(d));
};
const HORARIO_TXT = 'lunes a viernes de 8:00 a 12:00 y de 13:00 a 17:00';

export function Campanas({
  pacientes,
  campanas,
  whatsapp,
  onCrear,
  onAccion,
  onRespuesta,
  onBorrar,
  onAbrir,
  hoy,
  onEnviarManual,
}: {
  hoy: string;
  onEnviarManual: (id: string, envio: string) => void;
  pacientes: Paciente[];
  campanas: Campana[];
  whatsapp: { conectado: boolean; modo: string };
  onCrear: (c: NuevaCampana) => Promise<boolean>;
  onAccion: (id: string, accion: AccionCampana) => void;
  onRespuesta: (id: string, envio: string, respondio: boolean) => void;
  onBorrar: (id: string) => void;
  onAbrir?: (id: string) => void; // campañas no abre expedientes clínicos
}) {
  // solo cuenta como API real si el modo es Meta Cloud; si no, la clínica envía por WhatsApp Web (cola asistida)
  const conectada = whatsapp.conectado && whatsapp.modo === 'meta_cloud';
  const [verConfig, setVerConfig] = useState(false);
  const [verAutorizacion, setVerAutorizacion] = useState(false);
  const [nueva, setNueva] = useState<string | null>(null); // id de la audiencia con la que abre el asistente

  // quién puede recibir: con celular válido, sin «no contactar» y sin negar la autorización de WhatsApp
  const posibles = (a: Pick<(typeof AUDIENCIAS)[number], 'filtro' | 'estados'>) =>
    pacientes.filter(
      (p) =>
        (a.estados ?? ['pendiente', 'agotado']).includes(p.estado) &&
        !!normalizarCelular(p.telefono) &&
        !noContactar(p) &&
        consentimiento(p) !== false &&
        a.filtro(p, hoy)
    );
  const audiencias = useMemo(() => AUDIENCIAS.map((a) => ({ ...a, n: posibles(a).length })), [pacientes, hoy]);
  const sugeridas = [...audiencias].filter((a) => a.n > 0).sort((a, b) => Number(b.id === 'agotado') - Number(a.id === 'agotado') || b.n - a.n).slice(0, 3);

  const envios = campanas.flatMap((c) => c.envios);
  const enviados = envios.filter((e) => e.estado === 'enviado' || e.estado === 'respondio').length;
  const respondieron = envios.filter((e) => e.estado === 'respondio').length;
  const enCurso = campanas.filter((c) => c.estado === 'enviando' || c.estado === 'programada' || c.estado === 'pausada').length;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Encabezado titulo="Campañas" descripcion="Mensajes de WhatsApp personalizados a un grupo de pacientes, para recuperar a quien el seguimiento diario no alcanzó.">
          <button onClick={() => setNueva(sugeridas[0]?.id ?? AUDIENCIAS[0].id)} className={`${btnNegro} shrink-0`}>
            <Plus className="size-4" aria-hidden /> Nueva campaña
          </button>
        </Encabezado>

        {/* canal de envío: cómo salen los mensajes y en qué horario, con sus dos ayudas a un clic */}
        <div className="entrar flex flex-col gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-w-0 items-start gap-2.5">
            <span className="relative mt-1.5 flex size-2 shrink-0" aria-hidden>
              <span className={`absolute inset-0 rounded-full ${conectada ? 'bg-verde' : 'bg-amarillo'} ${enHorarioClinica() ? 'animate-ping opacity-60' : ''}`} />
              <span className={`relative size-2 rounded-full ${conectada ? 'bg-verde' : 'bg-amarillo'}`} />
            </span>
            <span className="min-w-0">
              <b className="font-semibold">{conectada ? 'WhatsApp Business conectado' : 'Envío asistido por WhatsApp Web'}</b>
              <span className="text-muted">
                {' · '}
                {conectada ? 'los mensajes salen solos' : 'un clic abre cada mensaje listo para enviar'} · {enHorarioClinica() ? 'en horario de recepción' : 'fuera de horario (L-V 8-12 y 13-17)'}
              </span>
            </span>
          </p>
          <span className="flex shrink-0 gap-1 pl-[18px] sm:pl-0">
            <button onClick={() => setVerConfig(true)} className={`${btnChico} whitespace-nowrap text-ink/70 hover:bg-soft hover:text-ink`}>
              ¿Cómo funciona?
            </button>
            <button onClick={() => setVerAutorizacion(true)} className={`${btnChico} whitespace-nowrap bg-soft text-ink/80 hover:text-ink`}>
              Formato de autorización
            </button>
          </span>
        </div>
      </div>

      {/* resumen */}
      <dl className="entrar card grid grid-cols-3 gap-px overflow-hidden bg-line p-0">
        {[
          ['En curso', String(enCurso), enCurso === 1 ? 'campaña' : 'campañas'],
          ['Mensajes enviados', String(enviados), `en ${campanas.length} ${campanas.length === 1 ? 'campaña' : 'campañas'}`],
          ['Respondieron', enviados ? `${Math.round((respondieron / enviados) * 100)} %` : '—', `${respondieron} pacientes`],
        ].map(([k, v, sub]) => (
          <div key={k} className="bg-white p-4 sm:p-5">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight">{v}</dd>
            <dd className="text-xs text-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      {/* atajos: a quién conviene escribirle */}
      {sugeridas.length > 0 && (
        <section aria-labelledby="t-sugeridas">
          <h2 id="t-sugeridas" className="kicker mb-3">
            Para empezar
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {sugeridas.map((a) => (
              <li key={a.id}>
                <button onClick={() => setNueva(a.id)} className="card lift group flex h-full w-full flex-col rounded-[22px] p-5 text-left">
                  <span className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">{a.n}</span>
                    <span className="text-sm text-muted">con celular</span>
                  </span>
                  <span className="mt-2 font-semibold">{a.titulo}</span>
                  <span className="mt-0.5 text-sm text-muted">{a.descripcion}</span>
                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold">
                    Crear campaña <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* campañas */}
      <section aria-labelledby="t-campanas">
        <h2 id="t-campanas" className="kicker mb-3">
          Tus campañas
        </h2>
        {campanas.length === 0 ? (
          <Vacio titulo="Aún no hay campañas" texto="Elige un grupo arriba o crea una nueva. Aquí verás cómo avanza cada envío y quién responde.">
            <button onClick={() => setNueva(sugeridas[0]?.id ?? AUDIENCIAS[0].id)} className={btnNegro}>
              <Plus className="size-4" aria-hidden /> Nueva campaña
            </button>
          </Vacio>
        ) : (
          <div className="escalonado space-y-3">
            {campanas.map((c) => (
              <TarjetaCampana key={c.id} c={c} onAccion={onAccion} onRespuesta={onRespuesta} onBorrar={onBorrar} onAbrir={onAbrir} onEnviarManual={onEnviarManual} />
            ))}
          </div>
        )}
      </section>

      {nueva && (
        <Asistente
          inicial={nueva}
          audiencias={audiencias}
          posibles={posibles}
          conectada={conectada}
          onCerrar={() => setNueva(null)}
          onCrear={async (c) => {
            const ok = await onCrear(c);
            if (ok) setNueva(null);
            return ok;
          }}
        />
      )}
      <ComoConectar abierto={verConfig} conectado={conectada} onCerrar={() => setVerConfig(false)} />
      <Modal abierto={verAutorizacion} onCerrar={() => setVerAutorizacion(false)} titulo="Formato de autorización" ancho="max-w-xl">
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Autorización para escribir por WhatsApp</h2>
          <p className="mt-2 text-sm text-muted">
            Envíelo antes de incluir a un paciente en campañas (Ley 1581 de 2012). Registre la respuesta en «Contactar» o en la ficha: quien responde «No» queda fuera de las campañas.
          </p>
          <p className="mt-4 whitespace-pre-line rounded-2xl bg-soft p-4 text-sm leading-relaxed">{TEXTO_AUTORIZACION.replace('[NOMBRE]', '{nombre}')}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => navigator.clipboard?.writeText(TEXTO_AUTORIZACION.replace('Hola, [NOMBRE]. ', 'Hola. ')).catch(() => undefined)} className={btnBorde}>
              Copiar
            </button>
            <button onClick={() => setVerAutorizacion(false)} className={btnNegro}>
              Listo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------- asistente de 3 pasos: a quién, qué decir, cuándo ----------
const PASOS_ASISTENTE = ['A quién', 'Mensaje', 'Revisar y enviar'] as const;

function Asistente({
  inicial,
  audiencias,
  posibles,
  conectada,
  onCerrar,
  onCrear,
}: {
  inicial: string;
  audiencias: ((typeof AUDIENCIAS)[number] & { n: number })[];
  posibles: (a: Pick<(typeof AUDIENCIAS)[number], 'filtro' | 'estados'>) => Paciente[];
  conectada: boolean;
  onCerrar: () => void;
  onCrear: (c: NuevaCampana) => Promise<boolean>;
}) {
  const mes = new Date().toLocaleDateString('es-CO', { month: 'long' });
  const [paso, setPaso] = useState(0);
  const [audId, setAudId] = useState(inicial);
  const aud = AUDIENCIAS.find((a) => a.id === audId)!;
  const [nombre, setNombre] = useState(`${aud.titulo} · ${mes}`);
  const [plantilla, setPlantilla] = useState(aud.plantilla);
  const [cuando, setCuando] = useState<'ahora' | 'programar'>('ahora');
  const [fecha, setFecha] = useState(ahoraLocal);
  const [ritmo, setRitmo] = useState(15);
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [lanzando, setLanzando] = useState(false);

  const lista = useMemo(() => posibles(aud), [aud]);
  const fueraDeHorario = cuando === 'ahora' ? !enHorarioClinica() : !enHorarioClinica(new Date(fecha));
  const elegidos = lista.filter((p) => !quitados.has(p.id));
  const elegirAudiencia = (id: string) => {
    const a = AUDIENCIAS.find((x) => x.id === id)!;
    setAudId(id);
    setNombre(`${a.titulo} · ${mes}`);
    setPlantilla(a.plantilla);
    setQuitados(new Set());
  };
  const insertar = (v: string) => setPlantilla((t) => `${t}${t.endsWith(' ') ? '' : ' '}${v}`);
  const puedeSeguir = paso === 0 ? lista.length > 0 : paso === 1 ? !!plantilla.trim() : elegidos.length > 0 && !lanzando;

  const lanzar = async () => {
    setLanzando(true);
    await onCrear({
      nombre: nombre.trim() || aud.titulo,
      audiencia: aud.titulo,
      plantilla,
      inicio: cuando === 'ahora' ? new Date().toISOString() : new Date(fecha).toISOString(),
      ritmoSeg: ritmo,
      envios: elegidos.map((p) => ({ pacienteId: p.id, texto: personalizar(plantilla, p) })),
    });
    setLanzando(false);
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Nueva campaña" ancho="max-w-4xl">
      <header className="border-b border-line p-5 pr-16 sm:px-8 sm:py-6">
        <h2 className="text-xl font-bold tracking-tight">Nueva campaña</h2>
        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Pasos">
          {PASOS_ASISTENTE.map((t, i) => (
            <li key={t} className="flex items-center gap-2" aria-current={i === paso ? 'step' : undefined}>
              <button
                onClick={() => i < paso && setPaso(i)}
                disabled={i > paso}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 font-semibold ${i === paso ? 'bg-ink text-white' : i < paso ? 'text-ink hover:bg-soft' : 'text-muted'}`}
              >
                <span className={`grid size-6 place-items-center rounded-full text-xs ${i === paso ? 'bg-white text-ink' : i < paso ? 'bg-verde text-white' : 'bg-soft'}`}>
                  {i < paso ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                {t}
              </button>
              {i < PASOS_ASISTENTE.length - 1 && <span className="h-px w-5 bg-line" aria-hidden />}
            </li>
          ))}
        </ol>
      </header>

      <div className="p-5 sm:p-8">
        {paso === 0 && (
          <fieldset>
            <legend className="mb-3 text-sm text-muted">Elige el grupo de pacientes. Solo cuentan los que tienen celular y siguen pendientes.</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {audiencias.map((a) => {
                const activo = a.id === audId;
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${a.n === 0 ? 'cursor-not-allowed opacity-50' : ''} ${
                      activo ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/30'
                    }`}
                  >
                    <input type="radio" name="audiencia" className="sr-only" checked={activo} disabled={a.n === 0} onChange={() => elegirAudiencia(a.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{a.titulo}</span>
                      <span className={`block text-xs ${activo ? 'text-white/70' : 'text-muted'}`}>{a.descripcion}</span>
                    </span>
                    <span className={`num shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${activo ? 'iris text-ink' : 'bg-soft'}`}>{a.n}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {paso === 1 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <label className="block text-sm font-medium">
                Nombre de la campaña
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="field mt-1" />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Mensaje
                <textarea value={plantilla} onChange={(e) => setPlantilla(e.target.value)} rows={7} className="field mt-1 leading-relaxed" />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                Insertar dato del paciente:
                {[
                  ['{nombre}', 'Nombre'],
                  ['{tratamiento}', 'Tratamiento'],
                  ['{especialista}', 'Especialista'],
                ].map(([v, t]) => (
                  <button key={v} onClick={() => insertar(v)} className={`${btnChico} bg-soft text-ink/75 hover:text-ink`}>
                    + {t}
                  </button>
                ))}
              </div>
            </div>
            <Vista texto={lista[0] ? personalizar(plantilla, lista[0]) : plantilla} quien={lista[0]?.nombre} />
          </div>
        )}

        {paso === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium">¿Cuándo?</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-full bg-soft p-1" role="radiogroup" aria-label="Cuándo enviar">
                    {(['ahora', 'programar'] as const).map((c) => (
                      <button
                        key={c}
                        role="radio"
                        aria-checked={cuando === c}
                        onClick={() => setCuando(c)}
                        className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${cuando === c ? 'bg-white shadow-sm' : 'text-ink/65'}`}
                      >
                        {c === 'ahora' ? 'Ahora' : 'Programar'}
                      </button>
                    ))}
                  </div>
                  {cuando === 'programar' && <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="field w-auto" aria-label="Fecha y hora" />}
                </div>
              </div>
              <label className="block text-sm font-medium">
                Ritmo de envío
                <select value={ritmo} onChange={(e) => setRitmo(+e.target.value)} className="field mt-1 w-auto">
                  {RITMOS.map(([s, t]) => (
                    <option key={s} value={s}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">Enviar con pausas evita que WhatsApp marque el número como spam.</span>
              </label>
              {fueraDeHorario && (
                <p className="rounded-2xl border border-amarillo/40 bg-amarillo/10 p-3 text-xs leading-relaxed">
                  <b>Fuera del horario de recepción</b> ({HORARIO_TXT}): nadie podrá responder a quien conteste.{' '}
                  <button
                    onClick={() => {
                      setCuando('programar');
                      setFecha(aLocal(proximoHorario()));
                    }}
                    className="font-semibold underline"
                  >
                    Programar para el próximo horario
                  </button>
                </p>
              )}
              <details className="group rounded-2xl border border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm [&::-webkit-details-marker]:hidden">
                  <span>
                    <b>{elegidos.length}</b> de {lista.length} destinatarios
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-ink/70">
                    Revisar <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                  </span>
                </summary>
                <ul className="max-h-60 divide-y divide-line overflow-y-auto border-t border-line px-4">
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
                </ul>
              </details>
            </div>
            <div className="h-fit rounded-2xl bg-soft p-5 text-sm">
              <p className="kicker">Resumen</p>
              <p className="mt-2 font-semibold">{nombre || aud.titulo}</p>
              <ul className="mt-3 space-y-2 text-ink/80">
                <li>
                  <b>{elegidos.length}</b> mensajes a «{aud.titulo}»
                </li>
                <li>
                  1 cada {ritmo} s · ≈ {duracion(elegidos.length * ritmo)}
                </li>
                <li>{cuando === 'ahora' ? 'Empieza al lanzarla' : `Empieza el ${new Date(fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`}</li>
                <li>{conectada ? 'Sale por WhatsApp Business' : 'WhatsApp Web: recepción abre cada mensaje con un clic y lo envía'}</li>
              </ul>
              <p className="mt-3 text-xs text-muted">
                {conectada ? `El envío avanza mientras el panel esté abierto, solo ${HORARIO_TXT}.` : 'Quedan fuera: números inválidos, «no contactar» y quien no autorizó WhatsApp.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-paper/95 p-4 backdrop-blur sm:px-8">
        <button onClick={() => (paso ? setPaso(paso - 1) : onCerrar())} className={btnBorde}>
          {paso ? 'Atrás' : 'Cancelar'}
        </button>
        {paso < 2 ? (
          <button disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)} className={btnNegro}>
            Siguiente <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <button disabled={!puedeSeguir} onClick={lanzar} className={btnIris}>
            <Send className="size-4" aria-hidden /> {lanzando ? 'Creando…' : cuando === 'ahora' ? `Lanzar a ${elegidos.length}` : `Programar para ${elegidos.length}`}
          </button>
        )}
      </footer>
    </Modal>
  );
}

// vista previa tal como la verá el paciente en WhatsApp
function Vista({ texto, quien }: { texto: string; quien?: string }) {
  return (
    <div>
      <p className="kicker">Así le llega{quien ? ` a ${quien.split(' ')[0]}` : ''}</p>
      <div className="mt-2 rounded-[22px] bg-[#e9e2d6] p-4">
        <div className="ml-auto max-w-[95%] whitespace-pre-line rounded-2xl rounded-tr-md bg-[#d9fdd3] px-4 py-3 text-[13.5px] leading-relaxed shadow-sm">
          {texto}
          <span className="mt-1 block text-right text-[10px] text-ink/60">{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
        </div>
      </div>
    </div>
  );
}

function TarjetaCampana({
  c,
  onAccion,
  onRespuesta,
  onBorrar,
  onAbrir,
  onEnviarManual,
}: {
  onEnviarManual: (id: string, envio: string) => void;
  c: Campana;
  onAccion: (id: string, accion: AccionCampana) => void;
  onRespuesta: (id: string, envio: string, respondio: boolean) => void;
  onBorrar: (id: string) => void;
  onAbrir?: (id: string) => void;
}) {
  const [abierta, setAbierta] = useState(c.estado === 'enviando');
  const n = (e: EstadoEnvio) => c.envios.filter((x) => x.estado === e).length;
  const total = c.envios.length || 1;
  const hechos = c.envios.filter((x) => x.estado !== 'pendiente').length;
  const activa = c.estado === 'enviando' || c.estado === 'programada';
  const programadaFutura = c.estado === 'programada' && Date.parse(c.inicio) > Date.now();
  const siguiente = c.envios.find((e) => e.estado === 'pendiente');

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
              <Etiqueta>{c.canal === 'api' ? 'WhatsApp API' : 'WhatsApp Web'}</Etiqueta>
            </div>
            <p className="mt-1 text-sm text-muted">
              {c.audiencia} · {c.envios.length} pacientes{c.canal === 'api' ? ` · 1 mensaje cada ${c.ritmoSeg} s` : ' · envío asistido'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activa && (
              <button onClick={() => onAccion(c.id, 'pausar')} className={`${btnChico} bg-soft hover:bg-line`}>
                <Pause className="size-3.5" /> Pausar
              </button>
            )}
            {c.estado === 'pausada' && (
              <button onClick={() => onAccion(c.id, 'reanudar')} className={`${btnChico} bg-ink text-white`}>
                <Play className="size-3.5" /> Reanudar
              </button>
            )}
            {n('fallo') > 0 && !activa && (
              <button
                onClick={() => onAccion(c.id, 'reintentar_fallidos')}
                className={`${btnChico} bg-soft hover:bg-line`}
              >
                <RotateCcw className="size-3.5" /> Reintentar fallidos
              </button>
            )}
            {(activa || c.estado === 'pausada') && (
              <button onClick={() => onAccion(c.id, 'cancelar')} className={`${btnChico} text-muted hover:bg-soft hover:text-ink`}>
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

        {/* cola asistida (WhatsApp Web sin API): un clic abre el chat con el mensaje listo y lo marca como enviado */}
        {c.canal === 'simulado' && (c.estado === 'enviando' || c.estado === 'programada') && siguiente && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-soft p-3">
            <a
              href={linkWhatsApp(siguiente.telefono, siguiente.texto)}
              target="_blank"
              rel="noopener"
              onClick={() => siguiente.id && onEnviarManual(c.id, siguiente.id)}
              className={btnNegro}
            >
              <MessageCircle className="size-4" aria-hidden /> Abrir siguiente: {siguiente.nombre.split(' ')[0]}
            </a>
            <span className="text-xs text-muted">
              {hechos + 1} de {c.envios.length} · se marca enviado al abrirlo
              {!enHorarioClinica() && <b className="ml-1 text-amarillo">· fuera del horario de recepción</b>}
            </span>
          </div>
        )}

        {/* progreso */}
        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-soft" role="img" aria-label={`${hechos} de ${c.envios.length} procesados`}>
          <div className="bg-ink transition-[width] duration-700" style={{ width: `${(n('enviado') / total) * 100}%` }} />
          <div className="iris transition-[width] duration-700" style={{ width: `${(n('respondio') / total) * 100}%` }} />
          <div className="bg-rojo transition-[width] duration-700" style={{ width: `${(n('fallo') / total) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-ink" aria-hidden />
              <b className="num text-ink">{n('enviado') + n('respondio')}</b> de {c.envios.length} enviados
            </span>
            <span className="flex items-center gap-1.5">
              <span className="iris size-2 rounded-full" aria-hidden />
              <b className="num text-ink">{n('respondio')}</b> respondieron
            </span>
            {n('fallo') > 0 && (
              <span className="flex items-center gap-1.5 text-rojo">
                <span className="size-2 rounded-full bg-rojo" aria-hidden />
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
              {onAbrir ? (
                <button onClick={() => onAbrir(e.pacienteId)} className="min-w-0 flex-1 truncate text-left font-medium hover:underline">
                  {e.nombre}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium">{e.nombre}</span>
              )}
              {e.error && <span className="max-w-[220px] truncate text-xs text-rojo" title={e.error}>{e.error}</span>}
              {e.fecha && <span className="num text-xs text-muted">{new Date(e.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
              <span key={e.estado} className="pop">
                <Etiqueta tono={ESTADO_ENVIO[e.estado].tono}>{ESTADO_ENVIO[e.estado].t}</Etiqueta>
              </span>
              {(e.estado === 'enviado' || e.estado === 'respondio') && e.id && (
                <button
                  onClick={() => onRespuesta(c.id, e.id!, e.estado !== 'respondio')}
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

// La conexión con WhatsApp Business vive en el servidor: el token nunca pasa por el navegador
function ComoConectar({ abierto, conectado, onCerrar }: { abierto: boolean; conectado: boolean; onCerrar: () => void }) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Cómo salen los mensajes" ancho="max-w-xl">
      <div className="p-6 sm:p-8">
        <h2 className="text-2xl font-bold tracking-tight">Cómo salen los mensajes</h2>
        <p className="mt-2 text-sm text-muted">
          {conectado
            ? 'El servidor está conectado a WhatsApp Cloud API: las campañas salen desde el número de la clínica.'
            : 'La clínica envía desde WhatsApp Web: el panel arma la cola y recepción envía cada mensaje con un clic.'}
        </p>
        {!conectado && (
          <ol className="mt-4 space-y-2 text-sm leading-relaxed">
            {[
              'Cree la campaña: el panel deja fuera números inválidos, «no contactar» y a quien no autorizó WhatsApp.',
              'En la tarjeta de la campaña toque «Abrir siguiente»: se abre el chat con el mensaje ya escrito.',
              'Envíelo en WhatsApp y vuelva: el panel lo marca como enviado y prepara el siguiente.',
              'Hágalo en horario de recepción (L-V 8-12 y 13-17) para poder atender a quien responda.',
            ].map((t, i) => (
              <li key={t} className="flex gap-2.5">
                <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-5 rounded-2xl bg-soft p-4 text-sm leading-relaxed">
          <p className="font-semibold">{conectado ? 'Configuración en el .env del backend:' : 'Si más adelante la clínica activa la API de WhatsApp Business, se configura en el .env del backend:'}</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs">{`WHATSAPP_MODO=meta_cloud
WHATSAPP_API_TOKEN=…
WHATSAPP_PHONE_ID=…
WHATSAPP_PLANTILLA_POR_DEFECTO=…   (opcional)`}</pre>
          <p className="mt-2 text-xs text-muted">
            Los datos se obtienen en Meta for Developers → WhatsApp → Configuración de la API. El token queda solo en el servidor; el panel nunca lo ve ni lo guarda.
          </p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          WhatsApp solo permite mensajes libres a quien escribió en las últimas 24 h. Para escribirle a pacientes que no han escrito, se usa una plantilla aprobada por Meta.
        </p>
        <div className="mt-6 flex justify-end">
          <button onClick={onCerrar} className={btnNegro}>
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
}
