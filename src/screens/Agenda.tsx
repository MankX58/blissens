import { useState, type ReactNode } from 'react';
import { Check, MessageCircle, Plus, RotateCcw, Trash2, UserX } from 'lucide-react';
import type { Hueco, Paciente } from '../types';
import { ESPECIALISTAS } from '../data/demo';
import { guionHueco } from '../lib/guiones';
import { CASO_TXT, ESTADO_TXT, altoValor, fechaCorta, linkWhatsApp, pesosCorto, sumarDias } from '../lib/reglas';
import { Cifra, Encabezado, Etiqueta, EtiquetaSegmento, Pestanas, Vacio, btnBorde, btnChico, btnNegro } from '../components/ui';

const doctor = (e: string) => e.split(' · ')[0];
type Vista = 'disponibles' | 'asignados' | 'historial';

function sugeridos(h: Hueco, pacientes: Paciente[]) {
  return pacientes
    .filter((p) => (p.estado === 'pendiente' || p.estado === 'agotado') && p.telefono)
    .sort((a, b) => {
      const ma = doctor(a.especialista) === doctor(h.especialista) ? 0 : 1;
      const mb = doctor(b.especialista) === doctor(h.especialista) ? 0 : 1;
      if (ma !== mb) return ma - mb;
      if (altoValor(a) !== altoValor(b)) return altoValor(a) ? -1 : 1;
      return b.valor - a.valor;
    });
}

export function Agenda({
  pacientes,
  huecos,
  hoy,
  onAsignar,
  onRevertir,
  onOfrecer,
  onAsistencia,
  onAbrir,
  onAgregar,
  onBorrar,
}: {
  pacientes: Paciente[];
  huecos: Hueco[];
  hoy: string;
  onAsignar: (huecoId: string, pacienteId: string) => void;
  onRevertir: (huecoId: string) => void;
  onOfrecer: (huecoId: string, pacienteId: string) => void;
  onAsistencia: (huecoId: string, a: 'asistio' | 'no_asistio') => void;
  onAbrir: (id: string) => void;
  onAgregar: (h: Hueco) => void;
  onBorrar: (id: string) => void;
}) {
  const [vista, setVista] = useState<Vista>('disponibles');
  const [form, setForm] = useState(false);
  const orden = (a: Hueco, b: Hueco) => (a.fecha + a.hora < b.fecha + b.hora ? -1 : 1);
  const disponibles = huecos.filter((h) => h.fecha >= hoy && !h.ocupadoPor).sort(orden);
  const asignados = huecos.filter((h) => h.ocupadoPor && !h.asistencia).sort(orden);
  const historial = huecos.filter((h) => h.fecha < hoy && (h.asistencia || !h.ocupadoPor)).sort((a, b) => -orden(a, b));
  const paciente = (id?: string) => pacientes.find((p) => p.id === id);

  const proximosAsignados = huecos.filter((h) => h.ocupadoPor && h.fecha >= hoy);
  const horas = proximosAsignados.reduce((s, h) => s + h.minutos, 0) / 60;
  const valor = proximosAsignados.reduce((s, h) => s + (paciente(h.ocupadoPor)?.valor ?? 0), 0);
  const perdidos = huecos.filter((h) => h.fecha < hoy && !h.ocupadoPor).length;

  return (
    <div>
      <Encabezado
        roles={['recepcion']}
        titulo="Agenda abierta"
        descripcion="Espacios liberados por cancelaciones o inasistencias. Para cada uno sugerimos pacientes en seguimiento del mismo especialista, primero los de alto valor."
      >
        <button onClick={() => setForm((v) => !v)} className={btnNegro}>
          <Plus className="size-4" /> Nuevo espacio
        </button>
      </Encabezado>

      <dl className="escalonado mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi k="Espacios disponibles" v={<Cifra valor={disponibles.length} />} destacado={disponibles.length > 0} />
        <Kpi k="Horas recuperadas (próximas)" v={<Cifra valor={horas} formato={(n) => n.toFixed(1).replace('.', ',') + ' h'} />} />
        <Kpi k="Valor de tratamientos agendados" v={<Cifra valor={valor} formato={pesosCorto} />} />
        <Kpi k="Espacios que se perdieron" v={<Cifra valor={perdidos} />} />
      </dl>

      {form && (
        <NuevoEspacio
          hoy={hoy}
          onGuardar={(h) => {
            onAgregar(h);
            setForm(false);
            setVista('disponibles');
          }}
        />
      )}

      <div className="mt-8">
        <Pestanas
          valor={vista}
          onCambio={setVista}
          opciones={[
            ['disponibles', `Disponibles · ${disponibles.length}`],
            ['asignados', `Asignados · ${asignados.length}`],
            ['historial', `Historial · ${historial.length}`],
          ]}
        />
      </div>

      <div key={vista} className="mt-5">
        {vista === 'disponibles' &&
          (disponibles.length === 0 ? (
            <Vacio titulo="Sin espacios disponibles" texto="Cuando cargues una agenda con cancelaciones futuras aparecerán aquí. También puedes agregarlos a mano." />
          ) : (
            <div className="escalonado space-y-4">
              {disponibles.map((h) => (
                <Disponible key={h.id} h={h} hoy={hoy} pacientes={pacientes} onAsignar={onAsignar} onOfrecer={onOfrecer} onBorrar={onBorrar} onAbrir={onAbrir} />
              ))}
            </div>
          ))}

        {vista === 'asignados' &&
          (asignados.length === 0 ? (
            <Vacio titulo="Nadie asignado todavía" texto="Cuando un paciente acepte un espacio, aparecerá aquí para que puedas confirmarlo, revertirlo o registrar si asistió." />
          ) : (
            <div className="card overflow-hidden">
              <ul className="escalonado divide-y divide-line">
                {asignados.map((h) => {
                  const p = paciente(h.ocupadoPor);
                  const paso = h.fecha <= hoy;
                  return (
                    <li key={h.id} className="grid gap-4 p-5 md:grid-cols-[150px_1fr_auto] md:items-center">
                      <Fecha h={h} hoy={hoy} />
                      <div className="min-w-0">
                        {p ? (
                          <>
                            <button onClick={() => onAbrir(p.id)} className="font-semibold hover:underline">
                              {p.nombre}
                            </button>
                            <p className="truncate text-sm text-muted">
                              {p.tratamiento} · {doctor(h.especialista)}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              Asignado el {h.asignadoEl ? fechaCorta(h.asignadoEl) : '—'}
                              {h.estadoPrevio && ` · venía de “${ESTADO_TXT[h.estadoPrevio]}”`}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted">Paciente eliminado</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {paso && (
                          <>
                            <button onClick={() => onAsistencia(h.id, 'asistio')} className={`${btnChico} bg-verde/12 text-verde hover:bg-verde/20`}>
                              <Check className="size-3.5" /> Asistió
                            </button>
                            <button onClick={() => onAsistencia(h.id, 'no_asistio')} className={`${btnChico} bg-rojo/10 text-rojo hover:bg-rojo/15`}>
                              <UserX className="size-3.5" /> No asistió
                            </button>
                          </>
                        )}
                        <Revertir onConfirmar={() => onRevertir(h.id)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

        {vista === 'historial' &&
          (historial.length === 0 ? (
            <Vacio titulo="Sin historial" texto="Aquí quedan los espacios que ya pasaron: quién asistió, quién no y cuáles se perdieron." />
          ) : (
            <div className="card overflow-hidden">
              <ul className="escalonado divide-y divide-line">
                {historial.map((h) => {
                  const p = paciente(h.ocupadoPor);
                  return (
                    <li key={h.id} className="grid gap-3 p-5 sm:grid-cols-[150px_1fr_auto] sm:items-center">
                      <Fecha h={h} hoy={hoy} />
                      <div className="min-w-0 text-sm">
                        {p ? (
                          <button onClick={() => onAbrir(p.id)} className="font-semibold hover:underline">
                            {p.nombre}
                          </button>
                        ) : (
                          <span className="text-muted">Nadie ocupó este espacio</span>
                        )}
                        <p className="text-muted">{doctor(h.especialista)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.asistencia === 'asistio' && <Etiqueta tono="ok">Asistió</Etiqueta>}
                        {h.asistencia === 'no_asistio' && <Etiqueta tono="mal">No asistió · volvió al 3-7-15</Etiqueta>}
                        {!h.ocupadoPor && <Etiqueta>Se perdió</Etiqueta>}
                        {h.ocupadoPor && <Revertir onConfirmar={() => onRevertir(h.id)} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}

function Kpi({ k, v, destacado }: { k: string; v: ReactNode; destacado?: boolean }) {
  return (
    <div className={`rounded-[22px] p-5 ${destacado ? 'bg-ink text-white' : 'card'}`}>
      <dd className="text-[28px] font-bold leading-none tracking-tight">{v}</dd>
      <dt className={`mt-2 text-xs ${destacado ? 'text-white/55' : 'text-muted'}`}>{k}</dt>
    </div>
  );
}

function Fecha({ h, hoy }: { h: Hueco; hoy: string }) {
  const dia = h.fecha === hoy ? 'Hoy' : h.fecha === sumarDias(hoy, 1) ? 'Mañana' : h.fecha === sumarDias(hoy, -1) ? 'Ayer' : fechaCorta(h.fecha);
  return (
    <div>
      <p className="kicker">{dia}</p>
      <p className="num text-2xl font-bold">{h.hora}</p>
      <p className="text-xs text-muted">{h.minutos} min</p>
    </div>
  );
}

// revertir pide confirmación en el mismo botón, sin ventanas emergentes
function Revertir({ onConfirmar }: { onConfirmar: () => void }) {
  const [seguro, setSeguro] = useState(false);
  return seguro ? (
    <span className="pop inline-flex items-center gap-1 rounded-full bg-soft p-1 text-xs">
      <span className="px-2 font-medium">¿Liberar el espacio?</span>
      <button onClick={onConfirmar} className={`${btnChico} bg-ink text-white`}>
        Sí, revertir
      </button>
      <button onClick={() => setSeguro(false)} className={`${btnChico} text-muted hover:text-ink`}>
        No
      </button>
    </span>
  ) : (
    <button onClick={() => setSeguro(true)} className={`${btnChico} bg-soft text-ink/75 hover:text-ink`}>
      <RotateCcw className="size-3.5" /> Revertir
    </button>
  );
}

function Disponible({
  h,
  hoy,
  pacientes,
  onAsignar,
  onOfrecer,
  onBorrar,
  onAbrir,
}: {
  h: Hueco;
  hoy: string;
  pacientes: Paciente[];
  onAsignar: (huecoId: string, pacienteId: string) => void;
  onOfrecer: (huecoId: string, pacienteId: string) => void;
  onBorrar: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const todos = sugeridos(h, pacientes);
  const [otro, setOtro] = useState('');
  const dia = h.fecha === hoy ? 'Hoy' : h.fecha === sumarDias(hoy, 1) ? 'Mañana' : fechaCorta(h.fecha);
  return (
    <article className="card lift grid overflow-hidden md:grid-cols-[230px_1fr]">
      <div className="relative flex flex-row items-center justify-between gap-4 overflow-hidden bg-ink p-6 text-white md:flex-col md:items-start md:justify-start">
        <div className="iris pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full opacity-25 blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[.16em] text-white/55">{dia}</p>
          <p className="num mt-1 text-4xl font-bold">{h.hora}</p>
          <p className="mt-1 text-sm text-white/70">
            {h.minutos} min · {doctor(h.especialista)}
          </p>
          {h.ofertas.length > 0 && <p className="mt-3 text-xs text-white/50">Ofrecido a {h.ofertas.length}</p>}
        </div>
        <button onClick={() => onBorrar(h.id)} aria-label="Eliminar espacio" className="relative rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white md:mt-auto">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="p-5 sm:p-6">
        <p className="kicker">Sugeridos para este espacio</p>
        <ul className="mt-2 divide-y divide-line">
          {todos.slice(0, 3).map((p) => {
            const ofrecido = h.ofertas.some((o) => o.pacienteId === p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <button onClick={() => onAbrir(p.id)} className="font-medium hover:underline">
                      {p.nombre}
                    </button>
                    <EtiquetaSegmento p={p} />
                    {ofrecido && <Etiqueta>Ofrecido</Etiqueta>}
                  </span>
                  <span className="block text-sm text-muted">
                    {CASO_TXT[p.caso]} · {p.tratamiento} {p.valor > 0 && `· ${pesosCorto(p.valor)}`}
                  </span>
                </span>
                <a
                  href={linkWhatsApp(p.telefono, guionHueco(p, h))}
                  target="_blank"
                  rel="noopener"
                  onClick={() => onOfrecer(h.id, p.id)}
                  className={`${btnBorde} px-4 py-2`}
                >
                  <MessageCircle className="size-4" /> Ofrecer
                </a>
                <button onClick={() => onAsignar(h.id, p.id)} className={`${btnNegro} px-4 py-2`}>
                  Asignar
                </button>
              </li>
            );
          })}
          {todos.length === 0 && <li className="py-3 text-sm text-muted">No hay pacientes en seguimiento para sugerir.</li>}
        </ul>
        {todos.length > 3 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
            <select value={otro} onChange={(e) => setOtro(e.target.value)} className="field sm:flex-1" aria-label="Asignar a otro paciente">
              <option value="">Asignar a otro paciente…</option>
              {todos.slice(3).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.tratamiento}
                </option>
              ))}
            </select>
            <button disabled={!otro} onClick={() => onAsignar(h.id, otro)} className={btnBorde}>
              Asignar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function NuevoEspacio({ hoy, onGuardar }: { hoy: string; onGuardar: (h: Hueco) => void }) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1));
  const [hora, setHora] = useState('09:00');
  const [minutos, setMinutos] = useState(60);
  const [especialista, setEspecialista] = useState(ESPECIALISTAS[0]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({ id: `h-${Date.now()}`, fecha, hora, minutos, especialista, ofertas: [] });
      }}
      className="hoja card mt-6 grid gap-3 p-5 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] sm:items-end"
    >
      <label className="text-xs font-medium text-muted">
        Fecha
        <input type="date" min={hoy} required value={fecha} onChange={(e) => setFecha(e.target.value)} className="field mt-1" />
      </label>
      <label className="text-xs font-medium text-muted">
        Hora
        <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="field mt-1" />
      </label>
      <label className="text-xs font-medium text-muted">
        Duración
        <select value={minutos} onChange={(e) => setMinutos(+e.target.value)} className="field mt-1">
          {[30, 45, 60, 90, 120].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-muted">
        Especialista
        <select value={especialista} onChange={(e) => setEspecialista(e.target.value)} className="field mt-1">
          {ESPECIALISTAS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </label>
      <button className={btnNegro}>Guardar</button>
    </form>
  );
}
