import { useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import type { Datos, Motivo, Paciente, Segmento } from '../types';
import { hojas } from '../lib/expediente';
import { MOTIVO_TXT, PASOS, SEGMENTO_TXT, fechaCorta, pesos, pesosCorto, sumarDias } from '../lib/reglas';
import { Cifra, Encabezado, Pestanas, btnBorde } from '../components/ui';
import { Tabla, descargarHojas } from '../components/Tabla';

export function Indicadores({ datos, hoy }: { datos: Datos; hoy: string }) {
  const { pacientes, huecos, campanas } = datos;
  const n = (f: (p: Paciente) => boolean) => pacientes.filter(f).length;
  const recuperados = pacientes.filter((p) => p.estado === 'recuperado');
  const cerrados = n((p) => p.estado !== 'pendiente');
  const tasa = cerrados ? Math.round((recuperados.length / cerrados) * 100) : 0;
  const valorRecuperado = recuperados.reduce((s, p) => s + p.valor, 0);
  const enRiesgo = pacientes.filter((p) => p.estado === 'pendiente').reduce((s, p) => s + p.valor, 0);

  // actividad de los últimos 14 días
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
  const contactos = pacientes.flatMap((p) => p.contactos);
  const actividad = dias.map((d) => ({
    d,
    contactos: contactos.filter((c) => c.fecha === d).length,
    recuperados: pacientes.filter((p) => p.recuperadoEl === d).length,
  }));
  const maxAct = Math.max(1, ...actividad.map((a) => a.contactos));

  const motivos = (Object.keys(MOTIVO_TXT) as Motivo[])
    .filter((m) => m !== 'sin_dato')
    .map((m) => ({ m, c: n((p) => p.motivo === m) }))
    .filter((x) => x.c)
    .sort((a, b) => b.c - a.c);
  const maxMotivo = Math.max(1, ...motivos.map((x) => x.c));
  const sinMotivo = n((p) => p.motivo === 'sin_dato');

  const porPaso = PASOS.map((d) => {
    const cs = contactos.filter((c) => c.paso === d);
    return { d, enviados: cs.length, agendaron: cs.filter((c) => c.resultado === 'agendo').length };
  });

  const segmentos = (Object.keys(SEGMENTO_TXT) as Segmento[]).map((s) => {
    const ps = pacientes.filter((p) => p.segmento === s);
    const rec = ps.filter((p) => p.estado === 'recuperado');
    return { s, total: ps.length, rec: rec.length, valor: rec.reduce((x, p) => x + p.valor, 0) };
  });
  const maxSeg = Math.max(1, ...segmentos.map((s) => s.valor));

  const envios = campanas.flatMap((c) => c.envios);
  const asignados = huecos.filter((h) => h.ocupadoPor);
  const horasLlenadas = asignados.reduce((s, h) => s + h.minutos, 0) / 60;
  const ocupacion = huecos.length ? Math.round((asignados.length / huecos.length) * 100) : 0;

  const estados = [
    { k: 'En seguimiento', v: n((p) => p.estado === 'pendiente'), cls: 'bg-ink' },
    { k: 'Recuperados', v: recuperados.length, cls: 'iris' },
    { k: 'Sin respuesta tras 3-7-15', v: n((p) => p.estado === 'agotado'), cls: 'bg-muted/50' },
    { k: 'No les interesa', v: n((p) => p.estado === 'descartado'), cls: 'bg-line' },
  ];
  const total = pacientes.length || 1;

  const tablas = hojas(datos, hoy);
  const [tabla, setTabla] = useState(tablas[0].id);
  const actual = tablas.find((t) => t.id === tabla)!;

  return (
    <div>
      <Encabezado roles={['direccion']} titulo="Indicadores" descripcion="Lo que antes se veía al cierre de mes, ahora al día. Todas las cifras salen de los registros del panel.">
        <button onClick={() => descargarHojas(tablas, `blissens-indicadores-${hoy}.xlsx`)} className={btnBorde}>
          <Download className="size-4" /> Descargar todo en Excel
        </button>
      </Encabezado>

      {/* cifra principal */}
      <section className="entrar relative mt-8 grid overflow-hidden rounded-[32px] bg-ink text-white md:grid-cols-[1.3fr_1fr]">
        <div className="aura iris pointer-events-none absolute -left-24 -top-24 size-[380px] rounded-full opacity-25 blur-3xl" />
        <div className="relative p-7 sm:p-10">
          <p className="text-sm text-white/55">Valor de tratamientos recuperados</p>
          <p className="iris-text mt-2 text-5xl font-bold tracking-tight sm:text-7xl">
            <Cifra valor={valorRecuperado} formato={pesosCorto} />
          </p>
          <p className="mt-3 text-sm text-white/55">
            {recuperados.length} {recuperados.length === 1 ? 'paciente volvió' : 'pacientes volvieron'} a agendar · {pesos(enRiesgo)} aún por recuperar
          </p>
        </div>
        <div className="relative grid grid-cols-2 gap-px bg-white/10">
          <Kpi k="Cancelaciones" v={n((p) => p.caso === 'cancelo')} />
          <Kpi k="Inasistencias" v={n((p) => p.caso === 'no_asistio')} />
          <Kpi k="Diagnósticos sin iniciar" v={n((p) => p.caso === 'diagnostico')} />
          <Kpi k="Tasa de recuperación" v={tasa} sufijo="%" />
        </div>
      </section>

      {/* actividad */}
      <Tarjeta titulo="Actividad de las últimas dos semanas" sub="Contactos registrados por día y pacientes recuperados" className="mt-4">
        <div className="flex h-40 items-end gap-1.5 sm:gap-2.5">
          {actividad.map((a, i) => (
            <div key={a.d} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${fechaCorta(a.d)}: ${a.contactos} contactos, ${a.recuperados} recuperados`}>
              {a.recuperados > 0 && <span className="pop size-2 rounded-full iris" />}
              <div
                className={`crecer-y w-full rounded-t-lg ${a.d === hoy ? 'iris' : 'bg-ink/85 group-hover:bg-ink'}`}
                style={{ height: `${Math.max(4, (a.contactos / maxAct) * 100)}%`, animationDelay: `${i * 30}ms` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{fechaCorta(dias[0])}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-ink" /> Contactos
            </span>
            <span className="flex items-center gap-1">
              <span className="iris size-2 rounded-full" /> Recuperados
            </span>
          </span>
          <span>Hoy</span>
        </div>
      </Tarjeta>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="¿Por qué no siguen?" sub={`Motivos registrados al contactar${sinMotivo ? ` · ${sinMotivo} sin dato` : ''}`}>
          {motivos.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay motivos registrados.</p>
          ) : (
            <ul className="space-y-3">
              {motivos.map(({ m, c }) => (
                <li key={m}>
                  <div className="flex justify-between text-sm">
                    <span>{MOTIVO_TXT[m]}</span>
                    <span className="num font-semibold">{c}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-soft">
                    <div className="crecer-x h-full rounded-full bg-ink" style={{ width: `${(c / maxMotivo) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="¿Qué intento funciona mejor?" sub="Citas logradas en cada paso de la regla 3-7-15">
          <div className="grid grid-cols-3 gap-3">
            {porPaso.map(({ d, enviados, agendaron }) => (
              <div key={d} className="rounded-2xl bg-soft p-4">
                <p className="kicker">Día {d}</p>
                <p className="mt-2 text-3xl font-bold">
                  <Cifra valor={enviados ? Math.round((agendaron / enviados) * 100) : 0} />%
                </p>
                <p className="text-xs text-muted">
                  {agendaron} de {enviados} agendaron
                </p>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Recuperación por segmento" sub="Valor recuperado en pacientes locales, internacionales y deportistas">
          <ul className="space-y-4">
            {segmentos.map((s) => (
              <li key={s.s}>
                <div className="flex justify-between text-sm">
                  <span>
                    {SEGMENTO_TXT[s.s]} <span className="text-muted">· {s.rec} de {s.total}</span>
                  </span>
                  <span className="num font-semibold">{pesosCorto(s.valor)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-soft">
                  <div className={`crecer-x h-full rounded-full ${s.s === 'local' ? 'bg-ink' : 'iris'}`} style={{ width: `${(s.valor / maxSeg) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Agenda abierta y campañas" sub="Espacios recuperados y alcance de los mensajes masivos">
          <div className="grid grid-cols-2 gap-3">
            <Mini k="Espacios llenados" v={`${asignados.length} de ${huecos.length}`} />
            <Mini k="Ocupación de espacios liberados" v={`${ocupacion}%`} />
            <Mini k="Horas de sillón recuperadas" v={`${horasLlenadas.toFixed(1).replace('.', ',')} h`} />
            <Mini k="Mensajes de campaña" v={`${envios.filter((e) => e.estado !== 'pendiente').length} · ${envios.filter((e) => e.estado === 'respondio').length} respondieron`} />
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Estado de todos los pacientes en seguimiento" sub={`${pacientes.length} pacientes`} className="mt-4">
        <div className="flex h-4 overflow-hidden rounded-full bg-soft">
          {estados.map((e) => (
            <div key={e.k} className={`crecer-x ${e.cls}`} style={{ width: `${(e.v / total) * 100}%` }} title={`${e.k}: ${e.v}`} />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {estados.map((e) => (
            <li key={e.k} className="flex items-start gap-2 text-sm">
              <span className={`mt-1 size-3 shrink-0 rounded-sm ${e.cls}`} />
              <span>
                <span className="num font-semibold">{e.v}</span> <span className="text-muted">{e.k}</span>
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      {/* tablas visibles sin descargar */}
      <section className="entrar card mt-4 p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Tablas de datos</h2>
            <p className="text-sm text-muted">Las mismas hojas del Excel, para revisarlas aquí. Haz clic en una columna para ordenar.</p>
          </div>
          <Pestanas valor={tabla} onCambio={setTabla} opciones={tablas.map((t) => [t.id, `${t.nombre} · ${t.filas.length}`] as [string, string])} />
        </div>
        <div key={tabla} className="entrar mt-5">
          <Tabla nombre={actual.nombre} filas={actual.filas} archivo={`blissens-${actual.id}-${hoy}.xlsx`} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ k, v, sufijo = '' }: { k: string; v: number; sufijo?: string }) {
  return (
    <div className="bg-ink p-6">
      <p className="text-3xl font-bold">
        <Cifra valor={v} />
        {sufijo}
      </p>
      <p className="mt-1 text-xs text-white/55">{k}</p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-soft p-4">
      <p className="num text-lg font-bold leading-tight">{v}</p>
      <p className="mt-1 text-xs text-muted">{k}</p>
    </div>
  );
}

function Tarjeta({ titulo, sub, children, className = '' }: { titulo: string; sub: string; children: ReactNode; className?: string }) {
  return (
    <section className={`entrar card p-6 sm:p-7 ${className}`}>
      <h2 className="font-semibold">{titulo}</h2>
      <p className="mb-5 text-sm text-muted">{sub}</p>
      {children}
    </section>
  );
}
