import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type { Paciente } from '../types';
import {
  CASO_TXT,
  RESULTADO_TXT,
  esVIP,
  diasDeRetraso,
  diasEntre,
  fechaCorta,
  fechaQueToca,
  ordenarDelDia,
  porQueSemaforo,
  PASO_TXT,
  SEMAFORO_INFO,
  pasoActual,
  pesosCorto,
  riesgoAlto,
  semaforo,
  tocaHoy,
  type Semaforo,
} from '../lib/reglas';
import { Cifra, Etiqueta, Iniciales, Insignias, Meta, Punto, ComoSePrioriza, SEMAFORO_TXT, Vacio, btnBorde, btnNegro } from '../components/ui';

type Filtro = 'todos' | Semaforo | 'vip' | 'riesgo' | 'sincel';
type Orden = 'prioridad' | 'valor' | 'antiguedad';
const POR_PAGINA = 25;
const COLORES: Semaforo[] = ['rojo', 'amarillo', 'verde'];

export function Hoy({
  pacientes,
  hoy,
  onContactar,
  onIrCargar,
  onAbrir,
}: {
  pacientes: Paciente[];
  hoy: string;
  onContactar: (p: Paciente) => void;
  onIrCargar: () => void;
  onAbrir: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [orden, setOrden] = useState<Orden>('prioridad');
  const [buscar, setBuscar] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const elegir = (f: Filtro) => {
    setFiltro(f);
    setMostrar(POR_PAGINA);
  };

  const delDia = useMemo(() => ordenarDelDia(pacientes.filter((p) => tocaHoy(p, hoy)), hoy), [pacientes, hoy]);
  const hechosHoy = pacientes.filter((p) => p.contactos.some((c) => c.fecha === hoy));
  const proximos = pacientes
    .filter((p) => p.estado === 'pendiente' && !tocaHoy(p, hoy))
    .sort((a, b) => (fechaQueToca(a, hoy)! < fechaQueToca(b, hoy)! ? -1 : 1))
    .slice(0, 6);

  const cuenta = { rojo: 0, amarillo: 0, verde: 0 };
  delDia.forEach((p) => cuenta[semaforo(p, hoy)!]++);
  const enJuego = delDia.reduce((s, p) => s + p.valor, 0);
  const total = delDia.length + hechosHoy.length;
  const n = (f: (p: Paciente) => boolean) => delDia.filter(f).length;

  const q = buscar.trim().toLowerCase();
  const visibles = delDia
    .filter((p) => {
      const ok =
        filtro === 'todos' ||
        (filtro === 'vip' ? esVIP(p) : filtro === 'riesgo' ? riesgoAlto(p) : filtro === 'sincel' ? !p.telefono : semaforo(p, hoy) === filtro);
      return ok && (!q || p.nombre.toLowerCase().includes(q) || p.idPaciente.includes(q) || p.tratamiento.toLowerCase().includes(q));
    })
    .sort((a, b) => (orden === 'valor' ? b.valor - a.valor : orden === 'antiguedad' ? diasEntre(b.fechaEvento, hoy) - diasEntre(a.fechaEvento, hoy) : 0));
  const primero = filtro === 'todos' && !q && orden === 'prioridad' ? visibles[0]?.id : undefined;

  const fecha = new Date(`${hoy}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <section className="entrar relative overflow-hidden rounded-[28px] bg-ink px-6 py-6 text-white sm:px-8 sm:py-7">
        <div className="aura iris pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full opacity-35 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-white/65">{fecha[0].toUpperCase() + fecha.slice(1)}</p>
          <h1 className="mt-1.5 text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">
            {delDia.length === 0 ? (
              'Lista del día al día'
            ) : (
              <>
                Hoy toca contactar a <span className="iris-text">{delDia.length}</span> {delDia.length === 1 ? 'paciente' : 'pacientes'}
              </>
            )}
          </h1>
          {enJuego > 0 && (
            <p className="mt-1 text-[15px] text-white/70">
              Sus tratamientos suman <b className="text-white"><Cifra valor={enJuego} formato={pesosCorto} /></b>: cada cita que se recupere cuenta.
            </p>
          )}

          {total > 0 && (
            <div className="mt-5 max-w-xl">
              <p className="text-sm text-white/70">
                <b className="text-white">{hechosHoy.length}</b> de {total} contactados hoy
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Avance del día" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechosHoy.length}>
                <div className="iris h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(hechosHoy.length / total) * 100}%` }} />
              </div>
            </div>
          )}

          {delDia.length > 0 && (
            <ol className="mt-6 grid gap-2 text-sm sm:grid-cols-3">
              {['Empieza por el primero: la lista ya viene ordenada', 'Toca «Contactar» y envía el mensaje por WhatsApp', 'Anota qué respondió: la app agenda el siguiente paso'].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5 rounded-2xl bg-white/[.07] px-3.5 py-3">
                  <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-ink">{i + 1}</span>
                  <span className="text-white/85">{t}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {delDia.length > 0 && (
        <>
          {/* cada color es un filtro y dice en palabras qué significa */}
          <div className="mt-6" role="group" aria-label="Filtrar por urgencia">
            <div className="escalonado grid grid-cols-3 gap-2 sm:gap-3">
              {COLORES.map((c) => {
                const activo = filtro === c;
                return (
                  <button
                    key={c}
                    onClick={() => elegir(activo ? 'todos' : c)}
                    aria-pressed={activo}
                    title={`${SEMAFORO_INFO[c].quienes} ${SEMAFORO_INFO[c].hacer}`}
                    className={`card flex flex-col items-start rounded-[20px] p-3 text-left sm:p-4 ${activo ? 'ring-2 ring-ink' : 'hover:ring-1 hover:ring-ink/25'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Punto color={c} />
                      <span className="text-sm font-semibold">{SEMAFORO_TXT[c]}</span>
                    </span>
                    <span className="num mt-1.5 text-2xl font-bold leading-none">{cuenta[c]}</span>
                    <span className="mt-1 text-xs leading-snug text-muted">{SEMAFORO_INFO[c].corto}</span>
                  </button>
                );
              })}
            </div>
            {/* la explicación aparece donde se usa: al elegir un color, encima de la lista que filtra */}
            {filtro === 'rojo' || filtro === 'amarillo' || filtro === 'verde' ? (
              <div key={filtro} className="hoja mt-3 flex items-start gap-3 rounded-2xl bg-soft p-4 text-sm" aria-live="polite">
                <Punto color={filtro} className="mt-1.5 size-3" />
                <div className="min-w-0 flex-1 leading-relaxed">
                  <p>
                    <b>Quiénes son:</b> {SEMAFORO_INFO[filtro].quienes}
                  </p>
                  <p>
                    <b>Qué hacer:</b> {SEMAFORO_INFO[filtro].hacer}
                  </p>
                </div>
                <button onClick={() => elegir('todos')} className="shrink-0 text-xs font-semibold text-ink/70 underline underline-offset-2 hover:text-ink">
                  Ver todos
                </button>
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs text-muted">Toca un color para ver solo esos pacientes y qué hacer con ellos.</p>
                <ComoSePrioriza className="mt-1.5" />
              </>
            )}
          </div>

          <div className="mb-4 mt-7 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Buscar en la lista del día</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar paciente" className="field rounded-full pl-10" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="shrink-0">Ordenar por</span>
                <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="field rounded-full sm:w-44">
                  <option value="prioridad">Prioridad</option>
                  <option value="valor">Mayor valor</option>
                  <option value="antiguedad">Más días esperando</option>
                </select>
              </label>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Mostrar solo">
              {(
                [
                  ['todos', 'Todos', delDia.length],
                  ['vip', 'VIP', n(esVIP)],
                  ['riesgo', 'Riesgo alto', n(riesgoAlto)],
                  ['sincel', 'Sin celular', n((p) => !p.telefono)],
                ] as [Filtro, string, number][]
              )
                .filter(([id, , c]) => id === 'todos' || c > 0)
                .map(([id, t, c]) => (
                  <button
                    key={id}
                    onClick={() => elegir(id)}
                    aria-pressed={filtro === id}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${filtro === id ? 'bg-ink text-white' : 'bg-card text-ink/70 ring-1 ring-line hover:text-ink'}`}
                  >
                    {t} <span className={`num ${filtro === id ? 'text-white/60' : 'text-muted'}`}>{c}</span>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}

      {delDia.length === 0 ? (
        <div className="mt-10">
          <Vacio
            titulo={hechosHoy.length ? 'Terminaste la lista de hoy' : 'No hay contactos pendientes para esta fecha'}
            texto={
              hechosHoy.length
                ? `Contactaste a ${hechosHoy.length} ${hechosHoy.length === 1 ? 'paciente' : 'pacientes'}. La próxima lista se arma sola con la regla 3-7-15.`
                : 'Carga la agenda exportada del software para detectar cancelaciones, inasistencias y tratamientos sin iniciar.'
            }
          >
            <button onClick={onIrCargar} className={btnBorde}>
              Cargar agenda en Excel
            </button>
          </Vacio>
        </div>
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {visibles.length} {visibles.length === 1 ? 'paciente' : 'pacientes'} en la lista
          </p>
          <ul key={filtro + q + orden} className="escalonado space-y-2.5">
            {visibles.slice(0, mostrar).map((p) => (
              <Fila key={p.id} p={p} hoy={hoy} primero={p.id === primero} onContactar={() => onContactar(p)} onAbrir={() => onAbrir(p.id)} />
            ))}
            {visibles.length === 0 && <p className="py-10 text-center text-sm text-muted">Nadie coincide con esa búsqueda.</p>}
          </ul>
          {visibles.length > mostrar && (
            <div className="mt-4 text-center">
              <button onClick={() => setMostrar((m) => m + POR_PAGINA)} className={btnBorde}>
                Ver {Math.min(POR_PAGINA, visibles.length - mostrar)} más · quedan {visibles.length - mostrar}
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <Bloque titulo="Ya contactados hoy" vacio="Cuando registres un contacto aparecerá aquí con lo que respondió.">
          {hechosHoy.map((p) => {
            const c = p.contactos.filter((x) => x.fecha === hoy).at(-1)!;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <button onClick={() => onAbrir(p.id)} className="min-w-0 truncate text-left text-sm font-medium hover:underline">
                  {p.nombre}
                </button>
                <span className="pop">
                  <Etiqueta tono={c.resultado === 'agendo' ? 'iris' : 'claro'}>{RESULTADO_TXT[c.resultado]}</Etiqueta>
                </span>
              </li>
            );
          })}
        </Bloque>
        <Bloque titulo="Próximos días" vacio="No hay contactos programados.">
          {proximos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <button onClick={() => onAbrir(p.id)} className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium hover:underline">{p.nombre}</span>
                <span className="text-xs text-muted">
                  {CASO_TXT[p.caso]} · {PASO_TXT[pasoActual(p, hoy)!]?.toLowerCase()}
                </span>
              </button>
              <span className="num shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-ink/70">{fechaCorta(fechaQueToca(p, hoy)!)}</span>
            </li>
          ))}
        </Bloque>
      </div>
    </>
  );
}

function Fila({ p, hoy, primero, onContactar, onAbrir }: { p: Paciente; hoy: string; primero: boolean; onContactar: () => void; onAbrir: () => void }) {
  const color = semaforo(p, hoy)!;
  const atraso = diasDeRetraso(p, hoy);
  const paso = pasoActual(p, hoy)!;
  const dias = diasEntre(p.fechaEvento, hoy);
  return (
    <li className={`card lift grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-[22px] p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:p-5 ${primero ? 'ring-2 ring-ink' : ''}`}>
      <button onClick={onAbrir} className="relative" aria-label={`Ver expediente de ${p.nombre}`}>
        <Iniciales nombre={p.nombre} />
        <Punto color={color} className="absolute -right-0.5 -top-0.5 ring-2 ring-white" />
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {primero && <span className="mr-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">Empieza aquí</span>}
          <button onClick={onAbrir} className="mr-1 truncate text-left text-[15px] font-semibold hover:underline">
            {p.nombre}
          </button>
          <Insignias p={p} />
        </div>
        <p className="mt-0.5 text-sm text-ink/75">
          <b className="font-medium text-ink">{CASO_TXT[p.caso]}</b>
          {dias > 0 ? <> hace {dias} {dias === 1 ? 'día' : 'días'}</> : ' hoy'}
          {p.tratamiento && <span className="text-ink/60"> · {p.tratamiento}</span>}
        </p>
        {/* solo cuando el color no se explica por la fecha: urgente por ser VIP o por faltar seguido */}
        {color === 'rojo' && paso !== 3 && (
          <p className="mt-1 flex items-start gap-1.5 text-[13px]">
            <Punto color={color} className="mt-[5px]" />
            <span>
              <b className="font-semibold">Urgente</b> <span className="text-ink/70">· {porQueSemaforo(p, hoy)}</span>
            </span>
          </p>
        )}
        <Meta p={p} className="mt-0.5 block truncate" />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-4 text-sm sm:col-span-1 sm:block sm:text-right">
        <div className="flex items-center gap-1.5 sm:justify-end" aria-label={`${PASO_TXT[paso]} de 3`}>
          {[3, 7, 15].map((d) => (
            <span key={d} className={`h-1.5 rounded-full ${d === paso ? 'iris w-6' : d < paso ? 'w-3 bg-ink' : 'w-3 bg-line'}`} aria-hidden />
          ))}
          <span className="ml-1 font-medium">{PASO_TXT[paso]}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {atraso > 0 && <span className="font-semibold text-rojo">{atraso} {atraso === 1 ? 'día' : 'días'} de retraso · </span>}
          <span className="num">{pesosCorto(p.valor)}</span>
        </p>
      </div>
      <button onClick={onContactar} className={`${btnNegro} group col-span-2 sm:col-span-1`}>
        Contactar <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

function Bloque({ titulo, vacio, children }: { titulo: string; vacio: string; children: ReactNode[] }) {
  return (
    <section className="card p-6">
      <h2 className="kicker">{titulo}</h2>
      {children.length ? <ul className="mt-2 divide-y divide-line">{children}</ul> : <p className="py-4 text-sm text-muted">{vacio}</p>}
    </section>
  );
}
