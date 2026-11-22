import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, Check, ChevronDown, Mail, MessageCircle, Phone } from 'lucide-react';
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
  porQueSemaforo,
  PASO_TXT,
  SEMAFORO_INFO,
} from '../lib/reglas';
import { Iniciales, Insignias, Modal, Punto, SEMAFORO_TXT, btnBorde, btnNegro } from './ui';

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

  const ultimo = p.contactos.at(-1);
  const porQue = `${CASO_TXT[p.caso]} el ${fechaCorta(p.ultimaCita?.fecha ?? p.fechaEvento)}${p.ultimaCita?.estado ? ` (${p.ultimaCita.estado.toLowerCase()})` : ''}`;
  const consecuencia =
    resultado === 'agendo'
      ? 'Quedará como recuperado en los indicadores.'
      : resultado === 'no_interesa'
        ? 'Sale de la lista y se guarda el motivo.'
        : resultado && sigPaso
          ? `Volverá a aparecer el ${fechaCorta(sumarDias(p.fechaEvento, sigPaso))} (día ${sigPaso}).`
          : resultado
            ? 'Era el rescate del día 15: pasa a campañas de reactivación.'
            : 'Elige qué respondió para guardar.';

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Contactar a ${p.nombre}`} ancho="max-w-2xl">
      {/* quién es y por qué toca hoy */}
      <header className="border-b border-line p-5 pr-16 sm:p-7 sm:pr-16">
        <div className="flex items-center gap-3">
          <Iniciales nombre={p.nombre} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">{p.nombre}</h2>
            <p className="truncate text-xs text-muted">
              {p.idPaciente} · {p.especialista}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Insignias p={p} detalle />
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl bg-soft p-4 sm:grid-cols-[1.3fr_1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {color && <Punto color={color} />}
              {color ? SEMAFORO_TXT[color] : 'Sin etapa'}
              {paso && <span className="font-normal text-muted">· {PASO_TXT[paso]}</span>}
            </p>
            {color && <p className="mt-0.5 text-[13px] text-ink/80">{porQueSemaforo(p, hoy)}</p>}
            <p className="mt-0.5 text-xs text-muted">
              {color ? `${SEMAFORO_INFO[color].hacer} · ` : ''}
              {porQue}
            </p>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={p.tratamiento}>
              {p.tratamiento || 'Sin tratamiento registrado'}
            </p>
            <p className="text-xs text-muted">{p.valor > 0 ? `${pesos(p.valor)} según el arancel` : 'Tratamiento'}</p>
          </div>
          <Pasos p={p} paso={paso} />
        </div>

        <details className="group mt-3 text-sm">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-ink/70 hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden /> Ver ficha
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Dato k="Celular" v={p.telefono || 'Sin celular'} />
            <Dato k="Correo" v={p.email || '—'} />
            {p.apoderado && <Dato k="Apoderado" v={p.apoderado} />}
            <Dato k="Segmento" v={`${p.grupo}. ${GRUPO_TXT[p.grupo]}`} />
            {p.motivoVip && <Dato k="Por qué es VIP" v={p.motivoVip} />}
            <Dato k="Riesgo" v={`${p.nivelRiesgo} · ${p.fallosSeguidos} seguidas sin asistir`} />
            {ultimo && <Dato k="Último contacto" v={`${fechaCorta(ultimo.fecha)} · ${RESULTADO_TXT[ultimo.resultado]}`} />}
          </dl>
        </details>

        {p.especialista === 'Dr. Juan Manuel Olarte' && (
          <button
            onClick={() => {
              onReasignar(p.id);
              setGuionId(String(N_REASIGNACION));
              setTexto(guionReasignacion(p, ctx));
            }}
            className="mt-2 inline-flex items-start gap-1.5 text-left text-xs font-semibold text-ink/70 hover:text-ink"
          >
            <ArrowRightLeft className="size-3.5" aria-hidden /> ¿El Dr. Olarte está de viaje? Reasignar a la Dra. Sara
          </button>
        )}
      </header>

      <div className="space-y-7 p-5 sm:p-7">
        {!p.telefono && (
          <div className="rounded-2xl border border-amarillo/40 bg-amarillo/10 p-4">
            <p className="text-sm font-semibold">Falta el celular</p>
            <p className="mt-0.5 text-xs text-muted">Agrégalo para escribirle por WhatsApp{p.email ? ', o envíale el mensaje por correo' : ''}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={cel} onChange={(e) => setCel(e.target.value)} placeholder="Ej. 310 892 6704" className="field w-auto min-w-0 flex-1" inputMode="tel" aria-label="Celular" />
              <button disabled={!celValido} onClick={() => onTelefono(p.id, celValido)} className={btnNegro}>
                Guardar
              </button>
            </div>
            {cel && !celValido && <p className="mt-1.5 text-xs text-rojo">Escribe un celular de 10 dígitos que empiece por 3, o con indicativo.</p>}
          </div>
        )}

        <Paso n={1} titulo="Mensaje" hecho={enviado}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Guiones recomendados">
            {lista.sugeridos.map((g) => (
              <button
                key={g.id}
                onClick={() => setGuionId(g.id)}
                aria-pressed={g.id === elegido.id}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${g.id === elegido.id ? 'bg-ink text-white' : 'bg-soft text-ink/70 hover:text-ink'}`}
                title={g.categoria}
              >
                {g.titulo}
              </button>
            ))}
            <select
              value={lista.sugeridos.some((g) => g.id === elegido.id) ? '' : elegido.id}
              onChange={(e) => e.target.value && setGuionId(e.target.value)}
              className="rounded-full border border-dashed border-line bg-transparent px-3 py-1.5 text-xs font-semibold text-ink/70 hover:text-ink"
              aria-label="Otro guion oficial"
            >
              <option value="">Otro guion…</option>
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
          </div>
          {pide && (
            <div className="mt-3 grid grid-cols-2 gap-2">
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
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} className="field mt-3 resize-y leading-relaxed" aria-label="Mensaje" />
          {/\[[A-ZÁÉÍÓÚ /]+\]/.test(texto) && <p className="mt-1 text-xs text-amarillo">Completa los campos entre corchetes antes de enviar.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                window.open(linkWhatsApp(p.telefono, texto), '_blank', 'noopener');
                setEnviado(true);
              }}
              disabled={!p.telefono}
              className={btnNegro}
            >
              <MessageCircle className="size-4" aria-hidden /> Abrir WhatsApp
            </button>
            {p.telefono && (
              <a href={`tel:${p.telefono}`} onClick={() => setEnviado(true)} className={btnBorde}>
                <Phone className="size-4" aria-hidden /> Llamar
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}?subject=${encodeURIComponent('BLISSENS ODONTOLOGÍA')}&body=${encodeURIComponent(texto)}`} onClick={() => setEnviado(true)} className={btnBorde}>
                <Mail className="size-4" aria-hidden /> Correo
              </a>
            )}
          </div>
        </Paso>

        <Paso n={2} titulo="¿Qué respondió?" hecho={!!resultado}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Respuesta del paciente">
            {RESULTADOS.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={resultado === r.id}
                onClick={() => setResultado(r.id)}
                className={`rounded-2xl border px-3 py-2.5 text-left ${resultado === r.id ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/40'}`}
              >
                <span className="block text-sm font-semibold">{RESULTADO_TXT[r.id]}</span>
                <span className={`text-[11px] ${resultado === r.id ? 'text-white/70' : 'text-muted'}`}>{r.ayuda}</span>
              </button>
            ))}
          </div>
          {resultado && (
            <div className="hoja mt-3 grid gap-2 sm:grid-cols-2">
              {resultado !== 'agendo' && (
                <label className="text-xs font-medium text-muted">
                  ¿Por qué no siguió?
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)} className="field mt-1">
                    {Object.entries(MOTIVO_TXT).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className={`text-xs font-medium text-muted ${resultado === 'agendo' ? 'sm:col-span-2' : ''}`}>
                Nota (opcional)
                <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: prefiere martes en la tarde" className="field mt-1" />
              </label>
            </div>
          )}
        </Paso>
      </div>

      {/* pie fijo: lo que va a pasar y guardar */}
      <footer className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-line bg-paper/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-xs text-muted" aria-live="polite">
          {consecuencia}
        </p>
        <button disabled={!resultado} onClick={() => resultado && onGuardar(p, resultado, texto, motivo, nota)} className={`${btnNegro} shrink-0`}>
          Guardar y seguir
        </button>
      </footer>
    </Modal>
  );
}

// los tres intentos del 3-7-15 en miniatura: hecho, toca ahora o pendiente
function Pasos({ p, paso }: { p: Paciente; paso: number | null }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Regla 3-7-15">
      {PASOS.map((d) => {
        const c = p.contactos.find((x) => x.paso === d);
        const actual = d === paso;
        const estado = c ? RESULTADO_TXT[c.resultado] : actual ? 'toca ahora' : d < (paso ?? 0) ? 'se pasó' : fechaCorta(sumarDias(p.fechaEvento, d));
        return (
          <li
            key={d}
            title={`Día ${d}: ${estado}`}
            aria-label={`Día ${d}: ${estado}`}
            className={`grid size-8 place-items-center rounded-full text-[11px] font-bold ${
              c ? 'bg-ink text-white' : actual ? 'iris text-ink ring-2 ring-white' : 'bg-white text-muted ring-1 ring-line'
            }`}
          >
            {c ? <Check className="size-3.5" aria-hidden /> : d}
          </li>
        );
      })}
    </ol>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/70 py-1.5 sm:block sm:border-0 sm:py-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="break-words text-right text-sm font-medium sm:text-left">{v}</dd>
    </div>
  );
}

function Paso({ n, titulo, hecho, children }: { n: number; titulo: string; hecho: boolean; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2.5 text-base font-semibold">
        <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${hecho ? 'bg-verde text-white' : 'bg-ink text-white'}`}>
          {hecho ? <Check className="size-3.5" aria-hidden /> : n}
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}
