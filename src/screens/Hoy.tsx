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
  pasoActual,
  pesosCorto,
  riesgoAlto,
  semaforo,
  tocaHoy,
  type Semaforo,
} from '../lib/reglas';
import { Cifra, Etiqueta, Iniciales, Insignias, Meta, Punto, ComoSePrioriza, SEMAFORO_TXT, Vacio, btnBorde, btnNegro } from '../components/ui';

type Filtro = 'todos' | Semaforo | 'alto' | 'riesgo' | 'Nuevo' | 'Antiguo' | 'sincel';
type Orden = 'prioridad' | 'valor' | 'fallos' | 'antiguedad';
const POR_PAGINA = 25;
const SEMAFOROS: [Semaforo, string, string][] = [
  ['rojo', '0 a 3 días', 'Recién canceló o faltó. También VIP y riesgo alto.'],
  ['amarillo', 'Día 7', 'Entre 4 y 14 días: segundo mensaje con otra propuesta.'],
  ['verde', 'Día 15', 'Más de 15 días o limpieza. Si no responde, pasa a campañas.'],
];

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
  const activos = pacientes.filter((p) => p.estado === 'activo').length;

  const cuenta = { rojo: 0, amarillo: 0, verde: 0 };
  delDia.forEach((p) => cuenta[semaforo(p, hoy)!]++);
  const enJuego = delDia.reduce((s, p) => s + p.valor, 0);
  const total = delDia.length + hechosHoy.length;
  const avance = total ? hechosHoy.length / total : 0;
  const n = (f: (p: Paciente) => boolean) => delDia.filter(f).length;

  const q = buscar.trim().toLowerCase();
  const visibles = delDia
    .filter((p) => {
      const ok =
        filtro === 'todos' ||
        (filtro === 'alto'
          ? esVIP(p)
          : filtro === 'riesgo'
            ? riesgoAlto(p)
            : filtro === 'Nuevo' || filtro === 'Antiguo'
              ? p.antiguedad === filtro
              : filtro === 'sincel'
                ? !p.telefono
                : semaforo(p, hoy) === filtro);
      return ok && (!q || p.nombre.toLowerCase().includes(q) || p.idPaciente.includes(q) || p.tratamiento.toLowerCase().includes(q));
    })
    .sort((a, b) =>
      orden === 'valor'
        ? b.valor - a.valor
        : orden === 'fallos'
          ? b.fallosSeguidos - a.fallosSeguidos || b.fallosHistoricos - a.fallosHistoricos
          : orden === 'antiguedad'
            ? diasEntre(b.fechaEvento, hoy) - diasEntre(a.fechaEvento, hoy)
            : 0
    );

  const fecha = new Date(`${hoy}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fechaLarga = fecha[0].toUpperCase() + fecha.slice(1);

  return (
    <>
      <section className="entrar relative overflow-hidden rounded-[28px] bg-ink px-6 py-6 text-white sm:px-8 sm:py-7">
        <div className="aura iris pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full opacity-35 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-white/65">{fechaLarga}</p>
          <h1 className="mt-2 text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">
            {delDia.length === 0 ? (
              <>Lista del día al día.</>
            ) : (
              <>
                Hoy toca contactar
                 a <span className="iris-text">{delDia.length}</span> {delDia.length === 1 ? 'paciente' : 'pacientes'}
              </>
            )}
          </h1>

          <div className="mt-5 max-w-2xl">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
                <span>
                  <b className="text-white">{hechosHoy.length}</b> de {total} contactados · {activos} activos con cita fuera de la bandeja
                </span>
                {enJuego > 0 && (
                  <span>
                    <b className="text-white">
                      <Cifra valor={enJuego} formato={pesosCorto} />
                    </b>{' '}
                    en pausa según el arancel
                  </span>
                )}
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Avance del día" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechosHoy.length}>
                <div className="iris h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${avance * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RN-05: cada color es un filtro de la lista y explica qué significa */}
      {delDia.length > 0 && (
        <div className="mt-5" role="group" aria-label="Filtrar por urgencia">
          <div className="escalonado grid grid-cols-3 gap-2 sm:gap-3">
            {SEMAFOROS.map(([c, t, d]) => {
              const activo = filtro === c;
              return (
                <button
                  key={c}
                  onClick={() => elegir(activo ? 'todos' : c)}
                  aria-pressed={activo}
                  className={`card flex flex-col items-start gap-1 rounded-[20px] p-3 text-left sm:flex-row sm:gap-3 sm:p-4 ${activo ? 'ring-2 ring-ink' : 'hover:ring-1 hover:ring-ink/25'}`}
                >
                  <span className="flex items-center gap-2 sm:mt-0.5">
                    <Punto color={c} />
                    <span className="num text-lg font-bold leading-none sm:hidden">{cuenta[c]}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2 text-sm font-semibold">
                      {SEMAFORO_TXT[c]}
                      <span className="num hidden text-muted sm:inline">{cuenta[c]}</span>
                    </span>
                    <span className="block text-xs text-muted sm:hidden">{t}</span>
                    <span className="hidden text-xs leading-relaxed text-muted sm:block">
                      {t} · {d}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <ComoSePrioriza className="mt-3" />
        </div>
      )}

      {delDia.length > 0 && (
        <div className="mb-4 mt-8 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Más filtros">
              {(
                [
                  ['todos', `Todos · ${delDia.length}`],
                  ['riesgo', `Riesgo alto · ${n(riesgoAlto)}`],
                  ['alto', `VIP · ${n(esVIP)}`],
                  ['Nuevo', `Nuevos · ${n((p) => p.antiguedad === 'Nuevo')}`],
                  ['Antiguo', `Antiguos · ${n((p) => p.antiguedad === 'Antiguo')}`],
                  ['sincel', `Sin celular · ${n((p) => !p.telefono)}`],
                ] as [Filtro, string][]
              ).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => elegir(id)}
                  aria-pressed={filtro === id}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${filtro === id ? 'bg-ink text-white' : 'bg-card text-ink/70 ring-1 ring-line hover:text-ink'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Buscar en la lista del día</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, # paciente o comentario" className="field rounded-full pl-10" />
            </label>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="field rounded-full sm:w-60" aria-label="Ordenar bandeja">
              <option value="prioridad">Orden: prioridad del semáforo</option>
              <option value="valor">Orden: mayor dinero en pausa</option>
              <option value="fallos">Orden: más fallos históricos</option>
              <option value="antiguedad">Orden: más días sin reagendar</option>
            </select>
          </div>
        </div>
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
              <Fila key={p.id} p={p} hoy={hoy} onContactar={() => onContactar(p)} onAbrir={() => onAbrir(p.id)} />
            ))}
            {visibles.length === 0 && <p className="py-10 text-center text-sm text-muted">Nadie coincide con ese filtro.</p>}
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
        <Bloque titulo="Ya contactados hoy" vacio="Aún no registras contactos en esta fecha.">
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
                  {CASO_TXT[p.caso]} · día {pasoActual(p, hoy)}
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

function Fila({ p, hoy, onContactar, onAbrir }: { p: Paciente; hoy: string; onContactar: () => void; onAbrir: () => void }) {
  const color = semaforo(p, hoy)!;
  const atraso = diasDeRetraso(p, hoy);
  const paso = pasoActual(p, hoy)!;
  return (
    <li className="card lift grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-[22px] p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:p-5">
      <button onClick={onAbrir} className="relative" aria-label={`Ver expediente de ${p.nombre}`}>
        <Iniciales nombre={p.nombre} />
        <Punto color={color} className="absolute -right-0.5 -top-0.5 ring-2 ring-white" />
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={onAbrir} className="mr-1 truncate text-left font-semibold hover:underline">
            {p.nombre}
          </button>
          <Insignias p={p} />
        </div>
        <p className="mt-0.5 truncate text-sm text-ink/70">
          {CASO_TXT[p.caso]} · {p.tratamiento}
        </p>
        <Meta p={p} className="mt-0.5 block truncate" />
      </div>
      <div className="col-span-2 flex items-center gap-4 text-sm sm:col-span-1 sm:block sm:text-right">
        <div className="flex items-center gap-1 sm:justify-end" aria-label={`Etapa del día ${paso}`}>
          {[3, 7, 15].map((d) => (
            <span key={d} className={`h-1.5 rounded-full ${d === paso ? 'iris w-6' : d < paso ? 'w-3 bg-ink' : 'w-3 bg-line'}`} />
          ))}
          <span className="ml-1.5 font-medium">{diasEntre(p.fechaEvento, hoy)} días</span>
          {atraso > 0 && <span className="text-rojo"> · {atraso}d tarde</span>}
        </div>
        <p className="num mt-0.5 text-muted">{pesosCorto(p.valor)}</p>
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
