import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, Check, ChevronDown, Copy, Mail, MessageCircle, Phone, TriangleAlert } from 'lucide-react';
import type { Motivo, MotivoNoContactar, Paciente, Resultado } from '../types';
import { N_REASIGNACION, TEXTO_AUTORIZACION, TODOS_GUIONES, guionesPara, guionReasignacion, rellenar } from '../lib/guiones';
import {
  ADELANTAR,
  AUTORIZA,
  CASO_TXT,
  EN_CHAT,
  NO_ADELANTAR,
  NO_AUTORIZA,
  NO_CONTACTAR,
  NO_CONTACTAR_TXT,
  SIN_CHAT,
  consentimiento,
  enChat,
  esInternacional,
  motivoNoContactar,
  anuladoPorClinica,
  prefijoNoContactar,
  quiereAdelantar,
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
  { id: 'no_interesa', ayuda: 'No contactar más' },
  { id: 'sin_whatsapp', ayuda: 'Revisar el número' },
];

export function Contactar({
  paciente,
  hoy,
  asesora,
  onCerrar,
  onGuardar,
  onTelefono,
  onReasignar,
  whatsappFallido,
}: {
  paciente: Paciente | null;
  hoy: string;
  asesora: string;
  onCerrar: () => void;
  onGuardar: (p: Paciente, r: Resultado, mensaje: string, motivo: Motivo, nota: string, noContactar?: MotivoNoContactar) => void;
  onTelefono: (id: string, telefono: string) => void;
  onReasignar: (id: string) => void;
  whatsappFallido?: boolean; // alguna cita suya quedó en «Notif. WhatsApp fallida»: número malo o inactivo
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
  const [tono, setTono] = useState<'usted' | 'tu'>('usted');
  const [noContactar, setNoContactar] = useState<MotivoNoContactar>(NO_CONTACTAR[0]);
  const [adelantar, setAdelantar] = useState(false);
  const [autoriza, setAutoriza] = useState<boolean | null>(null);
  const [chat, setChat] = useState(false);
  const [idioma, setIdioma] = useState<'es' | 'en'>('es');
  const [copiado, setCopiado] = useState(false);

  const ctx = { asesora, nuevaFecha: nuevaFecha || undefined, nuevaHora: nuevaHora || undefined, tono };
  const lista = useMemo(() => (paciente ? guionesPara(paciente, hoy, ctx) : null), [paciente, hoy, asesora, nuevaFecha, nuevaHora, tono]);
  // en inglés solo cuentan las plantillas 2xx; en español, las demás
  const delIdioma = (g: { id: string }) => (Number(g.id) >= 200) === (idioma === 'en');
  const sugeridos = lista ? (lista.sugeridos.filter(delIdioma).length ? lista.sugeridos.filter(delIdioma) : lista.todos.filter(delIdioma).slice(0, 3)) : [];
  const elegido = lista && ([...lista.sugeridos, ...lista.todos].find((g) => g.id === guionId) ?? sugeridos[0] ?? lista.sugeridos[0]);

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
    setTono('usted');
    setNoContactar(NO_CONTACTAR[0]);
    setAdelantar(quiereAdelantar(paciente));
    setAutoriza(consentimiento(paciente));
    setChat(enChat(paciente));
    setIdioma(esInternacional(paciente) ? 'en' : 'es');
    setCopiado(false);
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
  const numeroRaro = !!p.telefono && !normalizarCelular(p.telefono);
  const bloqueo = motivoNoContactar(p);
  const copiarAutorizacion = () => navigator.clipboard?.writeText(rellenar(TEXTO_AUTORIZACION, p, ctx)).catch(() => undefined);
  // ya está en un chat (o se le escribe al familiar): se copia el mensaje y se abre WhatsApp Web para pegarlo
  const copiarYAbrir = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      /* sin permiso de portapapeles: igual abre WhatsApp */
    }
    window.open('https://web.whatsapp.com/', '_blank', 'noopener');
    setEnviado(true);
  };
  const notaFinal = () =>
    [
      resultado === 'no_interesa' ? `${prefijoNoContactar}${NO_CONTACTAR_TXT[noContactar]}.` : '',
      resultado === 'sin_whatsapp' ? 'Número inválido o sin WhatsApp: confirmar por llamada o con el apoderado.' : '',
      adelantar !== quiereAdelantar(p) ? (adelantar ? ADELANTAR : NO_ADELANTAR) + '.' : '',
      autoriza !== consentimiento(p) && autoriza !== null ? (autoriza ? AUTORIZA : NO_AUTORIZA) + ' (Ley 1581 de 2012).' : '',
      chat !== enChat(p) ? (chat ? EN_CHAT : SIN_CHAT) + '.' : '',
      nota.trim(),
    ]
      .filter(Boolean)
      .join(' ');

  const ultimo = p.contactos.at(-1);
  const porQue = `${CASO_TXT[p.caso]} el ${fechaCorta(p.ultimaCita?.fecha ?? p.fechaEvento)}${
    anuladoPorClinica(p) ? ' (la anuló la clínica: ofrézcale disculpas)' : p.ultimaCita?.estado ? ` (${p.ultimaCita.estado.toLowerCase()})` : ''
  }`;
  const consecuencia =
    resultado === 'agendo'
      ? 'Quedará como recuperado en los indicadores.'
      : resultado === 'no_interesa'
        ? `Sale de la lista y no se le vuelve a escribir (${NO_CONTACTAR_TXT[noContactar].toLowerCase()}).`
        : resultado === 'sin_whatsapp'
          ? 'Queda marcado para corregir el número; no entra a campañas hasta corregirlo.'
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
          <Insignias p={p} detalle hoy={hoy} />
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
        {bloqueo && (
          <p className="rounded-2xl border border-rojo/40 bg-rojo/10 p-4 text-sm">
            <b>No contactar: {bloqueo}.</b> La clínica pidió no volver a escribirle. Solo continúe si el paciente le escribió primero.
          </p>
        )}
        {(numeroRaro || whatsappFallido) && (
          <p className="flex items-start gap-2 rounded-2xl border border-amarillo/40 bg-amarillo/10 p-4 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amarillo" aria-hidden />
            <span>
              <b>Revise el número antes de escribir.</b>{' '}
              {whatsappFallido
                ? 'Un recordatorio de WhatsApp a este número ya falló: puede estar mal escrito o inactivo.'
                : 'No tiene forma de celular válido.'}{' '}
              Confírmelo con una llamada{p.apoderado ? ` o con ${p.apoderado} (apoderado)` : ''} y corríjalo en la ficha.
            </span>
          </p>
        )}

        {!p.telefono && (
          <div className="rounded-2xl border border-amarillo/40 bg-amarillo/10 p-4">
            <p className="text-sm font-semibold">Falta el celular</p>
            <p className="mt-0.5 text-xs text-muted">
              {p.apoderado ? `Escríbale a ${p.apoderado} (apoderado/familiar), ` : 'Si ya tiene un chat abierto con la clínica, '}
              use «Copiar y abrir WhatsApp Web». O agregue el número para la próxima vez{p.email ? '; también puede enviarlo por correo' : ''}.
            </p>
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
            {sugeridos.map((g) => (
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
              value={sugeridos.some((g) => g.id === elegido.id) ? '' : elegido.id}
              onChange={(e) => e.target.value && setGuionId(e.target.value)}
              className="rounded-full border border-dashed border-line bg-transparent px-3 py-1.5 text-xs font-semibold text-ink/70 hover:text-ink"
              aria-label="Otro guion oficial"
            >
              <option value="">Otro guion…</option>
              {[...new Set(TODOS_GUIONES.map((g) => g.categoria))].map((cat) => (
                <optgroup key={cat} label={cat}>
                  {TODOS_GUIONES.filter((g) => g.categoria === cat).map((g) => (
                    <option key={g.n} value={String(g.n)}>
                      {g.n < 100 ? `#${g.n} · ` : ''}{g.situacion}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="ml-auto inline-flex rounded-full bg-soft p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="Idioma">
              {(['es', 'en'] as const).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={idioma === t}
                  onClick={() => {
                    setIdioma(t);
                    setGuionId('');
                  }}
                  className={`rounded-full px-2.5 py-1 ${idioma === t ? 'bg-white shadow-sm' : 'text-ink/60'}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <div className={`inline-flex rounded-full bg-soft p-0.5 text-[11px] font-semibold ${idioma === 'en' ? 'hidden' : ''}`} role="radiogroup" aria-label="Trato">
              {(['usted', 'tu'] as const).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={tono === t}
                  onClick={() => setTono(t)}
                  title={t === 'tu' ? 'Si el paciente le escribe de «tú»' : 'Trato por defecto de la clínica'}
                  className={`rounded-full px-2.5 py-1 ${tono === t ? 'bg-white shadow-sm' : 'text-ink/60'}`}
                >
                  {t === 'usted' ? 'Usted' : 'Tú'}
                </button>
              ))}
            </div>
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
            {(!p.telefono || whatsappFallido || chat) && (
              <button onClick={copiarYAbrir} className={btnBorde}>
                <Copy className="size-4" aria-hidden /> {copiado ? 'Copiado: péguelo en el chat' : 'Copiar y abrir WhatsApp Web'}
              </button>
            )}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Respuesta del paciente">
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
            <div className="hoja mt-4 space-y-4">
              {resultado !== 'agendo' && resultado !== 'sin_whatsapp' && (
                <Chips
                  titulo="¿Por qué no siguió?"
                  opciones={(Object.keys(MOTIVO_TXT) as Motivo[]).filter((m) => m !== 'sin_dato').map((m) => [m, MOTIVO_TXT[m]])}
                  valor={motivo}
                  onCambio={(m) => setMotivo(m === motivo ? 'sin_dato' : (m as Motivo))}
                />
              )}
              {resultado === 'no_interesa' && (
                <Chips titulo="No volver a contactar porque…" opciones={NO_CONTACTAR.map((m) => [m, NO_CONTACTAR_TXT[m]])} valor={noContactar} onCambio={(v) => setNoContactar(v as MotivoNoContactar)} />
              )}
              {resultado !== 'no_interesa' && resultado !== 'sin_whatsapp' && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={adelantar} onChange={(e) => setAdelantar(e.target.checked)} className="size-4 accent-ink" />
                  Quiere adelantar su cita si se libera un cupo
                </label>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={chat} onChange={(e) => setChat(e.target.checked)} className="size-4 accent-ink" />
                  Ya tiene chat de WhatsApp con la clínica
                </label>
                <span className="flex items-center gap-2">
                  <span className="text-muted">¿Autoriza WhatsApp?</span>
                  {([
                    [true, 'Sí'],
                    [false, 'No'],
                    [null, 'Sin preguntar'],
                  ] as const).map(([v, t]) => (
                    <button
                      key={t}
                      onClick={() => setAutoriza(v)}
                      aria-pressed={autoriza === v}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${autoriza === v ? 'bg-ink text-white' : 'bg-soft text-ink/70'}`}
                    >
                      {t}
                    </button>
                  ))}
                  <button onClick={copiarAutorizacion} className="text-xs font-semibold text-ink/70 underline hover:text-ink" title="Mensaje de autorización (Ley 1581 de 2012)">
                    Copiar formato
                  </button>
                </span>
              </div>
              <label className="block text-xs font-medium text-muted">
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
        <button disabled={!resultado} onClick={() => resultado && onGuardar(p, resultado, texto, motivo, notaFinal(), resultado === 'no_interesa' ? noContactar : undefined)} className={`${btnNegro} shrink-0`}>
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

// respuestas de un toque (motivos frecuentes): más rápido que un desplegable mientras se atiende el chat
function Chips({ titulo, opciones, valor, onCambio }: { titulo: string; opciones: [string, string][]; valor: string; onCambio: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={titulo}>
      <p className="mb-1.5 text-xs font-medium text-muted">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map(([k, t]) => (
          <button
            key={k}
            role="radio"
            aria-checked={valor === k}
            onClick={() => onCambio(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${valor === k ? 'bg-ink text-white' : 'bg-soft text-ink/70 hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
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
