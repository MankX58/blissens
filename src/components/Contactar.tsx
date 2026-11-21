import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, Check, Mail, MessageCircle, Phone } from 'lucide-react';
import type { Motivo, Paciente, Resultado } from '../types';
import { GUIONES } from '../data/guiones';
import { N_REASIGNACION, guionesPara, guionReasignacion } from '../lib/guiones';
import {
  CASO_TXT,
  GRUPO_TXT,
  MOTIVO_TXT,
  PASOS,
  RESULTADO_TXT,
  diasEntre,
  fechaCorta,
  linkWhatsApp,
  normalizarCelular,
  pasoActual,
  pesos,
  semaforo,
  sumarDias,
} from '../lib/reglas';
import { Iniciales, Insignias, Meta, Modal, Punto, SEMAFORO_TXT, btnBorde, btnNegro } from './ui';

const RESULTADOS: { id: Resultado; ayuda: string }[] = [
  { id: 'agendo', ayuda: 'Paciente recuperado' },
  { id: 'lo_pensara', ayuda: 'Sigue en la regla 3-7-15' },
  { id: 'sin_respuesta', ayuda: 'Sigue en la regla 3-7-15' },
  { id: 'no_interesa', ayuda: 'Sale de la lista' },
];

export function Contactar({
  paciente,
  hoy,
  asesora,
  onCerrar,
  onGuardar,
  onTelefono,
  onReasignar,
}: {
  paciente: Paciente | null;
  hoy: string;
  asesora: string;
  onCerrar: () => void;
  onGuardar: (p: Paciente, r: Resultado, mensaje: string, motivo: Motivo, nota: string) => void;
  onTelefono: (id: string, telefono: string) => void;
  onReasignar: (id: string) => void;
}) {
  const [guionId, setGuionId] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [motivo, setMotivo] = useState<Motivo>('sin_dato');
  const [nota, setNota] = useState('');
  const [cel, setCel] = useState('');

  const ctx = { asesora, nuevaFecha: nuevaFecha || undefined, nuevaHora: nuevaHora || undefined };
  const lista = useMemo(() => (paciente ? guionesPara(paciente, hoy, ctx) : null), [paciente, hoy, asesora, nuevaFecha, nuevaHora]);
  const elegido = lista && ([...lista.sugeridos, ...lista.todos].find((g) => g.id === guionId) ?? lista.sugeridos[0]);

  useEffect(() => {
    if (!paciente) return;
    setGuionId('');
    setNuevaFecha('');
    setNuevaHora('');
    setEnviado(false);
    setResultado(null);
    setMotivo(paciente.motivo);
    setNota('');
    setCel('');
  }, [paciente?.id]);

  // el texto se regenera al cambiar de guion o al completar fecha/hora
  useEffect(() => {
    if (elegido) setTexto(elegido.texto);
  }, [elegido?.id, elegido?.texto]);

  if (!paciente || !lista || !elegido) return null;
  const p = paciente;
  const paso = pasoActual(p, hoy);
  const color = semaforo(p, hoy);
  const sigPaso = paso ? PASOS[PASOS.indexOf(paso) + 1] : undefined;
  const pide = /\[NUEVA (FECHA|HORA)\]/.test(elegido.texto) || !!nuevaFecha;
  const celValido = normalizarCelular(cel);

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Contactar a ${p.nombre}`} ancho="max-w-5xl">
      <div className="grid md:grid-cols-[310px_1fr]">
        {/* ficha */}
        <aside className="order-last bg-ink p-6 text-white md:order-none md:rounded-l-[28px]">
          <div className="flex items-center gap-3">
            <Iniciales nombre={p.nombre} claro />
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.nombre}</p>
              <Meta p={p} doctor={false} oscuro className="block" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Insignias p={p} oscuro detalle />
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <Dato k="Segmento" v={`${p.grupo} · ${GRUPO_TXT[p.grupo]}`} />
            <Dato k="Caso" v={`${CASO_TXT[p.caso]} · ${fechaCorta(p.fechaEvento)}`} />
            {p.ultimaCita && (
              <Dato k="Última cita" v={`${fechaCorta(p.ultimaCita.fecha)}${p.ultimaCita.hora ? ` ${p.ultimaCita.hora}` : ''} · ${p.ultimaCita.estado} (${p.ultimaCita.tipo})`} />
            )}
            <Dato k="Comentario / tratamiento" v={p.tratamiento} />
            <Dato k="Especialista" v={p.especialista} />
            {p.valor > 0 && <Dato k="Valor estimado (arancel)" v={pesos(p.valor)} />}
            <Dato k="Celular" v={p.telefono || 'Sin celular'} />
            {p.email && <Dato k="Correo" v={p.email} />}
            {p.apoderado && <Dato k="Apoderado" v={p.apoderado} />}
          </dl>

          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.18em] text-white/50">Regla 3 · 7 · 15</p>
          <ol className="mt-3 space-y-3">
            {PASOS.map((d) => {
              const c = p.contactos.find((x) => x.paso === d);
              const actual = d === paso;
              const pasado = !c && paso !== null && d < paso;
              return (
                <li key={d} className="flex items-start gap-3 text-sm">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      c ? 'bg-white text-ink' : actual ? 'iris text-ink' : 'border border-white/20 text-white/60'
                    }`}
                  >
                    {c ? <Check className="size-3.5" /> : d}
                  </span>
                  <div className="leading-tight">
                    <p className={actual ? 'font-semibold' : c ? 'text-white/85' : 'text-white/60'}>
                      {d === 3 ? 'Urgente (0-3 días)' : d === 7 ? 'Seguimiento (día 7)' : 'Rescate (día 15)'}
                    </p>
                    <p className="text-xs text-white/50">
                      {c ? RESULTADO_TXT[c.resultado] : actual ? 'Toca ahora' : pasado ? 'Se pasó sin contacto' : fechaCorta(sumarDias(p.fechaEvento, d))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* flujo */}
        <section className="p-6 sm:p-8">
          {color && (
            <p className="flex items-center gap-2 pr-10 text-xs font-semibold uppercase tracking-[.14em] text-muted">
              <Punto color={color} /> {SEMAFORO_TXT[color]} · etapa día {paso} · {diasEntre(p.fechaEvento, hoy)} días desde el evento
            </p>
          )}

          {!p.telefono && (
            <div className="pop mt-5 rounded-2xl border border-amarillo/40 bg-amarillo/10 p-4">
              <p className="text-sm font-semibold">⚠️ Dato de contacto faltante</p>
              <p className="mt-0.5 text-xs text-muted">Este paciente no tiene celular en la agenda de octubre. Agrégalo o escríbele por correo.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={cel} onChange={(e) => setCel(e.target.value)} placeholder="Celular, ej. 310 892 6704" className="field w-auto flex-1" inputMode="tel" />
                <button disabled={!celValido} onClick={() => onTelefono(p.id, celValido)} className={btnNegro}>
                  Guardar celular
                </button>
                {p.email && (
                  <a href={`mailto:${p.email}?subject=${encodeURIComponent('BLISSENS ODONTOLOGÍA')}&body=${encodeURIComponent(texto)}`} className={btnBorde}>
                    <Mail className="size-4" /> Enviar correo
                  </a>
                )}
              </div>
              {cel && !celValido && <p className="mt-1.5 text-xs text-rojo">Escribe un celular de 10 dígitos que empiece por 3, o con indicativo.</p>}
            </div>
          )}

          {p.especialista === 'Dr. Juan Manuel Olarte' && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-sky/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                <b>¿El Dr. Olarte está de viaje?</b> <span className="text-muted">Ofrece la cita con la Dra. Sara López (guion oficial #{N_REASIGNACION}).</span>
              </p>
              <button
                onClick={() => {
                  onReasignar(p.id);
                  setGuionId(String(N_REASIGNACION));
                  setTexto(guionReasignacion(p, ctx));
                }}
                className={`${btnBorde} shrink-0`}
              >
                <ArrowRightLeft className="size-4" /> Reasignar a la Dra. Sara
              </button>
            </div>
          )}

          <Paso n={1} titulo="Escribe el mensaje" hecho={enviado}>
            <p className="mb-2 text-xs text-muted">Recomendados para este caso (matriz 5.1 del SRS):</p>
            <div className="flex flex-wrap gap-1.5">
              {lista.sugeridos.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGuionId(g.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${g.id === elegido.id ? 'bg-ink text-white' : 'bg-soft text-ink/70 hover:text-ink'}`}
                  title={g.categoria}
                >
                  {g.titulo}
                </button>
              ))}
            </div>
            <select value={elegido.id} onChange={(e) => setGuionId(e.target.value)} className="field mt-2" aria-label="Todos los guiones oficiales">
              {lista.sugeridos.some((g) => g.id === '6+24') && <option value="6+24">Doble confirmación · riesgo alto (02 + 09)</option>}
              {[...new Set(GUIONES.map((g) => g.categoria))].map((cat) => (
                <optgroup key={cat} label={cat}>
                  {GUIONES.filter((g) => g.categoria === cat).map((g) => (
                    <option key={g.n} value={String(g.n)}>
                      #{g.n} · {g.situacion}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {pide && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-muted">
                  Nueva fecha
                  <input type="date" min={hoy} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className="field mt-1" />
                </label>
                <label className="text-xs font-medium text-muted">
                  Nueva hora
                  <input type="time" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} className="field mt-1" />
                </label>
              </div>
            )}
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} className="field mt-2 resize-y leading-relaxed" aria-label="Mensaje" />
            {/\[[A-ZÁÉÍÓÚ /]+\]/.test(texto) && <p className="mt-1 text-xs text-amarillo">Quedan campos entre corchetes por completar antes de enviar.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  window.open(linkWhatsApp(p.telefono, texto), '_blank', 'noopener');
                  setEnviado(true);
                }}
                disabled={!p.telefono}
                className={btnNegro}
              >
                <MessageCircle className="size-4" /> Abrir WhatsApp con este mensaje
              </button>
              {p.telefono && (
                <a href={`tel:${p.telefono}`} onClick={() => setEnviado(true)} className={btnBorde}>
                  <Phone className="size-4" /> Llamar
                </a>
              )}
              {p.telefono && p.email && (
                <a href={`mailto:${p.email}?subject=${encodeURIComponent('BLISSENS ODONTOLOGÍA')}&body=${encodeURIComponent(texto)}`} onClick={() => setEnviado(true)} className={btnBorde}>
                  <Mail className="size-4" /> Correo
                </a>
              )}
            </div>
          </Paso>

          <Paso n={2} titulo="¿Qué respondió?" hecho={!!resultado}>
            <div className="grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResultado(r.id)}
                  className={`rounded-2xl border p-3 text-left ${resultado === r.id ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/40'}`}
                >
                  <span className="block text-sm font-semibold">{RESULTADO_TXT[r.id]}</span>
                  <span className={`text-xs ${resultado === r.id ? 'text-white/60' : 'text-muted'}`}>{r.ayuda}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted">
                Motivo por el que no siguió
                <select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)} className="field mt-1">
                  {Object.entries(MOTIVO_TXT).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                Nota (opcional)
                <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: prefiere martes en la tarde" className="field mt-1" />
              </label>
            </div>
          </Paso>

          <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
            <p className="text-xs text-muted">
              {resultado === 'agendo'
                ? 'Quedará como recuperado en los indicadores.'
                : resultado === 'no_interesa'
                  ? 'Sale de la lista y se guarda el motivo.'
                  : resultado && sigPaso
                    ? `Volverá a aparecer el ${fechaCorta(sumarDias(p.fechaEvento, sigPaso))} (día ${sigPaso}).`
                    : resultado
                      ? 'Era el rescate del día 15: pasa a campañas.'
                      : `${p.fallosSeguidos} citas seguidas sin asistir · ${p.fallosHistoricos} en todo su historial.`}
            </p>
            <button disabled={!resultado} onClick={() => resultado && onGuardar(p, resultado, texto, motivo, nota)} className={btnNegro}>
              Guardar y seguir
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[.14em] text-white/65">{k}</dt>
      <dd className="mt-0.5 break-words text-white/90">{v}</dd>
    </div>
  );
}

function Paso({ n, titulo, hecho, children }: { n: number; titulo: string; hecho: boolean; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 flex items-center gap-2.5 text-base font-semibold">
        <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${hecho ? 'bg-verde text-white' : 'bg-ink text-white'}`}>
          {hecho ? <Check className="size-3.5" /> : n}
        </span>
        {titulo}
      </h3>
      {children}
    </div>
  );
}
