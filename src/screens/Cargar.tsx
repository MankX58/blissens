import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Cloud, CloudOff, FileSpreadsheet, Link2, RefreshCw, Upload, X } from 'lucide-react';
import { TIPO_TXT, leerHoja, procesar, radiografia, tipoDe, type Carga, type TipoArchivo } from '../lib/excel';
import { GRUPO_TXT, normalizarCelular, pesosCorto } from '../lib/reglas';
import type { FuenteAgenda, Grupo } from '../types';
import { api } from '../lib/api';
import { haceTexto, horasDesdeCarga } from './Agenda';
import { Cifra, Encabezado, btnBorde, btnChico, btnNegro } from '../components/ui';

type Entrada = { nombre: string; filas: Record<string, unknown>[]; tipo: TipoArchivo; archivo: File };
const ESPERADOS: TipoArchivo[] = ['historial', 'detalle', 'arancel', 'guiones'];
const AYUDA: Record<TipoArchivo, string> = {
  historial: 'Todas las citas con su estado (Atendido, Anulado, Cambio de fecha, No asiste…). Base de la segmentación.',
  detalle: 'Citas con celular, correo, hora, sillón, comentario y «Tipo Paciente» (Deportista o Internacional los marca como VIP). Se cruza por # Cita y # Paciente.',
  arancel: 'Precios de las acciones habilitadas, para estimar el dinero en pausa de cada paciente.',
  guiones: 'Las 24 plantillas oficiales de WhatsApp (ya integradas en el panel).',
  desconocido: '',
};

type Archivos = { historial: File; detalle?: File; arancel?: File; guiones?: File };

// Vista previa en el navegador; al confirmar, los archivos van al ETL del backend, que conserva lo trabajado
export function Cargar({ onSubir, gerencia = false, onFuente }: { onSubir: (a: Archivos) => Promise<boolean>; gerencia?: boolean; onFuente: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [res, setRes] = useState<Carga | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = (t: TipoArchivo) => entradas.find((e) => e.tipo === t)?.archivo;
  const historial = archivo('historial');
  const subir = async () => {
    if (!historial) return;
    setSubiendo(true);
    const ok = await onSubir({ historial, detalle: archivo('detalle'), arancel: archivo('arancel'), guiones: archivo('guiones') });
    setSubiendo(false);
    if (ok) (setEntradas([]), setRes(null));
  };

  const leer = async (files: FileList | File[]) => {
    setError('');
    setRes(null);
    setLeyendo(true);
    try {
      const nuevas: Entrada[] = [];
      for (const f of Array.from(files)) {
        if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
          setError(`“${f.name}” no es un Excel.`);
          continue;
        }
        const filas = leerHoja(await f.arrayBuffer());
        nuevas.push({ nombre: f.name, filas, tipo: tipoDe(filas), archivo: f });
      }
      // un archivo por tipo: el último que se sube reemplaza al anterior
      setEntradas((prev) => [...prev.filter((e) => !nuevas.some((n) => n.tipo === e.tipo && n.tipo !== 'desconocido')), ...nuevas]);
    } catch {
      setError('No pudimos leer el archivo. Ábrelo en Excel, guárdalo como .xlsx e inténtalo de nuevo.');
    } finally {
      setLeyendo(false);
    }
  };

  const grupos = res ? ([1, 2, 3, 4] as Grupo[]).map((g) => ({ g, n: res.pacientes.filter((p) => p.grupo === g).length })) : [];
  const maxG = Math.max(1, ...grupos.map((x) => x.n));

  return (
    <div>
      <Encabezado
        titulo="Carga la agenda del software"
        descripcion="Sube los Excel tal como salen del software (puedes soltar los 4 a la vez). El panel cruza las dos agendas por # Cita y # Paciente, agrupa las citas de cada paciente, lo clasifica en los 4 segmentos del SRS y estima su valor con el arancel."
      />
      <EnLinea gerencia={gerencia} onCambio={onFuente} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          leer(e.dataTransfer.files);
        }}
        className={`entrar relative mt-8 overflow-hidden rounded-[28px] border-2 border-dashed p-10 text-center transition-transform sm:p-12 ${
          arrastrando ? 'scale-[1.01] border-ink bg-white' : 'border-line bg-card'
        }`}
      >
        {arrastrando && <div className="iris absolute inset-0 opacity-25" />}
        <div className="relative">
          <span className={`mx-auto grid size-14 place-items-center rounded-full bg-ink text-white ${leyendo ? 'latido' : ''}`}>
            <FileSpreadsheet className="size-6" />
          </span>
          <p className="mt-4 text-lg font-semibold">{leyendo ? 'Leyendo…' : 'Arrastra aquí los Excel de la clínica'}</p>
          <p className="text-sm text-muted">o</p>
          <button onClick={() => input.current?.click()} className={`${btnNegro} mt-3`}>
            <Upload className="size-4" /> Elegir archivos
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) leer(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-rojo/10 px-4 py-3 text-sm font-medium text-rojo">{error}</p>}

      <ul className="escalonado mt-6 grid gap-3 sm:grid-cols-2">
        {ESPERADOS.map((t) => {
          const e = entradas.find((x) => x.tipo === t);
          return (
            <li key={t} className={`card flex items-start gap-3 rounded-[20px] p-4 ${e ? '' : 'opacity-70'}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full ${e ? 'pop bg-verde text-white' : 'bg-soft text-muted'}`}>
                {e ? <Check className="size-4" /> : <FileSpreadsheet className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{TIPO_TXT[t]}</p>
                <p className="truncate text-xs text-muted">{e ? `${e.nombre} · ${e.filas.length} filas con datos` : AYUDA[t]}</p>
              </div>
              {e && (
                <button onClick={() => setEntradas((x) => x.filter((y) => y !== e))} aria-label="Quitar archivo" className="rounded-full p-1 text-muted hover:bg-soft hover:text-ink">
                  <X className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {entradas.some((e) => e.tipo === 'desconocido') && (
        <p className="mt-3 text-sm text-amarillo">
          No reconocimos: {entradas.filter((e) => e.tipo === 'desconocido').map((e) => e.nombre).join(', ')}. Revisa que tenga los encabezados originales del software.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button disabled={!entradas.some((e) => e.tipo === 'historial' || e.tipo === 'detalle')} onClick={() => setRes(procesar(entradas))} className={btnBorde}>
          Cruzar y clasificar
        </button>
      </div>

      {res && (
        <section className="entrar mt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-muted">Cierre de la agenda: {res.fechaCorte}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {res.pacientes.length} pacientes únicos en {res.citas.length} citas
              </h2>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button onClick={subir} disabled={!historial || subiendo} className={btnNegro}>
                {subiendo ? 'Cargando en el servidor…' : 'Usar estos datos'}
              </button>
              {!historial && <span className="text-xs text-amarillo">Falta el archivo de agenda con estados.</span>}
            </div>
          </div>
          {res.avisos.map((a) => (
            <p key={a} className="mt-3 rounded-xl bg-amarillo/10 px-4 py-2 text-sm text-amarillo">
              {a}
            </p>
          ))}

          <dl className="escalonado mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Dato k="Cruzados con datos de contacto" v={res.conContacto} />
            <Dato k="Sin celular (alerta)" v={res.pacientes.filter((p) => !p.telefono).length} />
            <Dato k="Riesgo alto (3+ seguidas sin asistir)" v={res.pacientes.filter((p) => p.fallosSeguidos >= 3).length} />
            <Dato k="«Confirmado» pasadas: no vinieron, por depurar" v={radiografia(res.citas, res.fechaCorte).porDepurar} />
            <Dato k="Números con WhatsApp fallido o inválido" v={new Set(res.citas.filter((c) => c.estado === 'Notif. WhatsApp fallida').map((c) => c.paciente)).size + res.pacientes.filter((p) => p.telefono && !normalizarCelular(p.telefono)).length} />
            <div className="card rounded-[22px] p-5">
              <dd className="text-[26px] font-bold leading-none tracking-tight">
                <Cifra valor={res.pacientes.filter((p) => p.estado === 'pendiente').reduce((s, p) => s + p.valor, 0)} formato={pesosCorto} />
              </dd>
              <dt className="mt-2 text-xs text-muted">Dinero en pausa ({res.precios} acciones del arancel)</dt>
            </div>
          </dl>

          <div className="card mt-4 p-6">
            <h3 className="kicker">Segmentos del SRS</h3>
            <ul className="mt-4 space-y-3">
              {grupos.map(({ g, n }) => (
                <li key={g}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {g}. {GRUPO_TXT[g]}
                      {g === 4 && <span className="text-muted"> · fuera de la bandeja</span>}
                    </span>
                    <span className="num font-semibold">
                      {n} · {((n / res.pacientes.length) * 100).toFixed(1).replace('.', ',')} %
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-soft">
                    <div className={`crecer-x h-full rounded-full ${g === 4 ? 'bg-verde' : 'bg-ink'}`} style={{ width: `${(n / maxG) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: number }) {
  return (
    <div className="card rounded-[22px] p-5">
      <dd className="text-[26px] font-bold leading-none tracking-tight">
        <Cifra valor={v} />
      </dd>
      <dt className="mt-2 text-xs text-muted">{k}</dt>
    </div>
  );
}

// ---------- agenda en línea: el panel la descarga solo y la revisa cada pocos minutos ----------
const FUENTE_TXT = {
  enlace: 'Conectada a un archivo en línea',
  base: 'Conectada a la base de datos del software',
  carpeta: 'Se carga sola desde la carpeta de la agenda',
} as const;

function EnLinea({ gerencia, onCambio }: { gerencia: boolean; onCambio: () => void }) {
  const [f, setF] = useState<FuenteAgenda | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ enlace: '', detalle: '' });
  const [ocupado, setOcupado] = useState<'' | 'probando' | 'revisando'>('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.fuente().then(setF).catch(() => setF(null));
  }, []);
  if (!f) return null;

  const abrir = () => {
    setForm({ enlace: f.enlace, detalle: f.enlaceDetalle });
    setError('');
    setEditando(true);
  };
  const guardar = async (enlace: string, detalle: string) => {
    setOcupado('probando');
    setError('');
    try {
      setF(await api.guardarFuente(enlace.trim(), detalle.trim()));
      setEditando(false);
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    }
    setOcupado('');
  };
  const revisar = async () => {
    setOcupado('revisando');
    try {
      setF(await api.actualizarFuente());
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    }
    setOcupado('');
  };
  const revisada = f.ultimaRevision ? haceTexto(horasDesdeCarga(f.ultimaRevision)) : '';

  return (
    <section className="entrar card mt-6 overflow-hidden" aria-labelledby="t-linea">
      <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${f.tipo ? (f.error ? 'bg-rojo/10 text-rojo' : 'bg-verde/12 text-verde') : 'bg-soft text-ink/50'}`}>
          {f.tipo ? <Cloud className="size-5" aria-hidden /> : <CloudOff className="size-5" aria-hidden />}
        </span>
        <div className="min-w-[15rem] flex-1">
          <h2 id="t-linea" className="font-semibold">
            {f.tipo ? FUENTE_TXT[f.tipo] : 'Agenda en línea'}
          </h2>
          <p className="text-sm text-muted">
            {f.tipo
              ? f.tipo === 'carpeta'
                ? 'Cuando llega una exportación nueva a la carpeta, el panel la carga al abrirse.'
                : `Se revisa sola cada ${f.cadaMin} min y solo se recarga si cambió${revisada ? ` · última revisión ${revisada}` : ''}.`
              : 'Conecta el Excel de la agenda en línea y el panel se mantendrá al día solo, sin subir archivos.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {f.tipo && (
            <button onClick={revisar} disabled={!!ocupado} className={btnBorde}>
              <RefreshCw className={`size-4 ${ocupado === 'revisando' ? 'animate-spin' : ''}`} aria-hidden /> {ocupado === 'revisando' ? 'Revisando…' : 'Actualizar ahora'}
            </button>
          )}
          {gerencia && f.tipo !== 'base' && !editando && (
            <button onClick={abrir} className={f.tipo === 'enlace' ? btnBorde : btnNegro}>
              <Link2 className="size-4" aria-hidden /> {f.tipo === 'enlace' ? 'Cambiar enlace' : 'Conectar archivo en línea'}
            </button>
          )}
        </div>
      </div>

      {f.error && !editando && (
        <p className="flex items-start gap-2 border-t border-line bg-rojo/[.06] px-5 py-3 text-sm text-rojo sm:px-6">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {f.error} Mientras tanto, el panel sigue con la última agenda que sí se cargó.
        </p>
      )}

      {editando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar(form.enlace, form.detalle);
          }}
          className="hoja space-y-3 border-t border-line bg-soft/50 p-5 sm:p-6"
        >
          <label className="block text-sm font-medium">
            Enlace de la agenda <span className="font-normal text-muted">(citas y estados)</span>
            <input type="url" required placeholder="https://docs.google.com/spreadsheets/d/…" value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} className="field mt-1" />
          </label>
          <label className="block text-sm font-medium">
            Enlace del detalle con la hora de cada cita <span className="font-normal text-muted">(opcional, para calcular la agenda libre)</span>
            <input type="url" placeholder="https://…" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} className="field mt-1" />
          </label>
          <p className="text-xs leading-relaxed text-muted">
            Sirve un Excel en <b>Google Sheets</b>, <b>Google Drive</b>, <b>OneDrive o SharePoint</b>, compartido como «cualquiera con el enlace». Pega el enlace tal cual: el panel lo
            convierte en descarga, lo prueba antes de guardarlo y lo revisa cada pocos minutos. Si el software de la clínica actualiza ese archivo, la agenda se mantiene al día sola.
          </p>
          {error && <p className="rounded-2xl bg-rojo/10 px-3 py-2 text-sm text-rojo">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            {f.tipo === 'enlace' ? (
              <button type="button" onClick={() => confirm('La agenda dejará de actualizarse sola. ¿Desconectar el archivo en línea?') && guardar('', '')} className={`${btnChico} text-muted hover:text-rojo`}>
                Desconectar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditando(false)} className={btnBorde}>
                Cancelar
              </button>
              <button type="submit" disabled={!!ocupado} className={btnNegro}>
                {ocupado === 'probando' ? 'Probando el enlace…' : 'Probar y conectar'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
