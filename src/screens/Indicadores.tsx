import { useState, type ReactNode } from 'react';
import { CalendarX, ChevronDown, Download, Lightbulb, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import type { Caso, Datos, Grupo, Motivo, Paciente } from '../types';
import { radiografia } from '../lib/excel';
import { hojas } from '../lib/expediente';
import { CASO_TXT, GRUPO_TXT, META_OCUPACION, MOTIVO_TXT, PASOS, esVIP, fechaCorta, ocupacion, pesosCorto, sumarDias } from '../lib/reglas';
import { Cifra, Encabezado, Pestanas, btnBorde } from '../components/ui';
import { Tabla, descargarHojas } from '../components/Tabla';

// Indicadores de gerencia: arriba las 4 cifras que importan, luego lo que significan y debajo el detalle,
// agrupado por la pregunta que responde. Todo se calcula sobre las citas cargadas y lo registrado en el panel.
export function Indicadores({ datos, hoy }: { datos: Datos; hoy: string }) {
  const { pacientes, huecos, campanas } = datos;
  const n = (f: (p: Paciente) => boolean) => pacientes.filter(f).length;
  const r = radiografia(datos.citas, hoy);
  const oc = ocupacion(datos.citas, huecos, hoy);

  const pendientes = pacientes.filter((p) => p.estado === 'pendiente');
  const recuperados = pacientes.filter((p) => p.estado === 'recuperado');
  const cerrados = n((p) => p.estado !== 'pendiente' && p.estado !== 'activo');
  const porRecuperar = pendientes.reduce((s, p) => s + p.valor, 0);
  const valorRecuperado = recuperados.reduce((s, p) => s + p.valor, 0);
  const tasa = cerrados ? (recuperados.length / cerrados) * 100 : 0;
  const friccion = r.total ? (r.friccion / r.total) * 100 : 0;

  const contactos = pacientes.flatMap((p) => p.contactos);
  const porPaso = PASOS.map((d) => {
    const cs = contactos.filter((c) => c.paso === d);
    const agendaron = cs.filter((c) => c.resultado === 'agendo').length;
    return { d, enviados: cs.length, agendaron, tasa: cs.length ? (agendaron / cs.length) * 100 : 0 };
  });
  const motivos = (Object.keys(MOTIVO_TXT) as Motivo[])
    .filter((m) => m !== 'sin_dato')
    .map((m) => ({ m, c: n((p) => p.motivo === m) }))
    .filter((x) => x.c)
    .sort((a, b) => b.c - a.c);

  // lecturas: qué dicen las cifras, en una frase cada una
  const lecturas: string[] = [];
  if (r.friccion) {
    const peor = [...r.detalleFriccion].sort((a, b) => b.n - a.n)[0];
    lecturas.push(`1 de cada ${Math.max(1, Math.round(r.total / r.friccion))} citas no se cumple; lo más frecuente es «${peor.estado}» (${peor.n} citas).`);
  }
  if (pendientes.length) {
    const vip = pendientes.filter(esVIP);
    const valorVip = vip.reduce((s, p) => s + p.valor, 0);
    lecturas.push(
      vip.length
        ? `${vip.length} pacientes VIP concentran ${pesosCorto(valorVip)} (${Math.round((valorVip / (porRecuperar || 1)) * 100)} %) del dinero por recuperar: son los primeros a contactar.`
        : `${pendientes.length} pacientes siguen en seguimiento con ${pesosCorto(porRecuperar)} en tratamientos por recuperar.`,
    );
  }
  const mejorPaso = [...porPaso].filter((p) => p.enviados >= 3).sort((a, b) => b.tasa - a.tasa)[0];
  if (mejorPaso) lecturas.push(`El contacto del día ${mejorPaso.d} es el que más citas logra: ${Math.round(mejorPaso.tasa)} % de los pacientes agenda.`);
  if (motivos[0]) lecturas.push(`El motivo más común para no seguir es «${MOTIVO_TXT[motivos[0].m].toLowerCase()}» (${motivos[0].c} pacientes).`);
  if (!contactos.length) lecturas.push('Aún no hay contactos registrados: la recuperación y la efectividad de la regla 3-7-15 se irán midiendo a medida que el equipo trabaje la lista de Hoy.');

  const sinMotivo = n((p) => p.motivo === 'sin_dato');
  const porCaso = (Object.keys(CASO_TXT) as Caso[])
    .map((c) => {
      const ps = pendientes.filter((p) => p.caso === c);
      return { k: <>{CASO_TXT[c]} <span className="text-muted">· {ps.length}</span></>, v: ps.reduce((x, p) => x + p.valor, 0), n: ps.length };
    })
    .filter((x) => x.n)
    .sort((a, b) => b.v - a.v);

  const ocupados = huecos.filter((h) => h.ocupadoPor);
  const envios = campanas.flatMap((c) => c.envios);
  const enviados = envios.filter((e) => e.estado !== 'pendiente').length;
  const respondieron = envios.filter((e) => e.estado === 'respondio').length;
  // solo se muestran las tarjetas con datos; las vacías quedan nombradas en una línea
  const tarjetas = [
    {
      nombre: 'la efectividad de cada paso 3-7-15',
      hay: contactos.length > 0,
      tarjeta: (
        <Tarjeta key="pasos" titulo="Regla 3-7-15" sub="De cada contacto, cuántos pacientes agendaron">
          <div className="grid grid-cols-3 gap-3">
            {porPaso.map((p) => (
              <div key={p.d} className={`rounded-2xl p-4 ${p === mejorPaso ? 'bg-ink text-white' : 'bg-soft'}`}>
                <p className={`text-xs font-medium ${p === mejorPaso ? 'text-white/60' : 'text-muted'}`}>Día {p.d}</p>
                <p className="mt-1 text-3xl font-bold">
                  <Cifra valor={p.tasa} formato={(x) => `${Math.round(x)} %`} />
                </p>
                <p className={`text-xs ${p === mejorPaso ? 'text-white/60' : 'text-muted'}`}>
                  {p.agendaron} de {p.enviados}
                </p>
              </div>
            ))}
          </div>
        </Tarjeta>
      ),
    },
    {
      nombre: 'los motivos para no seguir',
      hay: motivos.length > 0,
      tarjeta: null,
    },
    {
      nombre: 'los cupos liberados que se llenan',
      hay: huecos.length > 0,
      tarjeta: (
        <Tarjeta key="cupos" titulo="Cupos liberados" sub="Huecos de agenda que se ofrecieron a otros pacientes">
          <Pares
            pares={[
              [`${ocupados.length} de ${huecos.length}`, 'cupos llenados'],
              [`${(ocupados.reduce((s, h) => s + h.minutos, 0) / 60).toFixed(1).replace('.', ',')} h`, 'de sillón recuperadas'],
            ]}
          />
        </Tarjeta>
      ),
    },
    {
      nombre: 'la respuesta a las campañas',
      hay: campanas.length > 0,
      tarjeta: (
        <Tarjeta key="campanas" titulo="Campañas de WhatsApp" sub="Mensajes masivos de reactivación">
          <Pares
            pares={[
              [`${enviados}`, `mensajes enviados en ${campanas.length} ${campanas.length === 1 ? 'campaña' : 'campañas'}`],
              [pct(respondieron, enviados), `respondieron (${respondieron})`],
            ]}
          />
        </Tarjeta>
      ),
    },
  ];
  const funciona = tarjetas.filter((t) => t.hay && t.tarjeta);
  const pendientesDeDatos = tarjetas.filter((t) => !t.hay).map((t) => t.nombre);

  const tablas = hojas(datos, hoy);

  return (
    <div className="space-y-10">
      <Encabezado
        titulo="Indicadores"
        descripcion={`Cómo va la recuperación de pacientes, al día. Calculado sobre ${r.total.toLocaleString('es-CO')} citas cargadas${datos.fechaCorte ? ` (corte ${fechaCorta(datos.fechaCorte)})` : ''} y lo que el equipo registra en el panel.`}
      >
        <button onClick={() => descargarHojas(tablas, `blissens-indicadores-${hoy}.xlsx`)} className={btnBorde}>
          <Download className="size-4" /> Descargar en Excel
        </button>
      </Encabezado>

      {/* las 4 cifras que importan */}
      <div className="space-y-3">
        <section aria-label="Cifras principales" className="entrar card grid grid-cols-2 gap-px overflow-hidden bg-line p-0 lg:grid-cols-4">
          <Clave icono={Wallet} k="Dinero por recuperar" v={porRecuperar} formato={pesosCorto} sub={`${pendientes.length} pacientes en seguimiento`} tono="iris" />
          <Clave
            icono={TrendingUp}
            k="Ya recuperado"
            v={valorRecuperado}
            formato={pesosCorto}
            sub={`${recuperados.length} ${recuperados.length === 1 ? 'paciente volvió' : 'pacientes volvieron'} a agendar`}
          />
          <Clave
            k="Tasa de recuperación"
            v={tasa}
            formato={(x) => `${Math.round(x)} %`}
            sub={cerrados ? `de ${cerrados} casos cerrados, cuántos volvieron` : 'aún no hay casos cerrados'}
          />
          <Clave icono={CalendarX} k="Citas incumplidas" v={friccion} formato={(x) => `${x.toFixed(1).replace('.', ',')} %`} sub="canceladas, movidas o sin asistir" tono="rojo" />
        </section>

        {lecturas.length > 0 && (
          <section aria-labelledby="t-lect" className="entrar card p-5 sm:p-6">
            <h2 id="t-lect" className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-ink/60" aria-hidden /> Lo que dicen los datos
            </h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {lecturas.map((l) => (
                <li key={l} className="flex gap-2.5">
                  <span className="iris mt-2 size-1.5 shrink-0 rounded-full" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Seccion id="agenda" titulo="¿Cómo está la agenda?" sub="Qué pasó con las citas del archivo cargado.">
        {r.total ? <Agenda r={r} oc={oc} /> : <Pista>Carga la agenda para ver cuántas citas se cumplen.</Pista>}
      </Seccion>

      <Seccion id="pacientes" titulo="¿Dónde están los pacientes?" sub="En qué punto está cada paciente y dónde está el dinero por recuperar.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Embudo datos={datos} />
          <Tarjeta titulo="Dinero por recuperar, por situación" sub="Pacientes en seguimiento y el valor de su tratamiento">
            <Barras formato={pesosCorto} filas={porCaso} />
          </Tarjeta>
          {motivos.length > 0 && (
            <Tarjeta titulo="Por qué no siguen" sub="Motivo registrado al contactar">
              <Barras filas={motivos.map(({ m, c }) => ({ k: MOTIVO_TXT[m], v: c }))} />
              {sinMotivo > 0 && <p className="mt-3 text-xs text-muted">{sinMotivo} pacientes aún sin motivo registrado.</p>}
            </Tarjeta>
          )}
        </div>
      </Seccion>

      <Seccion id="funciona" titulo="¿Qué está funcionando?" sub="Para decidir dónde poner el esfuerzo del equipo.">
        {funciona.length > 0 && <div className="grid gap-4 lg:grid-cols-2">{funciona.map((f) => f.tarjeta)}</div>}
        {pendientesDeDatos.length > 0 && (
          <Pista>
            {funciona.length ? 'También se medirá' : 'Se medirá'} {lista(pendientesDeDatos)} en cuanto el equipo registre contactos, libere cupos o lance campañas.
          </Pista>
        )}
      </Seccion>

      <Seccion id="ritmo" titulo="¿Qué tan activo está el equipo?" sub="Contactos registrados en las últimas dos semanas.">
        <Actividad pacientes={pacientes} hoy={hoy} />
      </Seccion>

      <TablasDatos tablas={tablas} hoy={hoy} />
    </div>
  );
}

// ---------- piezas ----------

function Seccion({ id, titulo, sub, children }: { id: string; titulo: string; sub: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`t-${id}`}>
      <h2 id={`t-${id}`} className="text-xl font-bold tracking-tight">
        {titulo}
      </h2>
      <p className="mb-4 text-sm text-muted">{sub}</p>
      {children}
    </section>
  );
}

function Tarjeta({ titulo, sub, children, className = '' }: { titulo: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`entrar card p-5 sm:p-6 ${className}`}>
      <h3 className="font-semibold">{titulo}</h3>
      {sub && <p className="text-sm text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Clave({ icono: Icono, k, v, formato, sub, tono }: { icono?: LucideIcon; k: string; v: number; formato: (n: number) => string; sub: string; tono?: 'iris' | 'rojo' }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {Icono && <Icono className="size-3.5" aria-hidden />} {k}
      </p>
      <p className={`mt-1 whitespace-nowrap text-2xl font-bold tracking-tight xl:text-[32px] ${tono === 'iris' ? 'iris-text' : tono === 'rojo' ? 'text-rojo' : ''}`}>
        <Cifra valor={v} formato={formato} />
      </p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Pista({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-muted">{children}</p>;
}

function Barras({ filas, color = 'bg-ink', formato = (x: number) => x.toLocaleString('es-CO') }: { filas: { k: ReactNode; v: number; extra?: string; color?: string }[]; color?: string; formato?: (n: number) => string }) {
  const max = Math.max(1, ...filas.map((f) => f.v));
  return (
    <ul className="space-y-3">
      {filas.map((f, i) => (
        <li key={i}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{f.k}</span>
            <span className="num shrink-0 font-semibold">
              {formato(f.v)}
              {f.extra && <span className="font-normal text-muted"> · {f.extra}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-soft">
            <div className={`crecer-x h-full rounded-full ${f.color ?? color}`} style={{ width: `${(f.v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pares({ pares }: { pares: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {pares.map(([v, k]) => (
        <div key={k} className="rounded-2xl bg-soft p-4">
          <p className="num text-xl font-bold leading-tight">{v}</p>
          <p className="mt-0.5 text-xs text-muted">{k}</p>
        </div>
      ))}
    </div>
  );
}

const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]);
const pct = (n: number, t: number) => `${t ? Math.round((n / t) * 100) : 0} %`;
const MESES: Record<string, string> = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' };

// RF-07 / HU-05: diagnóstico de la agenda cargada
const ETIQUETA_ESTADO: Record<string, string> = { Anulado: 'Anulado por la clínica', 'Anulado por pcte. via Whatsapp': 'Anulado por el paciente (WhatsApp)' };

function Agenda({ r, oc }: { r: ReturnType<typeof radiografia>; oc: ReturnType<typeof ocupacion> }) {
  const maxMes = Math.max(1, ...r.meses.map(([, n]) => n));
  const partes = [
    { k: 'Atendidas', v: r.atendidas, cls: 'bg-verde' },
    { k: 'Por venir', v: r.otras, cls: 'bg-ink/25' },
    { k: '«Confirmado» pasadas: no vinieron, por depurar', v: r.porDepurar, cls: 'bg-amarillo' },
    { k: 'No se cumplieron', v: r.friccion, cls: 'bg-rojo' },
  ].filter((p) => p.v > 0);
  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Tarjeta titulo={`${r.total.toLocaleString('es-CO')} citas de ${r.pacientes.toLocaleString('es-CO')} pacientes`}>
        <div className="flex h-3 overflow-hidden rounded-full bg-soft" role="img" aria-label={partes.map((p) => `${p.k}: ${p.v}`).join(', ')}>
          {partes.map((p) => (
            <div key={p.k} className={`crecer-x ${p.cls}`} style={{ width: `${(p.v / (r.total || 1)) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {partes.map((p) => (
            <li key={p.k} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-sm ${p.cls}`} aria-hidden />
              <b className="num">{p.v.toLocaleString('es-CO')}</b> <span className="text-muted">{p.k.toLowerCase()} ({pct(p.v, r.total)})</span>
            </li>
          ))}
        </ul>
        <p className="mb-3 mt-6 text-xs font-medium text-muted">Por qué no se cumplieron</p>
        <Barras color="bg-rojo" filas={[...r.detalleFriccion].sort((a, b) => b.n - a.n).map((d) => ({ k: ETIQUETA_ESTADO[d.estado] ?? d.estado, v: d.n, extra: pct(d.n, r.total) }))} />
        {r.whatsappFallida > 0 && (
          <p className="mt-4 text-xs text-muted">
            <b className="text-ink">{r.whatsappFallida}</b> recordatorios de WhatsApp fallaron (número malo o inactivo): esos pacientes salen marcados para revisar el número.
          </p>
        )}
      </Tarjeta>
      <Tarjeta titulo="Citas por mes">
        <div className="flex h-32 items-end gap-3">
          {r.meses.map(([m, c], i) => (
            <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="num text-xs font-semibold">{c}</span>
              <div className="crecer-y w-full rounded-t-lg bg-ink" style={{ height: `${(c / maxMes) * 100}%`, animationDelay: `${i * 60}ms` }} />
              <span className="text-xs text-muted">{MESES[m.slice(5)]}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Reparto a={['Tratamiento', r.tratamiento]} b={['Diagnóstico', r.diagnostico]} />
          <p className="pt-2 text-xs font-medium text-muted">Citas por especialista (usuario con que se agendó)</p>
          <Barras filas={r.porProfesional.map((x) => ({ k: x.k, v: x.v, extra: pct(x.v, r.total) }))} />
        </div>
      </Tarjeta>
    </div>
    <Tarjeta titulo="¿Qué días cuesta más llenar?" sub="Lunes y miércoles son los más difíciles según la clínica">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-medium text-muted">Citas que no se cumplieron, por día</p>
          <Barras filas={r.friccionPorDia.map((d) => ({ k: d.k, v: d.v, extra: pct(d.v, d.total), color: d.k === 'Lunes' || d.k === 'Miércoles' ? 'bg-rojo' : 'bg-ink/40' }))} />
        </div>
        <div>
          <p className="mb-3 text-xs font-medium text-muted">
            {oc.hay ? <>Ocupación próximos 14 días: <b className="text-ink">{oc.pct} %</b> · meta {META_OCUPACION} %</> : 'Ocupación: aún no hay agenda futura cargada'}
          </p>
          {oc.hay && (
            <>
              <Barras
                formato={(x) => `${x} %`}
                filas={oc.porDia.filter((d) => d.hay).map((d) => ({ k: d.k, v: d.v, color: d.v >= META_OCUPACION ? 'bg-verde' : 'bg-amarillo' }))}
              />
              <p className="mt-2 text-[11px] text-muted">Estimada: 8 h por día con agenda, menos los cupos libres. Verde = en la meta.</p>
            </>
          )}
        </div>
      </div>
    </Tarjeta>
    </div>
  );
}

function Reparto({ a, b }: { a: [string, number]; b: [string, number] }) {
  const t = a[1] + b[1] || 1;
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs">
        <span>
          {a[0]} <b className="num">{pct(a[1], t)}</b>
        </span>
        <span className="text-right">
          {b[0]} <b className="num">{pct(b[1], t)}</b>
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full">
        <div className="crecer-x bg-ink" style={{ width: `${(a[1] / t) * 100}%` }} />
        <div className="iris flex-1" />
      </div>
    </div>
  );
}

function Embudo({ datos }: { datos: Datos }) {
  const total = datos.pacientes.length;
  const cuenta = (f: (p: Paciente) => boolean) => datos.pacientes.filter(f).length;
  const grupos = ([1, 2, 3, 4] as Grupo[]).map((g) => ({
    k: GRUPO_TXT[g],
    v: cuenta((p) => p.grupo === g),
    color: g === 1 ? 'bg-rojo' : g === 4 ? 'bg-verde' : 'bg-ink',
  }));
  const seguimiento = [
    { k: 'En seguimiento', v: cuenta((p) => p.estado === 'pendiente'), cls: 'bg-ink' },
    { k: 'Recuperados', v: cuenta((p) => p.estado === 'recuperado'), cls: 'iris' },
    { k: 'Sin respuesta', v: cuenta((p) => p.estado === 'agotado'), cls: 'bg-muted/50' },
    { k: 'No les interesa', v: cuenta((p) => p.estado === 'descartado'), cls: 'bg-line' },
  ].filter((e) => e.v);
  return (
    <Tarjeta titulo={`${total.toLocaleString('es-CO')} pacientes únicos`} sub="Según su última cita en la agenda">
      <Barras filas={grupos.map((g) => ({ ...g, extra: pct(g.v, total) }))} />
      {seguimiento.length > 1 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-muted">Resultado del seguimiento</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {seguimiento.map((e) => (
              <li key={e.k} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-sm ${e.cls}`} aria-hidden />
                <b className="num">{e.v}</b> <span className="text-muted">{e.k.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tarjeta>
  );
}

function Actividad({ pacientes, hoy }: { pacientes: Paciente[]; hoy: string }) {
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
  const contactos = pacientes.flatMap((p) => p.contactos);
  const act = dias.map((d) => ({ d, c: contactos.filter((x) => x.fecha === d).length, r: pacientes.filter((p) => p.recuperadoEl === d).length }));
  const totalC = act.reduce((s, a) => s + a.c, 0);
  if (!totalC) return <Pista>Sin contactos registrados en las últimas dos semanas.</Pista>;
  const totalR = act.reduce((s, a) => s + a.r, 0);
  const max = Math.max(1, ...act.map((a) => a.c));
  return (
    <div className="entrar card p-5 sm:p-6">
      <p className="text-sm">
        <b className="num">{totalC}</b> contactos · <b className="num">{totalR}</b> pacientes recuperados · <span className="text-muted">{(totalC / 14).toFixed(1).replace('.', ',')} contactos al día en promedio</span>
      </p>
      <div className="mt-5 flex h-32 items-end gap-1.5 sm:gap-2.5">
        {act.map((a, i) => (
          <div key={a.d} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${fechaCorta(a.d)}: ${a.c} contactos, ${a.r} recuperados`}>
            {a.r > 0 && <span className="pop iris size-2 rounded-full" />}
            <div className={`crecer-y w-full rounded-t-lg ${a.d === hoy ? 'iris' : 'bg-ink/85 group-hover:bg-ink'}`} style={{ height: `${Math.max(4, (a.c / max) * 100)}%`, animationDelay: `${i * 30}ms` }} />
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
    </div>
  );
}

// las mismas hojas del Excel, plegadas para no competir con las cifras
function TablasDatos({ tablas, hoy }: { tablas: ReturnType<typeof hojas>; hoy: string }) {
  const [tabla, setTabla] = useState(tablas[0].id);
  const actual = tablas.find((t) => t.id === tabla)!;
  return (
    <details className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold">Ver los datos en tablas</span>
          <span className="text-sm text-muted">Las mismas hojas del Excel, para revisar o filtrar aquí.</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-5 sm:p-6">
        <Pestanas valor={tabla} onCambio={setTabla} opciones={tablas.map((t) => [t.id, `${t.nombre} · ${t.filas.length}`] as [string, string])} />
        <div key={tabla} className="entrar mt-5">
          <Tabla nombre={actual.nombre} filas={actual.filas} archivo={`blissens-${actual.id}-${hoy}.xlsx`} />
        </div>
      </div>
    </details>
  );
}
