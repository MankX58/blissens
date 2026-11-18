import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { descargarPlantilla, leerAgenda, type ResultadoLectura } from '../lib/excel';
import { CASO_TXT, fechaCorta, pasoActual, pesosCorto, semaforo, tocaHoy } from '../lib/reglas';
import { Encabezado, EtiquetaSegmento, Punto, btnBorde, btnNegro } from '../components/ui';

export function Cargar({ hoy, onAgregar }: { hoy: string; onAgregar: (r: ResultadoLectura) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const [archivo, setArchivo] = useState('');
  const [res, setRes] = useState<ResultadoLectura | null>(null);

  const leer = async (f?: File) => {
    if (!f) return;
    setError('');
    setRes(null);
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      setError('El archivo debe ser Excel (.xlsx, .xls) o .csv');
      return;
    }
    setLeyendo(true);
    try {
      const r = await leerAgenda(f);
      setArchivo(f.name);
      if (!r.filas) setError('El archivo no tiene filas. Revisa que la primera hoja tenga la agenda.');
      else setRes(r);
    } catch {
      setError('No pudimos leer el archivo. Ábrelo en Excel, guárdalo como .xlsx e inténtalo de nuevo.');
    } finally {
      setLeyendo(false);
    }
  };

  const paraHoy = res?.pacientes.filter((p) => tocaHoy(p, hoy)).length ?? 0;

  return (
    <div>
      <Encabezado
        roles={['auxiliar']}
        titulo="Carga la agenda del software"
        descripcion="Exporta la agenda a Excel como lo haces hoy y suéltala aquí. El panel detecta quién canceló, quién no vino, quién tiene un diagnóstico sin iniciar y a quién le toca el control de limpieza. Las cancelaciones futuras se vuelven espacios en la agenda abierta."
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          leer(e.dataTransfer.files[0]);
        }}
        className={`entrar relative mt-8 overflow-hidden rounded-[28px] border-2 border-dashed p-10 text-center transition-transform sm:p-14 ${
          arrastrando ? 'scale-[1.01] border-ink bg-white' : 'border-line bg-card'
        }`}
      >
        {arrastrando && <div className="iris absolute inset-0 opacity-25" />}
        <div className="relative">
          <span className={`mx-auto grid size-14 place-items-center rounded-full bg-ink text-white ${leyendo ? 'latido' : ''}`}>
            <FileSpreadsheet className="size-6" />
          </span>
          <p className="mt-4 text-lg font-semibold">{leyendo ? 'Leyendo agenda…' : 'Arrastra el archivo aquí'}</p>
          <p className="text-sm text-muted">o</p>
          <button onClick={() => input.current?.click()} className={`${btnNegro} mt-3`}>
            <Upload className="size-4" /> Elegir archivo
          </button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              leer(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-rojo/10 px-4 py-3 text-sm font-medium text-rojo">{error}</p>}

      {res && (
        <section className="entrar mt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-muted">{archivo}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {res.pacientes.length} {res.pacientes.length === 1 ? 'paciente' : 'pacientes'} por recuperar
              </h2>
            </div>
            <button onClick={() => onAgregar(res)} disabled={!res.pacientes.length && !res.huecos.length} className={btnNegro}>
              Agregar a la lista de contacto
            </button>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            <Cifra k="Filas leídas" v={res.filas} />
            <Cifra k="Para contactar hoy" v={paraHoy} />
            <Cifra k="Espacios en agenda abierta" v={res.huecos.length} />
            <Cifra k="Citas cumplidas (se ignoran)" v={res.ignoradas} />
          </dl>
          {res.sinTelefono > 0 && (
            <p className="mt-3 text-sm text-amarillo">
              {res.sinTelefono} {res.sinTelefono === 1 ? 'fila no tiene' : 'filas no tienen'} celular: podrás verlas, pero no escribirles por WhatsApp.
            </p>
          )}

          <ul className="escalonado card mt-6 divide-y divide-line">
            {res.pacientes.map((p) => {
              const c = semaforo(p, hoy);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                  {c && <Punto color={c} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.nombre}</span>
                      <EtiquetaSegmento p={p} />
                    </span>
                    <span className="block text-sm text-muted">
                      {CASO_TXT[p.caso]} el {fechaCorta(p.fechaEvento)} · {p.tratamiento}
                    </span>
                  </span>
                  <span className="text-sm text-muted">
                    {pasoActual(p) ? `Día ${pasoActual(p)}` : ''} {p.valor > 0 && `· ${pesosCorto(p.valor)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-14 grid gap-8 border-t border-line pt-10 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-semibold">¿Qué columnas necesita el archivo?</h2>
          <p className="mt-1 text-sm text-muted">No importa el orden ni si cambian un poco los nombres. Las obligatorias son las tres primeras.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {['Paciente', 'Estado', 'Fecha', 'Celular', 'Hora', 'Tratamiento', 'Especialista', 'Segmento', 'Ciudad', 'Valor', 'Motivo'].map((c, i) => (
              <span
                key={c}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${i < 3 ? 'bg-ink text-white' : 'bg-card text-ink/70 ring-1 ring-line'}`}
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            En <b className="text-ink">Estado</b> se reconoce: “Canceló”, “No asistió”, “Diagnóstico sin iniciar”, “Control limpieza”. Las citas
            “Asistió” o “Confirmada” se ignoran.
          </p>
        </div>
        <div className="self-start">
          <button onClick={descargarPlantilla} className={btnBorde}>
            <Download className="size-4" /> Descargar Excel de ejemplo
          </button>
        </div>
      </section>
    </div>
  );
}

function Cifra({ k, v }: { k: string; v: number }) {
  return (
    <div className="bg-card p-4">
      <dd className="num text-2xl font-bold">{v}</dd>
      <dt className="text-xs text-muted">{k}</dt>
    </div>
  );
}
