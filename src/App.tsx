import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BarChart3, CalendarClock, FileSpreadsheet, Megaphone, Sparkles, UserCog, Users } from 'lucide-react';
import type { Campana, ConfigWA, Datos, Hueco, Motivo, Paciente, Pantalla, Resultado } from './types';
import { cargarDatosIniciales, datosDesdeCarga, datosVacios } from './data/inicial';
import { hoyISO, nuevoCiclo, pasoActual, registrarContacto, tocaHoy } from './lib/reglas';
import { apiConectada, enviarPorAPI, siguientePaso } from './lib/campanas';
import { puedeVer, type Rol } from './lib/roles';
import { authClient, esRol } from './lib/auth';
import type { Carga } from './lib/excel';
import { Contactar } from './components/Contactar';
import { Sonrisa } from './components/ui';
import { Ajustes, Navegacion, type Item } from './components/Navegacion';
import { Login } from './screens/Login';
import { Cuentas } from './screens/Cuentas';
import { Hoy } from './screens/Hoy';
import { Cargar } from './screens/Cargar';
import { Agenda } from './screens/Agenda';
import { Campanas } from './screens/Campanas';
import { Pacientes } from './screens/Pacientes';
import { Indicadores } from './screens/Indicadores';

const CLAVE = 'blissens-panel-v6';

function cargarGuardado(): Datos | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? '');
    if (Array.isArray(g.pacientes) && Array.isArray(g.citas) && Array.isArray(g.campanas) && g.fechaCorte) return g;
  } catch {
    /* sin datos guardados */
  }
  return null;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

const Pantallazo = ({ children }: { children: ReactNode }) => (
  <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-white">
    <div>
      <Sonrisa size={44} className="mx-auto" />
      <p className="wordmark mt-5 text-sm">BLISSENS</p>
      {children}
    </div>
  </div>
);

// Sin sesión: login. Con sesión: el panel con lo que le toca a su rol.
export default function App() {
  const { data: sesion, isPending } = authClient.useSession();
  if (isPending) return <Pantallazo><p className="mt-4 text-sm text-white/60">Verificando tu sesión…</p></Pantallazo>;
  if (!sesion) return <Login />;
  const { id, name, email, role } = sesion.user;
  if (!esRol(role))
    return (
      <Pantallazo>
        <p className="mt-4 max-w-sm text-sm text-white/70">Tu cuenta ({email}) no tiene un rol del panel. Pídele a dirección que te asigne uno.</p>
        <button onClick={() => authClient.signOut()} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink">
          Cerrar sesión
        </button>
      </Pantallazo>
    );
  return <ConDatos usuario={{ id, nombre: name, email, rol: role }} />;
}

// Primera vez: lee los 4 Excel reales de la clínica desde /public/datos
function ConDatos({ usuario }: { usuario: Usuario }) {
  const [inicial, setInicial] = useState<Datos | null>(cargarGuardado);
  const [error, setError] = useState('');
  const cargar = () => {
    setError('');
    cargarDatosIniciales()
      .then(setInicial)
      .catch((e: Error) => setError(e.message));
  };
  useEffect(() => {
    if (!inicial) cargar();
  }, []);
  if (inicial) return <Panel inicial={inicial} usuario={usuario} />;
  return (
    <Pantallazo>
        {error ? (
          <>
            <p className="mt-4 text-sm text-white/70">No se pudieron leer los archivos de la clínica: {error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={cargar} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink">
                Reintentar
              </button>
              <button onClick={() => setInicial(datosVacios(hoyISO()))} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">
                Subir los Excel a mano
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-white/60">Leyendo la agenda, el arancel y los guiones…</p>
        )}
    </Pantallazo>
  );
}

interface Aviso {
  texto: string;
  exito?: boolean;
  deshacer?: () => void;
}

// primera pantalla del menú que puede ver cada rol
const INICIO: Record<Rol, Pantalla> = { auxiliar: 'hoy', recepcion: 'agenda', mercadeo: 'campanas', direccion: 'hoy' };

function Panel({ inicial, usuario }: { inicial: Datos; usuario: Usuario }) {
  const [datos, setDatos] = useState(inicial);
  const { pacientes, huecos, campanas, config } = datos;
  const hoy = datos.fechaCorte; // fecha de trabajo (por defecto, el cierre de la agenda cargada)
  const inicio = INICIO[usuario.rol];
  const [pantalla, setPantalla] = useState<Pantalla>(inicio);
  const [expediente, setExpediente] = useState<string | null>(null);
  const [contactando, setContactando] = useState<Paciente | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ajustes, setAjustes] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, [datos]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pantalla, expediente]);

  // ---------- acciones ----------
  const ref = useRef(datos);
  ref.current = datos;
  const cambiarPacientes = (fn: (ps: Paciente[]) => Paciente[]) => setDatos((d) => ({ ...d, pacientes: fn(d.pacientes) }));
  const cambiarPaciente = (id: string, fn: (p: Paciente) => Paciente) => cambiarPacientes((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));
  const actualizarCampana = (id: string, fn: (c: Campana) => Campana) =>
    setDatos((d) => ({ ...d, campanas: d.campanas.map((c) => (c.id === id ? fn(c) : c)) }));

  // ---------- motor de campañas: un mensaje cada "ritmo" segundos mientras el panel esté abierto ----------
  const ocupado = useRef(false);
  useEffect(() => {
    const t = setInterval(async () => {
      if (ocupado.current) return;
      const ahora = Date.now();
      for (const c of ref.current.campanas) {
        const paso = siguientePaso(c, ahora);
        if (paso.tipo === 'nada') continue;
        if (paso.tipo === 'completar') {
          actualizarCampana(c.id, (x) => ({ ...x, estado: 'completada' }));
          return;
        }
        ocupado.current = true;
        const e = c.envios[paso.idx];
        let estado: 'enviado' | 'fallo' = 'enviado';
        let error: string | undefined;
        try {
          if (c.canal === 'api') await enviarPorAPI(ref.current.config, e.telefono, e.texto, e.nombre);
        } catch (err) {
          estado = 'fallo';
          error = err instanceof Error ? err.message : 'Error desconocido';
        }
        ocupado.current = false;
        actualizarCampana(c.id, (x) =>
          x.estado === 'cancelada' || x.estado === 'pausada'
            ? x
            : { ...x, estado: 'enviando', envios: x.envios.map((y, i) => (i === paso.idx ? { ...y, estado, error, fecha: new Date().toISOString() } : y)) }
        );
        return;
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // deshacer solo restaura pacientes y agenda; las campañas siguen su curso
  const conDeshacer = (texto: string, cambio: (d: Datos) => Datos, exito = false) => {
    const antes = ref.current;
    setDatos(cambio);
    setAviso({ texto, exito, deshacer: () => setDatos((d) => ({ ...d, pacientes: antes.pacientes, huecos: antes.huecos })) });
  };

  const guardarContacto = (p: Paciente, r: Resultado, mensaje: string, motivo: Motivo, nota: string) => {
    const act = registrarContacto(p, r, mensaje, motivo, hoy, nota || undefined);
    conDeshacer(
      r === 'agendo' ? `${p.nombre.split(' ')[0]} recuperado` : `Contacto con ${p.nombre.split(' ')[0]} guardado`,
      (d) => ({ ...d, pacientes: d.pacientes.map((x) => (x.id === p.id ? act : x)) }),
      r === 'agendo'
    );
    setContactando(null);
  };

  // Nueva carga del Excel: se conserva lo trabajado (contactos, notas, procesos) cruzando por # Paciente
  const agregarDeExcel = (c: Carga) => {
    const previos = new Map(pacientes.map((p) => [p.idPaciente, p]));
    let actualizados = 0;
    const lista = c.pacientes.map((n): Paciente => {
      const v = previos.get(n.idPaciente);
      if (!v) return n;
      actualizados++;
      const base = { ...n, notas: v.notas, ciclos: v.ciclos, telefono: n.telefono || v.telefono, especialista: v.especialista };
      if (v.caso === n.caso && v.fechaEvento === n.fechaEvento)
        return { ...base, contactos: v.contactos, estado: v.estado === 'activo' ? n.estado : v.estado, motivo: v.motivo, recuperadoEl: v.recuperadoEl };
      return v.contactos.length ? { ...base, ciclos: [...v.ciclos, { caso: v.caso, fechaEvento: v.fechaEvento, contactos: v.contactos, cierre: v.estado, motivo: v.motivo }] } : base;
    });
    const manuales = pacientes.filter((p) => p.origen === 'manual' && !lista.some((n) => n.idPaciente === p.idPaciente));
    const nuevo = datosDesdeCarga(c, datos);
    conDeshacer(`Agenda cargada: ${c.pacientes.length} pacientes (${actualizados} ya estaban), corte ${c.fechaCorte}`, () => ({
      ...nuevo,
      pacientes: [...manuales, ...lista],
    }));
    setPantalla('hoy');
  };

  const cambiarTelefono = (id: string, telefono: string) => {
    cambiarPaciente(id, (p) => ({ ...p, telefono, segmento: telefono.startsWith('+57') ? p.segmento : 'internacional' }));
    setContactando((c) => (c && c.id === id ? { ...c, telefono } : c));
    setAviso({ texto: 'Celular guardado' });
  };

  // RF-10: viaje del Dr. Olarte → el paciente pasa a la agenda de la Dra. Sara
  const reasignar = (id: string) => {
    conDeshacer('Paciente reasignado a la Dra. Sara López', (d) => ({
      ...d,
      pacientes: d.pacientes.map((p) =>
        p.id === id
          ? { ...p, especialista: 'Dra. Sara López', notas: [...p.notas, { fecha: hoy, texto: 'Reasignado del Dr. Juan Manuel Olarte a la Dra. Sara López por viaje del doctor.' }] }
          : p
      ),
    }));
    setContactando((c) => (c && c.id === id ? { ...c, especialista: 'Dra. Sara López' } : c));
  };

  const asignarHueco = (huecoId: string, pacienteId: string) => {
    const p = pacientes.find((x) => x.id === pacienteId)!;
    const h = huecos.find((x) => x.id === huecoId)!;
    conDeshacer(
      `${p.nombre.split(' ')[0]} agendado el ${h.hora}`,
      (d) => ({
        ...d,
        huecos: d.huecos.map((x) => (x.id === huecoId ? { ...x, ocupadoPor: pacienteId, asignadoEl: hoy, estadoPrevio: p.estado } : x)),
        pacientes: d.pacientes.map((x) =>
          x.id === pacienteId
            ? {
                ...x,
                estado: 'recuperado',
                recuperadoEl: hoy,
                contactos: [
                  ...x.contactos,
                  { fecha: hoy, paso: pasoActual(x, hoy) ?? 15, resultado: 'agendo', mensaje: `(asignado a la agenda libre ${h.fecha} ${h.hora})`, huecoId },
                ],
              }
            : x
        ),
      }),
      true
    );
  };

  const revertirHueco = (huecoId: string) => {
    const h = huecos.find((x) => x.id === huecoId)!;
    const p = pacientes.find((x) => x.id === h.ocupadoPor);
    conDeshacer(`Asignación revertida${p ? `: ${p.nombre.split(' ')[0]} vuelve a seguimiento` : ''}`, (d) => ({
      ...d,
      huecos: d.huecos.map((x) => (x.id === huecoId ? { ...x, ocupadoPor: undefined, asignadoEl: undefined, estadoPrevio: undefined, asistencia: undefined, confirmadoEl: undefined, ofertas: x.ofertas.filter((o) => o.pacienteId !== x.ocupadoPor) } : x)),
      pacientes: d.pacientes.map((x) =>
        x.id === h.ocupadoPor
          ? { ...x, estado: h.estadoPrevio ?? 'pendiente', recuperadoEl: undefined, contactos: x.contactos.filter((c) => c.huecoId !== huecoId) }
          : x
      ),
    }));
  };

  const marcarAsistencia = (huecoId: string, a: 'asistio' | 'no_asistio') => {
    const h = huecos.find((x) => x.id === huecoId)!;
    conDeshacer(a === 'asistio' ? 'Asistencia registrada' : 'Inasistencia registrada: vuelve a la regla 3-7-15', (d) => ({
      ...d,
      huecos: d.huecos.map((x) => (x.id === huecoId ? { ...x, asistencia: a } : x)),
      pacientes: a === 'no_asistio' ? d.pacientes.map((x) => (x.id === h.ocupadoPor ? nuevoCiclo(x, 'no_asistio', h.fecha) : x)) : d.pacientes,
    }));
  };

  const ofrecerHueco = (huecoId: string, pacienteId: string) =>
    setDatos((d) => ({
      ...d,
      huecos: d.huecos.map((x) =>
        x.id === huecoId && !x.ofertas.some((o) => o.pacienteId === pacienteId) ? { ...x, ofertas: [...x.ofertas, { pacienteId, fecha: hoy }] } : x
      ),
    }));

  const rechazarOferta = (huecoId: string, pacienteId: string) =>
    setDatos((d) => ({
      ...d,
      huecos: d.huecos.map((x) => (x.id === huecoId ? { ...x, ofertas: x.ofertas.map((o) => (o.pacienteId === pacienteId ? { ...o, rechazo: true } : o)) } : x)),
    }));

  const confirmarHueco = (huecoId: string) => {
    setDatos((d) => ({ ...d, huecos: d.huecos.map((x) => (x.id === huecoId ? { ...x, confirmadoEl: hoy } : x)) }));
    setAviso({ texto: 'Cita confirmada', exito: true });
  };

  const restaurar = () => {
    if (!confirm('Se borrará lo registrado en el panel y se volverán a leer los 4 Excel de la clínica. ¿Continuar?')) return;
    cargarDatosIniciales()
      .then((d) => {
        setDatos(d);
        setPantalla(inicio);
      })
      .catch((e: Error) => setAviso({ texto: e.message }));
  };

  const abrirExpediente = (id: string) => {
    setExpediente(id);
    setPantalla('pacientes');
  };

  // ---------- navegación: solo las secciones del rol ----------
  const enviando = campanas.find((c) => c.estado === 'enviando');
  const items = (
    [
      { id: 'hoy', t: 'Hoy toca contactar', corto: 'Hoy', icono: Sparkles, rol: 'auxiliar', n: pacientes.filter((p) => tocaHoy(p, hoy)).length, nTxt: 'por contactar' },
      { id: 'pacientes', t: 'Pacientes', corto: 'Pacientes', icono: Users, rol: 'auxiliar' },
      { id: 'cargar', t: 'Cargar agenda', corto: 'Cargar', icono: FileSpreadsheet, rol: 'auxiliar' },
      { id: 'agenda', t: 'Agenda libre', corto: 'Agenda', icono: CalendarClock, rol: 'recepcion', n: huecos.filter((h) => h.fecha >= hoy && !h.ocupadoPor).length, nTxt: 'cupos libres' },
      { id: 'campanas', t: 'Campañas', corto: 'Campañas', icono: Megaphone, rol: 'mercadeo' },
      { id: 'indicadores', t: 'Indicadores', corto: 'Indicadores', icono: BarChart3, rol: 'direccion' },
      { id: 'cuentas', t: 'Cuentas', corto: 'Cuentas', icono: UserCog, rol: 'direccion' },
    ] as Item[]
  ).filter((x) => puedeVer(usuario.rol, x.id));
  const ir = (p: Pantalla) => {
    setPantalla(p);
    if (p === 'pacientes') setExpediente(null);
  };

  // al cambiar de sección: título de la pestaña y foco al contenido (lectores de pantalla y teclado)
  const principal = useRef<HTMLElement>(null);
  const primera = useRef(true);
  useEffect(() => {
    document.title = `${items.find((x) => x.id === pantalla)?.t ?? 'Panel'} · Blissens`;
    if (primera.current) primera.current = false;
    else principal.current?.focus({ preventScroll: true });
  }, [pantalla, expediente]);

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only z-[60] rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar al contenido
      </a>
      <Navegacion
        items={items}
        pantalla={pantalla}
        onIr={ir}
        usuario={usuario}
        hoy={hoy}
        enviando={enviando && { nombre: enviando.nombre, hechos: enviando.envios.filter((e) => e.estado !== 'pendiente').length, total: enviando.envios.length }}
        onAjustes={() => setAjustes(true)}
      />
      <Ajustes
        abierto={ajustes}
        onCerrar={() => setAjustes(false)}
        hoy={hoy}
        hoyReal={hoyISO()}
        asesora={datos.asesora}
        usuario={usuario}
        whatsapp={apiConectada(config)}
        onFecha={(f) => setDatos((d) => ({ ...d, fechaCorte: f }))}
        onAsesora={(a) => setDatos((d) => ({ ...d, asesora: a }))}
        onRestaurar={restaurar}
      />

      <main id="contenido" ref={principal} tabIndex={-1} aria-label={items.find((x) => x.id === pantalla)?.t} className="pb-24 outline-none lg:pb-0 lg:pl-[264px]">
        <div key={pantalla + (expediente ?? '')} className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-12">
          {pantalla === 'hoy' && (
            <Hoy pacientes={pacientes} hoy={hoy} onContactar={setContactando} onIrCargar={() => setPantalla('cargar')} onAbrir={abrirExpediente} />
          )}
          {pantalla === 'pacientes' && (
            <Pacientes
              datos={datos}
              hoy={hoy}
              abierto={expediente}
              onAbrir={setExpediente}
              onContactar={setContactando}
              onNota={(id, texto) => cambiarPaciente(id, (p) => ({ ...p, notas: [...p.notas, { fecha: hoy, texto }] }))}
              onReactivar={(id) =>
                conDeshacer('Paciente reactivado: empieza un nuevo 3-7-15 hoy', (d) => ({
                  ...d,
                  pacientes: d.pacientes.map((p) => (p.id === id ? nuevoCiclo(p, p.caso, hoy) : p)),
                }))
              }
              onDescartar={(id) =>
                conDeshacer('Paciente sacado del seguimiento', (d) => ({
                  ...d,
                  pacientes: d.pacientes.map((p) => (p.id === id ? { ...p, estado: 'descartado' } : p)),
                }))
              }
              onCrear={(p) => {
                cambiarPacientes((ps) => [p, ...ps]);
                setExpediente(p.id);
                setAviso({ texto: `${p.nombre} agregado al seguimiento`, exito: true });
              }}
            />
          )}
          {pantalla === "cargar" && <Cargar onAgregar={agregarDeExcel} />}
          {pantalla === 'agenda' && (
            <Agenda
              pacientes={pacientes}
              huecos={huecos}
              hoy={hoy}
              onAsignar={asignarHueco}
              onRevertir={revertirHueco}
              onOfrecer={ofrecerHueco}
              onRechazar={rechazarOferta}
              onConfirmar={confirmarHueco}
              onAsistencia={marcarAsistencia}
              asesora={datos.asesora}
              onReasignar={reasignar}
              onAbrir={abrirExpediente}
              onAgregar={(h: Hueco) => setDatos((d) => ({ ...d, huecos: [...d.huecos, h] }))}
              onBorrar={(id) => conDeshacer('Cupo eliminado', (d) => ({ ...d, huecos: d.huecos.filter((h) => h.id !== id) }))}
            />
          )}
          {pantalla === 'campanas' && (
            <Campanas
              pacientes={pacientes}
              campanas={campanas}
              config={config}
              onCrear={(c) => {
                setDatos((d) => ({ ...d, campanas: [c, ...d.campanas] }));
                setAviso({ texto: `Campaña “${c.nombre}” lista para enviarse`, exito: true });
              }}
              onActualizar={actualizarCampana}
              onBorrar={(id) => setDatos((d) => ({ ...d, campanas: d.campanas.filter((c) => c.id !== id) }))}
              onConfig={(c: ConfigWA) => setDatos((d) => ({ ...d, config: c }))}
              onAbrir={abrirExpediente}
            />
          )}
          {pantalla === 'indicadores' && <Indicadores datos={datos} hoy={hoy} />}
          {pantalla === 'cuentas' && puedeVer(usuario.rol, 'cuentas') && <Cuentas yo={usuario.id} onAviso={(texto) => setAviso({ texto })} />}
        </div>
      </main>

      <Contactar
        paciente={contactando}
        hoy={hoy}
        asesora={datos.asesora}
        onCerrar={() => setContactando(null)}
        onGuardar={guardarContacto}
        onTelefono={cambiarTelefono}
        onReasignar={reasignar}
      />

      {/* región viva siempre montada: los lectores de pantalla anuncian cada aviso */}
      <div role="status" aria-live="polite">
      {aviso && (
        <div
          className="hoja fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-sm text-white shadow-2xl lg:bottom-5 lg:left-[calc(50%+132px)]"
        >
          <span className={`size-2.5 shrink-0 rounded-full ${aviso.exito ? 'iris latido' : 'bg-white/40'}`} aria-hidden />
          <span className="truncate">{aviso.texto}</span>
          {aviso.deshacer && (
            <button
              onClick={() => {
                aviso.deshacer!();
                setAviso(null);
              }}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"
            >
              Deshacer
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
