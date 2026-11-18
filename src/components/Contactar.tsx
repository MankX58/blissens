import { useEffect, useState, type ReactNode } from 'react';
import { Check, MessageCircle, Phone } from 'lucide-react';
import type { Motivo, Paciente, Resultado } from '../types';
import { guionesPara } from '../lib/guiones';
import {
  CASO_TXT,
  MOTIVO_TXT,
  PASOS,
  RESULTADO_TXT,
  diasEntre,
  fechaCorta,
  hoyISO,
  linkWhatsApp,
  pasoActual,
  pesos,
  semaforo,
  sumarDias,
} from '../lib/reglas';
import { EtiquetaSegmento, Iniciales, Modal, Punto, SEMAFORO_TXT, btnBorde, btnNegro } from './ui';

const RESULTADOS: { id: Resultado; ayuda: string }[] = [
  { id: 'agendo', ayuda: 'Paciente recuperado' },
  { id: 'lo_pensara', ayuda: 'Sigue en la regla 3-7-15' },
  { id: 'sin_respuesta', ayuda: 'Sigue en la regla 3-7-15' },
  { id: 'no_interesa', ayuda: 'Sale de la lista' },
];

export function Contactar({
  paciente,
  onCerrar,
  onGuardar,
}: {
  paciente: Paciente | null;
  onCerrar: () => void;
  onGuardar: (p: Paciente, r: Resultado, mensaje: string, motivo: Motivo, nota: string) => void;
}) {
  const hoy = hoyISO();
  const guiones = paciente ? guionesPara(paciente) : [];
  const [guion, setGuion] = useState(0);
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [motivo, setMotivo] = useState<Motivo>('sin_dato');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!paciente) return;
    setGuion(0);
    setTexto(guionesPara(paciente)[0].texto);
    setEnviado(false);
    setResultado(null);
    setMotivo(paciente.motivo);
    setNota('');
  }, [paciente?.id]);

  if (!paciente) return null;
  const p = paciente;
  const paso = pasoActual(p);
  const color = semaforo(p, hoy);
  const sigPaso = paso ? PASOS[PASOS.indexOf(paso) + 1] : undefined;

  const abrirWhatsApp = () => {
    window.open(linkWhatsApp(p.telefono, texto), '_blank', 'noopener');
    setEnviado(true);
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Contactar a ${p.nombre}`} ancho="max-w-4xl">
      <div className="grid md:grid-cols-[300px_1fr]">
        {/* ficha */}
        <aside className="order-last bg-ink p-6 text-white md:order-none md:rounded-l-3xl">
          <div className="flex items-center gap-3">
            <Iniciales nombre={p.nombre} claro />
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.nombre}</p>
              <p className="truncate text-xs text-white/60">{p.ciudad}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <EtiquetaSegmento p={p} />
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <Dato k="Caso" v={`${CASO_TXT[p.caso]} · ${fechaCorta(p.fechaEvento)}`} />
            <Dato k="Tratamiento" v={p.tratamiento} />
            <Dato k="Especialista" v={p.especialista} />
            {p.valor > 0 && <Dato k="Valor del plan" v={pesos(p.valor)} />}
            <Dato k="Celular" v={p.telefono || 'Sin número'} />
          </dl>

          {/* línea 3-7-15 */}
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.18em] text-white/50">Regla 3 · 7 · 15</p>
          <ol className="mt-3 space-y-3">
            {PASOS.map((d) => {
              const c = p.contactos.find((x) => x.paso === d);
              const actual = d === paso;
              return (
                <li key={d} className="flex items-start gap-3 text-sm">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      c ? 'bg-white text-ink' : actual ? 'iris text-ink' : 'border border-white/20 text-white/40'
                    }`}
                  >
                    {c ? <Check className="size-3.5" /> : d}
                  </span>
                  <div className="leading-tight">
                    <p className={actual ? 'font-semibold' : c ? 'text-white/85' : 'text-white/40'}>
                      Día {d} · {fechaCorta(sumarDias(p.fechaEvento, d))}
                    </p>
                    <p className="text-xs text-white/50">
                      {c ? RESULTADO_TXT[c.resultado] : actual ? 'Toca ahora' : 'Pendiente'}
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
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-muted">
              <Punto color={color} /> {SEMAFORO_TXT[color]} · intento del día {paso}
            </p>
          )}

          <Paso n={1} titulo="Escribe por WhatsApp" hecho={enviado}>
            <div className="flex flex-wrap gap-1.5">
              {guiones.map((g, i) => (
                <button
                  key={g.titulo}
                  onClick={() => {
                    setGuion(i);
                    setTexto(g.texto);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    i === guion ? 'bg-ink text-white' : 'bg-soft text-ink/70 hover:text-ink'
                  }`}
                >
                  {g.titulo}
                </button>
              ))}
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              className="field mt-3 resize-y leading-relaxed"
              aria-label="Mensaje"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={abrirWhatsApp} disabled={!p.telefono} className={btnNegro}>
                <MessageCircle className="size-4" /> Abrir WhatsApp con este mensaje
              </button>
              {p.telefono && (
                <a href={`tel:${p.telefono.replace(/\s/g, '')}`} onClick={() => setEnviado(true)} className={btnBorde}>
                  <Phone className="size-4" /> Llamar
                </a>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Se abre WhatsApp con el texto listo; solo tienes que darle enviar.</p>
          </Paso>

          <Paso n={2} titulo="¿Qué respondió?" hecho={!!resultado}>
            <div className="grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResultado(r.id)}
                  className={`rounded-2xl border p-3 text-left ${
                    resultado === r.id ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/40'
                  }`}
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
                      ? 'Era el último intento: pasa a campañas.'
                      : `Hace ${diasEntre(p.fechaEvento, hoy)} días del evento.`}
            </p>
            <button
              disabled={!resultado}
              onClick={() => resultado && onGuardar(p, resultado, texto, motivo, nota)}
              className={btnNegro}
            >
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
      <dt className="text-[11px] uppercase tracking-[.14em] text-white/45">{k}</dt>
      <dd className="mt-0.5 text-white/90">{v}</dd>
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
