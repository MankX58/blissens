import { useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarClock, FileSpreadsheet, Megaphone, Menu, Sparkles, Users } from 'lucide-react';
import type { Campana, ConfigWA, Datos, Hueco, Motivo, Paciente, Pantalla, Resultado } from './types';
import { cargarDatosIniciales, datosDesdeCarga, datosVacios } from './data/inicial';
import { hoyISO, nuevoCiclo, pasoActual, registrarContacto, tocaHoy } from './lib/reglas';
import { apiConectada, enviarPorAPI, siguientePaso } from './lib/campanas';
import { ROLES, type Rol } from './lib/roles';
import type { Carga } from './lib/excel';
import { Contactar } from './components/Contactar';
import { Sonrisa } from './components/ui';
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

// Primera vez: lee los 4 Excel reales de la clínica desde /public/datos
export default function App() {
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
  if (inicial) return <Panel inicial={inicial} />;
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-white">
      <div>
        <Sonrisa size={44} className="mx-auto" />
        <p className="wordmark mt-5 text-sm">BLISSENS</p>
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
      </div>
    </div>
  );
}

interface Aviso {
  texto: string;
  exito?: boolean;
  deshacer?: () => void;
}

function Panel({ inicial }: { inicial: Datos }) {
  const [datos, setDatos] = useState(inicial);
  const { pacientes, huecos, campanas, config } = datos;
  const hoy = datos.fechaCorte; // fecha de trabajo (por defecto, el cierre de la agenda cargada)
  const [pantalla, setPantalla] = useState<Pantalla>('hoy');
  const [expediente, setExpediente] = useState<string | null>(null);
  const [contactando, setContactando] = useState<Paciente | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [menu, setMenu] = useState(false);

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
    setMenu(false);
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
        setPantalla('hoy');
      })
      .catch((e: Error) => setAviso({ texto: e.message }));
  };

  const abrirExpediente = (id: string) => {
    setExpediente(id);
    setPantalla('pacientes');
  };

  // ---------- navegación agrupada por rol ----------
  const enviando = campanas.find((c) => c.estado === 'enviando');
  const grupos: { rol: Rol; items: { id: Pantalla; t: string; icono: typeof Users; n?: number }[] }[] = [
    {
      rol: 'auxiliar',
      items: [
        { id: 'hoy', t: 'Hoy toca contactar', icono: Sparkles, n: pacientes.filter((p) => tocaHoy(p, hoy)).length },
        { id: 'pacientes', t: 'Pacientes', icono: Users },
        { id: 'cargar', t: 'Cargar agenda', icono: FileSpreadsheet },
      ],
    },
    { rol: 'recepcion', items: [{ id: 'agenda', t: 'Agenda libre', icono: CalendarClock, n: huecos.filter((h) => h.fecha >= hoy && !h.ocupadoPor).length }] },
    { rol: 'mercadeo', items: [{ id: 'campanas', t: 'Campañas', icono: Megaphone }] },
    { rol: 'direccion', items: [{ id: 'indicadores', t: 'Indicadores', icono: BarChart3 }] },
  ];

  const barra = (
    <div className="flex h-full flex-col bg-ink text-white">
      <button onClick={() => setPantalla('hoy')} className="flex items-center gap-3 px-6 pb-6 pt-7" aria-label="Inicio">
        <Sonrisa />
        <span className="text-left leading-none">
          <span className="wordmark block text-[15px]">BLISSENS</span>
          <span className="mt-1 block text-[11px] text-white/45">Recuperación de pacientes</span>
        </span>
      </button>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Secciones">
        {grupos.map((g) => (
          <div key={g.rol}>
            <p className="flex items-center gap-2 px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[.16em] text-white/40">
              <span className="size-1.5 rounded-full" style={{ background: ROLES[g.rol].color }} />
              {ROLES[g.rol].nombre}
            </p>
            {g.items.map((x) => {
              const activo = pantalla === x.id;
              return (
                <button
                  key={x.id}
                  onClick={() => {
                    setPantalla(x.id);
                    if (x.id === 'pacientes') setExpediente(null);
                  }}
                  aria-current={activo ? 'page' : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-medium ${
                    activo ? 'bg-white text-ink' : 'text-white/65 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <x.icono className={`size-[18px] ${activo ? '' : 'text-white/45 group-hover:text-white/80'}`} />
                  <span className="flex-1 text-left">{x.t}</span>
                  {!!x.n && <span className={`num rounded-full px-2 py-px text-[11px] font-bold ${activo ? 'iris' : 'bg-white/12'}`}>{x.n}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-white/10 px-6 py-5 text-xs">
        {enviando && (
          <button onClick={() => setPantalla('campanas')} className="flex w-full items-center gap-2 text-left text-white/80">
            <span className="latido size-2 shrink-0 rounded-full bg-lilac" />
            <span className="truncate">
              Enviando “{enviando.nombre}” · {enviando.envios.filter((e) => e.estado !== 'pendiente').length}/{enviando.envios.length}
            </span>
          </button>
        )}
        <p className="flex items-center gap-2 text-white/50">
          <span className={`size-2 rounded-full ${apiConectada(config) ? 'bg-mint' : 'bg-white/30'}`} />
          WhatsApp: {apiConectada(config) ? 'API conectada' : 'modo simulación'}
        </p>
        <label className="block text-white/50">
          Fecha de trabajo
          <span className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={hoy}
              onChange={(e) => e.target.value && setDatos((d) => ({ ...d, fechaCorte: e.target.value }))}
              className="w-full rounded-lg bg-white/10 px-2 py-1 text-white [color-scheme:dark]"
            />
            <button onClick={() => setDatos((d) => ({ ...d, fechaCorte: hoyISO() }))} className="shrink-0 text-white/40 hover:text-white" title="Usar la fecha de hoy">
              Hoy
            </button>
          </span>
        </label>
        <label className="block text-white/50">
          Asesora que firma los guiones
          <input value={datos.asesora} onChange={(e) => setDatos((d) => ({ ...d, asesora: e.target.value }))} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1 text-white" />
        </label>
        <p className="text-white/35">El Tesoro · Torre Médica 2 · Cons. 1157</p>
        <button onClick={restaurar} className="text-white/35 underline-offset-2 hover:text-white/70 hover:underline">
          Volver a leer los Excel de la clínica
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">{barra}</aside>

      {/* barra superior en móvil */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <button onClick={() => setPantalla('hoy')} className="flex items-center gap-2.5">
          <Sonrisa size={24} />
          <span className="wordmark text-[13px]">BLISSENS</span>
        </button>
        <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="grid size-9 place-items-center rounded-full bg-white/10">
          <Menu className="size-5" />
        </button>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fondo absolute inset-0 bg-ink/50" onClick={() => setMenu(false)} />
          <div className="cajon absolute inset-y-0 left-0 w-[280px] max-w-[85vw]">{barra}</div>
        </div>
      )}

      <main className="lg:pl-[264px]">
        <div key={pantalla + (expediente ?? '')} className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
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

      {aviso && (
        <div
          role="status"
          className="hoja fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-sm text-white shadow-2xl lg:left-[calc(50%+132px)]"
        >
          <span className={`size-2.5 shrink-0 rounded-full ${aviso.exito ? 'iris latido' : 'bg-white/40'}`} />
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
  );
}
