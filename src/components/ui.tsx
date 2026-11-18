import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Estado, Paciente } from '../types';
import { ESTADO_TXT, SEGMENTO_TXT, altoValor, type Semaforo } from '../lib/reglas';
import { ROLES, type Rol } from '../lib/roles';

export const SEMAFORO_TXT: Record<Semaforo, string> = {
  rojo: 'Urgente',
  amarillo: 'Seguimiento',
  verde: 'Primer contacto',
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

export function EtiquetaSegmento({ p }: { p: Paciente }) {
  if (p.segmento === 'local') return altoValor(p) ? <Etiqueta tono="iris">Alto valor</Etiqueta> : null;
  return <Etiqueta tono="iris">{SEGMENTO_TXT[p.segmento]}</Etiqueta>;
}

export function EtiquetaEstado({ estado }: { estado: Estado }) {
  const tono = estado === 'recuperado' ? 'ok' : estado === 'descartado' ? 'mal' : estado === 'pendiente' ? 'oscuro' : 'claro';
  return <Etiqueta tono={tono}>{ESTADO_TXT[estado]}</Etiqueta>;
}

export function Iniciales({ nombre, claro = false, grande = false }: { nombre: string; claro?: boolean; grande?: boolean }) {
  const ini = nombre
    .split(' ')
    .filter(Boolean)
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
