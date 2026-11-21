import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, LogOut, Menu, Settings, X, type LucideIcon } from 'lucide-react';
import type { Pantalla } from '../types';
import { ROLES, ROL_DE, type Rol } from '../lib/roles';
import { fechaCorta } from '../lib/reglas';
import { authClient } from '../lib/auth';
import { Iniciales, Modal, Sonrisa, btnBorde } from './ui';

export interface Item {
  id: Pantalla;
  t: string;
  corto: string; // etiqueta en la barra inferior del móvil
  icono: LucideIcon;
  rol: Rol; // grupo del menú
  n?: number;
  nTxt?: string; // qué cuenta el número, para lectores de pantalla
}

interface Props {
  items: Item[];
  pantalla: Pantalla;
  onIr: (p: Pantalla) => void;
  usuario: { nombre: string; email: string; rol: Rol };
  hoy: string;
  enviando?: { nombre: string; hechos: number; total: number };
  onAjustes: () => void;
}

// Escritorio: menú lateral fijo. Móvil: barra superior con la sección actual + barra inferior con las secciones del rol.
export function Navegacion(props: Props) {
  const { items, pantalla, onIr, usuario } = props;
  const [cajon, setCajon] = useState(false);
  const actual = items.find((x) => x.id === pantalla);

  // barra inferior: hasta 4 secciones de uso diario, primero las propias del rol, en el orden del menú; el resto queda en "Menú"
  const diarias = items.filter((x) => x.id !== 'cargar' && x.id !== 'cuentas');
  const propia = (x: Item) => ROL_DE[x.id].includes(usuario.rol);
  const elegidas = [...diarias.filter(propia), ...diarias.filter((x) => !propia(x))].slice(0, 4);
  const abajo = items.filter((x) => elegidas.includes(x));

  const ir = (p: Pantalla) => {
    setCajon(false);
    onIr(p);
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block" aria-label="Menú principal">
        <Barra {...props} onIr={ir} />
      </aside>

      {/* móvil: arriba la sección actual, abajo las secciones */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-ink px-4 text-white lg:hidden">
        <Sonrisa size={26} />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{actual?.t ?? 'Blissens'}</p>
        <button onClick={props.onAjustes} aria-label="Ajustes" className="grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
          <Settings className="size-5" />
        </button>
      </header>

      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink pb-[env(safe-area-inset-bottom)] text-white lg:hidden">
        <ul className="flex">
          {abajo.map((x) => (
            <li key={x.id} className="flex-1">
              <BotonAbajo activo={pantalla === x.id} onClick={() => ir(x.id)} icono={x.icono} texto={x.corto} n={x.n} nTxt={x.nTxt} />
            </li>
          ))}
          <li className="flex-1">
            <BotonAbajo activo={cajon} onClick={() => setCajon(true)} icono={Menu} texto="Menú" aria-haspopup="dialog" />
          </li>
        </ul>
      </nav>

      {cajon && <Cajon onCerrar={() => setCajon(false)}>{<Barra {...props} onIr={ir} onCerrar={() => setCajon(false)} />}</Cajon>}
    </>
  );
}

function Barra({ items, pantalla, onIr, usuario, hoy, enviando, onAjustes, onCerrar }: Props & { onCerrar?: () => void }) {
  const grupos = (Object.keys(ROLES) as Rol[]).map((rol) => ({ rol, items: items.filter((x) => x.rol === rol) })).filter((g) => g.items.length);
  const conTitulos = grupos.length > 1; // con un solo rol los títulos de grupo sobran

  return (
    <div className="flex h-full flex-col bg-ink text-white">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <button onClick={() => onIr(items[0].id)} className="flex items-center gap-3 rounded-xl" aria-label="Ir al inicio">
          <Sonrisa />
          <span className="text-left leading-none">
            <span className="wordmark block text-[15px]">BLISSENS</span>
            <span className="mt-1.5 block text-[11.5px] text-white/60">Recuperación de pacientes</span>
          </span>
        </button>
        {onCerrar && (
          <button onClick={onCerrar} aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-full text-white/80 hover:bg-white/10">
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Secciones">
        {grupos.map((g) => (
          <div key={g.rol} role="group" aria-labelledby={conTitulos ? `grupo-${g.rol}` : undefined} className="mb-5 last:mb-0">
            {conTitulos && (
              <p id={`grupo-${g.rol}`} className="flex items-center gap-2 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-white/60">
                <span className="size-1.5 rounded-full" style={{ background: ROLES[g.rol].color }} aria-hidden />
                {ROLES[g.rol].nombre}
              </p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((x) => {
                const activo = pantalla === x.id;
                return (
                  <li key={x.id}>
                    <button
                      onClick={() => onIr(x.id)}
                      aria-current={activo ? 'page' : undefined}
                      className={`group flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-[14px] font-medium ${
                        activo ? 'bg-white text-ink shadow-[0_8px_24px_-12px_rgb(196_181_253/.6)]' : 'text-white/75 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <x.icono className={`size-[18px] shrink-0 ${activo ? '' : 'text-white/60 group-hover:text-white'}`} aria-hidden />
                      <span className="flex-1 text-left">{x.t}</span>
                      {!!x.n && <Contador n={x.n} txt={x.nTxt} activo={activo} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-4">
        {enviando && (
          <button onClick={() => onIr('campanas')} className="flex w-full items-center gap-2.5 rounded-2xl bg-white/6 px-3 py-2.5 text-left text-xs text-white/85 hover:bg-white/10">
            <span className="latido size-2 shrink-0 rounded-full bg-lilac" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Enviando “{enviando.nombre}”
            </span>
            <span className="num shrink-0 text-white/60">
              {enviando.hechos}/{enviando.total}
            </span>
          </button>
        )}

        <button onClick={onAjustes} className="group flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-[13px] text-white/75 hover:bg-white/8 hover:text-white">
          <CalendarDays className="size-[18px] shrink-0 text-white/60 group-hover:text-white" aria-hidden />
          <span className="flex-1">
            Fecha de trabajo <b className="num font-semibold text-white">{fechaCorta(hoy)}</b>
          </span>
          <Settings className="size-4 shrink-0 text-white/60 group-hover:text-white" aria-hidden />
          <span className="sr-only">: abrir ajustes</span>
        </button>

        <div className="flex items-center gap-2.5 rounded-2xl bg-white/6 p-2.5">
          <Iniciales nombre={usuario.nombre || usuario.email} claro />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold" title={usuario.email}>
              {usuario.nombre}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5 text-[11.5px] text-white/65">
              <span className="size-1.5 shrink-0 -translate-y-px rounded-full" style={{ background: ROLES[usuario.rol].color }} aria-hidden />
              {ROLES[usuario.rol].nombre}
            </p>
          </div>
          <button onClick={() => authClient.signOut()} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Contador({ n, txt, activo }: { n: number; txt?: string; activo: boolean }) {
  return (
    <span className={`num rounded-full px-2 py-px text-[11px] font-bold ${activo ? 'iris text-ink' : 'bg-white/14 text-white'}`}>
      {n}
      {txt && <span className="sr-only"> {txt}</span>}
    </span>
  );
}

function BotonAbajo({ activo, onClick, icono: Icono, texto, n, nTxt, ...rest }: { activo: boolean; onClick: () => void; icono: LucideIcon; texto: string; n?: number; nTxt?: string; 'aria-haspopup'?: 'dialog' }) {
  return (
    <button onClick={onClick} aria-current={activo ? 'page' : undefined} {...rest} className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${activo ? 'text-white' : 'text-white/65'}`}>
      <span className={`grid h-7 w-12 place-items-center rounded-full ${activo ? 'bg-white text-ink' : ''}`}>
        <Icono className="size-[19px]" aria-hidden />
      </span>
      {texto}
      {!!n && (
        <span className="num absolute left-1/2 top-1.5 ml-2 rounded-full bg-pink px-1.5 text-[10px] font-bold leading-4 text-ink">
          {n > 99 ? '99+' : n}
          {nTxt && <span className="sr-only"> {nTxt}</span>}
        </span>
      )}
    </button>
  );
}

// cajón lateral del móvil: cierra con Escape o tocando fuera y devuelve el foco
function Cajon({ onCerrar, children }: { onCerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    (caja.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? caja.current?.querySelector<HTMLElement>('button'))?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
      antes?.focus();
    };
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menú">
      <div className="fondo absolute inset-0 bg-ink/60" onClick={onCerrar} />
      <div ref={caja} className="cajon absolute inset-y-0 left-0 w-[300px] max-w-[88vw] shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// Ajustes del panel: lo que antes ocupaba el pie del menú
export function Ajustes({
  abierto,
  onCerrar,
  hoy,
  hoyReal,
  asesora,
  usuario,
  whatsapp,
  onFecha,
  onAsesora,
  onRestaurar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  hoy: string;
  hoyReal: string;
  asesora: string;
  usuario: { nombre: string; email: string; rol: Rol };
  whatsapp: boolean;
  onFecha: (f: string) => void;
  onAsesora: (a: string) => void;
  onRestaurar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Ajustes" ancho="max-w-md">
      <div className="space-y-6 p-6 sm:p-8">
        <h2 className="text-xl font-bold">Ajustes</h2>

        <label className="block">
          <span className="text-sm font-semibold">Fecha de trabajo</span>
          <span className="mt-0.5 block text-xs text-muted">Con esta fecha se calcula a quién toca contactar. Por defecto, el cierre de la agenda cargada.</span>
          <span className="mt-2 flex gap-2">
            <input type="date" value={hoy} onChange={(e) => e.target.value && onFecha(e.target.value)} className="field" />
            <button type="button" onClick={() => onFecha(hoyReal)} disabled={hoy === hoyReal} className={`${btnBorde} shrink-0 px-4`}>
              Usar hoy
            </button>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Asesora que firma los guiones</span>
          <span className="mt-0.5 block text-xs text-muted">Reemplaza [ASESOR/A] en los mensajes.</span>
          <input value={asesora} onChange={(e) => onAsesora(e.target.value)} className="field mt-2" />
        </label>

        <p className="text-sm">
          <span className={`mr-2 inline-block size-2 rounded-full ${whatsapp ? 'bg-verde' : 'bg-ink/30'}`} aria-hidden />
          WhatsApp: <b className="font-semibold">{whatsapp ? 'API conectada' : 'modo simulación'}</b>
          <span className="block pl-4 text-xs text-muted">Se configura en Campañas.</span>
        </p>

        <div className="rounded-2xl bg-soft p-4">
          <p className="text-sm font-semibold">Volver a leer los Excel de la clínica</p>
          <p className="mt-0.5 text-xs text-muted">Borra lo registrado en este navegador y carga de nuevo los 4 archivos.</p>
          <button
            onClick={() => {
              onCerrar();
              onRestaurar();
            }}
            className={`${btnBorde} mt-3`}
          >
            Volver a leer
          </button>
        </div>

        <p className="border-t border-line pt-4 text-xs text-muted">
          Sesión de <b className="font-semibold text-ink">{usuario.nombre}</b> ({usuario.email}) · {ROLES[usuario.rol].nombre}
        </p>
      </div>
    </Modal>
  );
}
