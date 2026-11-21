import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Estado, Paciente } from '../types';
import { ESTADO_TXT, SEGMENTO_TXT, altoValor, fechaCorta, riesgoAlto, type Semaforo } from '../lib/reglas';
import { ROLES, type Rol } from '../lib/roles';

export const SEMAFORO_TXT: Record<Semaforo, string> = {
  rojo: 'Urgente',
  amarillo: 'Seguimiento',
  verde: 'Rescate',
};
const SEMAFORO_BG: Record<Semaforo, string> = { rojo: 'bg-rojo', amarillo: 'bg-amarillo', verde: 'bg-verde' };

export function Punto({ color, className = '' }: { color: Semaforo; className?: string }) {
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${SEMAFORO_BG[color]} ${className}`} aria-hidden />;
}

export function Etiqueta({ children, tono = 'claro' }: { children: ReactNode; tono?: 'claro' | 'iris' | 'oscuro' | 'ok' | 'mal' }) {
  const t = {
    iris: 'iris text-ink',
    oscuro: 'bg-ink text-white',
    claro: 'bg-soft text-ink/75',
    ok: 'bg-verde/12 text-verde',
    mal: 'bg-rojo/10 text-rojo',
  }[tono];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t}`}>{children}</span>;
}

// ---------- insignias del paciente ----------
// Solo dos cosas se muestran como insignia: VIP (degradado) y riesgo alto. El resto va en la línea de datos (Meta).

const motivoVIP = (p: Paciente) => {
  const r = p.etiquetas.filter((e) => e !== 'VIP');
  return r.length ? `VIP por ${r.join(', ').toLowerCase()}` : 'VIP: plan de alto valor';
};

export const textoRiesgo = (p: Paciente) =>
  `${p.fallosSeguidos} ${p.fallosSeguidos === 1 ? 'cita seguida' : 'citas seguidas'} sin asistir desde ${p.ultimaAtendida ? `su última visita (${fechaCorta(p.ultimaAtendida)})` : 'que llegó (nunca ha asistido)'} · ${p.fallosHistoricos} en todo su historial`;

export function InsigniaVIP({ p }: { p: Paciente }) {
  if (p.segmento !== 'local')
    return (
      <span className="iris inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-ink" title={motivoVIP(p)}>
        {SEGMENTO_TXT[p.segmento]}
      </span>
    );
  if (!p.etiquetas.includes('VIP') && !altoValor(p)) return null;
  return (
    <span className="iris inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-ink" title={motivoVIP(p)}>
      VIP
    </span>
  );
}

// RN-06: 3+ citas seguidas sin asistir = doble confirmación 24 h antes
export function InsigniaRiesgo({ p, oscuro = false, detalle = false }: { p: Paciente; oscuro?: boolean; detalle?: boolean }) {
  if (!riesgoAlto(p) && !(detalle && p.nivelRiesgo === 'Medio')) return null;
  const alto = riesgoAlto(p);
  const cls = alto
    ? oscuro
      ? 'bg-rojo/25 text-[#ffb4b7] ring-1 ring-rojo/40'
      : 'bg-rojo/[.08] text-rojo ring-1 ring-rojo/25'
    : oscuro
      ? 'bg-white/10 text-white/75'
      : 'bg-amarillo/10 text-amarillo ring-1 ring-amarillo/25';
  return (
    <span className={`inline-flex cursor-help items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`} title={textoRiesgo(p)}>
      <span className={`size-1.5 rounded-full ${alto ? 'bg-rojo' : 'bg-amarillo'}`} />
      {alto ? 'Riesgo alto' : 'Riesgo medio'}
      {detalle && <span className="font-normal opacity-80">· {p.fallosSeguidos} seguidas</span>}
    </span>
  );
}

export function Insignias({ p, oscuro = false, detalle = false }: { p: Paciente; oscuro?: boolean; detalle?: boolean }) {
  return (
    <>
      <InsigniaVIP p={p} />
      <InsigniaRiesgo p={p} oscuro={oscuro} detalle={detalle} />
    </>
  );
}

// Línea de datos discreta: # paciente · nuevo/antiguo · etiquetas · doctor · aviso de celular
export function Meta({ p, doctor = true, oscuro = false, className = '' }: { p: Paciente; doctor?: boolean; oscuro?: boolean; className?: string }) {
  const partes = [p.idPaciente, p.antiguedad === 'Nuevo' ? 'Paciente nuevo' : 'Antiguo', ...p.etiquetas.filter((e) => e !== 'VIP'), doctor ? p.especialista : ''].filter(Boolean);
  return (
    <span className={`text-xs ${oscuro ? 'text-white/55' : 'text-muted'} ${className}`}>
      {partes.join(' · ')}
      {!p.telefono && <span className="font-semibold text-amarillo"> · Sin celular</span>}
    </span>
  );
}

// Qué cuenta como fallo (se abre al hacer clic, sin ventanas emergentes)
export function QueEsFallo({ className = '' }: { className?: string }) {
  return (
    <details className={`group text-xs ${className}`}>
      <summary className="cursor-pointer list-none font-semibold text-ink/70 underline decoration-dotted underline-offset-2 hover:text-ink">¿Qué cuenta como fallo?</summary>
      <div className="hoja mt-2 space-y-1.5 rounded-2xl bg-soft p-3 leading-relaxed text-ink/80">
        <p>
          <b>Fallo</b> es una cita que no se cumplió: <i>Cambio de fecha, Anulado, Anulado por WhatsApp, No asiste</i> o <i>No confirmado</i>.
        </p>
        <p>
          El <b>riesgo</b> se calcula con los fallos <b>seguidos desde la última vez que asistió</b>. Si un paciente falló, volvió y siguió viniendo, esos fallos
          viejos ya no suben su riesgo: quedan solo como historial.
        </p>
        <p>
          <b>Alto:</b> 3 o más seguidas sin asistir (doble confirmación 24 h antes). <b>Medio:</b> 1 o 2 seguidas, o reprograma mucho (3+ en total) aunque sí viene.
        </p>
      </div>
    </details>
  );
}

export function EtiquetaEstado({ estado }: { estado: Estado }) {
  const tono = estado === 'recuperado' || estado === 'activo' ? 'ok' : estado === 'descartado' ? 'mal' : estado === 'pendiente' ? 'oscuro' : 'claro';
  return <Etiqueta tono={tono}>{ESTADO_TXT[estado]}</Etiqueta>;
}

export function Iniciales({ nombre, claro = false, grande = false }: { nombre: string; claro?: boolean; grande?: boolean }) {
  const ini = nombre
    .split(' ')
    .filter((w) => w && !['de', 'del', 'la', 'los'].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${grande ? 'size-16 text-xl' : 'size-10 text-[13px]'} ${
        claro ? 'bg-white text-ink' : 'bg-ink text-white'
      }`}
    >
      {ini}
    </span>
  );
}

export function RolChip({ rol, oscuro = false }: { rol: Rol; oscuro?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        oscuro ? 'bg-white/8 text-white/80' : 'bg-white text-ink/75 ring-1 ring-line'
      }`}
    >
      <span className="size-2 rounded-full" style={{ background: ROLES[rol].color }} />
      {ROLES[rol].nombre}
    </span>
  );
}

// Encabezado común: a quién le sirve la sección, título y acciones
export function Encabezado({
  roles,
  titulo,
  descripcion,
  children,
}: {
  roles: Rol[];
  titulo: ReactNode;
  descripcion?: string;
  children?: ReactNode;
}) {
  return (
    <header className="entrar flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="kicker mr-1">Para</span>
          {roles.map((r) => (
            <RolChip key={r} rol={r} />
          ))}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-[44px] sm:leading-[1.05]">{titulo}</h1>
        {descripcion && <p className="mt-2 max-w-2xl text-[15px] text-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

// número que sube suavemente hasta su valor
export function Cifra({ valor, formato = (n: number) => Math.round(n).toLocaleString('es-CO') }: { valor: number; formato?: (n: number) => string }) {
  const [v, setV] = useState(valor);
  const desde = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(valor);
      return;
    }
    const inicio = desde.current;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 800);
      const x = inicio + (valor - inicio) * (1 - Math.pow(1 - k, 3));
      setV(x);
      desde.current = x;
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <span className="num">{formato(v)}</span>;
}

export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-3xl',
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-label={titulo}>
      <div className="fondo absolute inset-0 bg-ink/50 backdrop-blur-[3px]" onClick={onCerrar} />
      <div className={`hoja relative max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-t-[28px] bg-paper shadow-2xl sm:rounded-[28px]`}>
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-white text-ink/70 shadow-sm hover:rotate-90 hover:text-ink"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function Vacio({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="entrar rounded-[28px] border border-dashed border-line bg-card px-6 py-14 text-center">
      <Sonrisa className="mx-auto mb-4" oscuro />
      <p className="text-lg font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{texto}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Pestanas<T extends string>({ valor, opciones, onCambio }: { valor: T; opciones: [T, string][]; onCambio: (v: T) => void }) {
  return (
    <div className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-soft p-1">
      {opciones.map(([id, t]) => (
        <button
          key={id}
          onClick={() => onCambio(id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold ${valor === id ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// Logo: la carita sonriente de Blissens (parpadea cada tanto)
export function Sonrisa({ className = '', oscuro = false, size = 28 }: { className?: string; oscuro?: boolean; size?: number }) {
  const fondo = oscuro ? '#0b0b0c' : '#fff';
  const trazo = oscuro ? '#fff' : '#0b0b0c';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="16" cy="16" r="16" fill={fondo} />
      <rect className="ojo" x="10.5" y="8.5" width="2.6" height="7" rx="1.3" fill={trazo} />
      <rect className="ojo" x="18.9" y="8.5" width="2.6" height="7" rx="1.3" fill={trazo} />
      <path d="M8.5 18.5c1.6 3.4 4.4 5.2 7.5 5.2s5.9-1.8 7.5-5.2" stroke={trazo} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const btnNegro =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-2 hover:shadow-lg hover:shadow-ink/15 active:scale-[.98] disabled:opacity-40';
export const btnBorde =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-ink/12 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink/35 active:scale-[.98] disabled:opacity-40';
export const btnIris =
  'iris inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold text-ink hover:shadow-lg hover:shadow-lilac/40 active:scale-[.98] disabled:opacity-40';
export const btnChico = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold';
