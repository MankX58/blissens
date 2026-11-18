import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type { Paciente } from '../types';
import {
  CASO_TXT,
  RESULTADO_TXT,
  altoValor,
  diasEntre,
  fechaCorta,
  fechaQueToca,
  ordenarDelDia,
  pasoActual,
  pesosCorto,
  semaforo,
  tocaHoy,
  type Semaforo,
} from '../lib/reglas';
import { Cifra, Etiqueta, EtiquetaSegmento, Iniciales, Punto, RolChip, SEMAFORO_TXT, Vacio, btnBorde, btnNegro } from '../components/ui';

type Filtro = 'todos' | Semaforo | 'alto';

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
  const [buscar, setBuscar] = useState('');

  const delDia = useMemo(() => ordenarDelDia(pacientes.filter((p) => tocaHoy(p, hoy)), hoy), [pacientes, hoy]);
  const hechosHoy = pacientes.filter((p) => p.contactos.some((c) => c.fecha === hoy));
  const proximos = pacientes
    .filter((p) => p.estado === 'pendiente' && !tocaHoy(p, hoy))
    .sort((a, b) => (fechaQueToca(a)! < fechaQueToca(b)! ? -1 : 1))
    .slice(0, 6);

  const cuenta = { rojo: 0, amarillo: 0, verde: 0 };
  delDia.forEach((p) => cuenta[semaforo(p, hoy)!]++);
  const enJuego = delDia.reduce((s, p) => s + p.valor, 0);
  const total = delDia.length + hechosHoy.length;
  const avance = total ? hechosHoy.length / total : 0;

  const q = buscar.trim().toLowerCase();
  const visibles = delDia.filter(
    (p) =>
      (filtro === 'todos' || (filtro === 'alto' ? altoValor(p) : semaforo(p, hoy) === filtro)) &&
      (!q || p.nombre.toLowerCase().includes(q) || p.tratamiento.toLowerCase().includes(q))
  );

  const f = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaLarga = f[0].toUpperCase() + f.slice(1);
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      {/* encabezado del día */}
      <section className="entrar relative overflow-hidden rounded-[32px] bg-ink px-6 py-8 text-white sm:px-10 sm:py-11">
        <div className="aura iris pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full opacity-35 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/55">
              {saludo} · {fechaLarga}
            </p>
            <RolChip rol="auxiliar" oscuro />
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-[1.02] tracking-tight sm:text-[64px]">
            {delDia.length === 0 ? (
              <>Lista del día al día.</>
            ) : (
              <>
                Hoy toca contactar
                <br />a <span className="iris-text">{delDia.length}</span> {delDia.length === 1 ? 'paciente' : 'pacientes'}
              </>
            )}
          </h1>

          <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
                <span>
                  <b className="text-white">{hechosHoy.length}</b> de {total} contactados
                </span>
                {enJuego > 0 && (
                  <span>
                    <b className="text-white">
                      <Cifra valor={enJuego} formato={pesosCorto} />
                    </b>{' '}
                    en tratamientos por recuperar
                  </span>
                )}
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="iris h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${avance * 100}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(['rojo', 'amarillo', 'verde'] as const).map((c) => (
                <button key={c} onClick={() => setFiltro(filtro === c ? 'todos' : c)} className="flex items-center gap-2 hover:opacity-80">
                  <Punto color={c} />
                  <span className="num font-semibold">{cuenta[c]}</span>
                  <span className="text-white/55">{SEMAFORO_TXT[c]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* cómo funciona */}
      <div className="escalonado mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ['verde', 'Día 3', 'Primer mensaje después de que cancela, falta o recibe su diagnóstico.'],
          ['amarillo', 'Día 7', 'Si no respondió, segundo mensaje con otra propuesta.'],
          ['rojo', 'Día 15', 'Último intento. Si no responde, pasa a campañas.'],
        ].map(([c, t, d]) => (
          <div key={t} className="card flex gap-3 rounded-[20px] p-4">
            <Punto color={c as Semaforo} className="mt-1.5" />
            <div>
              <p className="text-sm font-semibold">{t}</p>
              <p className="text-xs leading-relaxed text-muted">{d}</p>
            </div>
          </div>
        ))}
      </div>

      {delDia.length > 0 && (
        <div className="mb-4 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['todos', `Todos · ${delDia.length}`],
                ['rojo', `Urgentes · ${cuenta.rojo}`],
                ['amarillo', `Seguimiento · ${cuenta.amarillo}`],
                ['verde', `Primer contacto · ${cuenta.verde}`],
                ['alto', 'Alto valor'],
              ] as [Filtro, string][]
            ).map(([id, t]) => (
              <button
                key={id}
                onClick={() => setFiltro(id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  filtro === id ? 'bg-ink text-white' : 'bg-card text-ink/70 ring-1 ring-line hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar paciente" className="field rounded-full pl-10" />
          </label>
        </div>
      )}

      {delDia.length === 0 ? (
        <div className="mt-10">
          <Vacio
            titulo={hechosHoy.length ? 'Terminaste la lista de hoy' : 'No hay contactos pendientes para hoy'}
            texto={
              hechosHoy.length
                ? `Contactaste a ${hechosHoy.length} ${hechosHoy.length === 1 ? 'paciente' : 'pacientes'}. Mañana la lista se arma sola con la regla 3-7-15.`
                : 'Carga la agenda exportada del software para detectar cancelaciones, inasistencias y tratamientos sin iniciar.'
            }
          >
            <button onClick={onIrCargar} className={btnBorde}>
              Cargar agenda en Excel
            </button>
          </Vacio>
        </div>
      ) : (
        <ul key={filtro + q} className="escalonado space-y-2.5">
          {visibles.map((p) => (
            <Fila key={p.id} p={p} hoy={hoy} onContactar={() => onContactar(p)} onAbrir={() => onAbrir(p.id)} />
          ))}
          {visibles.length === 0 && <p className="py-10 text-center text-sm text-muted">Nadie coincide con ese filtro.</p>}
        </ul>
      )}

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <Bloque titulo="Ya contactados hoy" vacio="Aún no registras contactos hoy.">
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
                  {CASO_TXT[p.caso]} · día {pasoActual(p)}
                </span>
              </button>
              <span className="num shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-ink/70">{fechaCorta(fechaQueToca(p)!)}</span>
            </li>
          ))}
        </Bloque>
      </div>
    </>
  );
}

function Fila({ p, hoy, onContactar, onAbrir }: { p: Paciente; hoy: string; onContactar: () => void; onAbrir: () => void }) {
  const color = semaforo(p, hoy)!;
  const atraso = diasEntre(fechaQueToca(p)!, hoy);
  const paso = pasoActual(p)!;
  return (
    <li className="card lift grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-[22px] p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:p-5">
      <button onClick={onAbrir} className="relative" aria-label={`Ver expediente de ${p.nombre}`}>
        <Iniciales nombre={p.nombre} />
        <Punto color={color} className="absolute -right-0.5 -top-0.5 ring-2 ring-white" />
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onAbrir} className="truncate text-left font-semibold hover:underline">
            {p.nombre}
          </button>
          <EtiquetaSegmento p={p} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {CASO_TXT[p.caso]} · {p.tratamiento}
        </p>
      </div>
      <div className="col-span-2 flex items-center gap-4 text-sm sm:col-span-1 sm:block sm:text-right">
        <div className="flex items-center gap-1 sm:justify-end" aria-label={`Intento del día ${paso}`}>
          {[3, 7, 15].map((d) => (
            <span key={d} className={`h-1.5 rounded-full ${d === paso ? 'iris w-6' : d < paso ? 'w-3 bg-ink' : 'w-3 bg-line'}`} />
          ))}
          <span className="ml-1.5 font-medium">Día {paso}</span>
          {atraso > 0 && <span className="text-rojo"> · {atraso}d tarde</span>}
        </div>
        <p className="num mt-0.5 text-muted">{p.valor > 0 ? pesosCorto(p.valor) : p.especialista.split(' · ')[0]}</p>
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
