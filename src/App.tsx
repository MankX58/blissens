import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BarChart3, CalendarClock, FileSpreadsheet, House, Megaphone, Sparkles, UserCog, Users } from 'lucide-react';
import type { Campana, Datos, Hueco, Motivo, MotivoNoContactar, Paciente, Pantalla, Profesional, Resultado } from './types';
import { ESPECIALISTAS, NO_CONTACTAR_TXT, enHorarioClinica, hoyISO, prefijoNoContactar, tocaHoy } from './lib/reglas';
import { siguientePaso } from './lib/campanas';
import { puedeVer, type Rol } from './lib/roles';
import { authClient, esRol } from './lib/auth';
import { ErrorApi, api } from './lib/api';
import { Contactar } from './components/Contactar';
import { Sonrisa, Vacio } from './components/ui';
import { Ajustes, Navegacion, type Item } from './components/Navegacion';
import { Login } from './screens/Login';
import { Cuentas } from './screens/Cuentas';
import { Hoy } from './screens/Hoy';
import { Cargar } from './screens/Cargar';
import { Agenda } from './screens/Agenda';
import { Campanas } from './screens/Campanas';
import { Pacientes } from './screens/Pacientes';
import { Indicadores } from './screens/Indicadores';
import { Inicio } from './screens/Inicio';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  profesional?: Profesional; // solo especialistas: su agenda
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
  const prof = (sesion.user as { profesional?: string | null }).profesional;
  const profesional = ESPECIALISTAS.find((e) => e === prof);
  if (!esRol(role))
    return (
      <Pantallazo>
        <p className="mt-4 max-w-sm text-sm text-white/70">Tu cuenta ({email}) no tiene un rol del panel. Pídele a gerencia que te asigne uno.</p>
        <button onClick={() => authClient.signOut()} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink">
          Cerrar sesión
        </button>
      </Pantallazo>
    );
  return <ConDatos usuario={{ id, nombre: name, email, rol: role, profesional }} />;
}

// Los datos vienen del backend (/api/v1/panel), ya recortados según el rol de la sesión
function ConDatos({ usuario }: { usuario: Usuario }) {
  const [inicial, setInicial] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const cargar = () => {
    setError('');
    api
      .panel()
      .then(setInicial)
      .catch((e: Error) => {
        if (e instanceof ErrorApi && e.status === 401) authClient.signOut();
        else setError(e.message);
      });
  };
  useEffect(cargar, []);
  if (inicial) return <Panel inicial={inicial} usuario={usuario} />;
  return (
    <Pantallazo>
      {error ? (
        <>
          <p className="mt-4 max-w-sm text-sm text-white/70">No se pudieron cargar los datos de la clínica: {error}</p>
          <button onClick={cargar} className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink">
            Reintentar
          </button>
        </>
      ) : (
        <p className="mt-4 text-sm text-white/60">Cargando pacientes, agenda y campañas…</p>
      )}
    </Pantallazo>
  );
}

interface Aviso {
  texto: string;
  exito?: boolean;
  deshacer?: () => void;
}

// Modo demostración: nombres y contactos ocultos para mostrar el panel sin exponer pacientes reales
const anonimizar = (d: Datos): Datos => {
  const alias = new Map(d.pacientes.map((p, i) => [p.id, `Paciente ${String(i + 1).padStart(3, '0')}`]));
  return {
    ...d,
    // texto clínico fuera: el tratamiento queda como el tipo de cita y se borran comentarios, notas y mensajes
    pacientes: d.pacientes.map((p) => ({
      ...p,
      nombre: alias.get(p.id)!,
      telefono: p.telefono && '+57 300 000 0000',
      email: '',
      apoderado: '',
      ciudad: '',
      notas: [],
      tratamiento: p.ultimaCita?.tipo ?? 'Tratamiento',
      valorReferencia: undefined,
      contactos: p.contactos.map((c) => ({ ...c, mensaje: '', nota: undefined })),
      ciclos: p.ciclos.map((c) => ({ ...c, contactos: c.contactos.map((x) => ({ ...x, mensaje: '', nota: undefined })) })),
    })),
    citas: d.citas.map((c) => ({ ...c, comentario: undefined })),
    campanas: d.campanas.map((c) => ({ ...c, plantilla: c.plantilla, envios: c.envios.map((e) => ({ ...e, nombre: alias.get(e.pacienteId) ?? 'Paciente', telefono: '+57 300 000 0000', texto: e.texto.replace(/^(Hola|Hello),? [^.]+\./, '$1, {nombre}.') })) })),
  };
};
const leerDemo = () => {
  try {
    return localStorage.getItem('blissens-demo') === '1';
  } catch {
    return false;
  }
};

function Panel({ inicial, usuario }: { inicial: Datos; usuario: Usuario }) {
  const [real, setDatos] = useState(inicial);
  const [demo, setDemo] = useState(leerDemo);
  const datos = demo ? anonimizar(real) : real;
  const { pacientes, huecos, campanas } = datos;
  // números donde un recordatorio de WhatsApp ya falló (dato del software: «Notif. WhatsApp fallida»)
  const fallidos = new Set(datos.citas.filter((c) => c.estado === 'Notif. WhatsApp fallida').map((c) => `#${c.paciente}`));
  const hoy = datos.fechaCorte; // fecha de trabajo (la del backend; por defecto, el cierre de la agenda cargada)
  const inicio: Pantalla = 'inicio';
  const [pantalla, setPantalla] = useState<Pantalla>(inicio);
  // el backend ya recorta los datos por rol; este filtro solo es una segunda barrera en pantalla
  const vista: Datos =
    usuario.rol === 'especialista'
      ? { ...datos, pacientes: pacientes.filter((p) => p.especialista === usuario.profesional), huecos: huecos.filter((h) => h.especialista === usuario.profesional) }
      : datos;
  const [expediente, setExpediente] = useState<string | null>(null);
  const [contactando, setContactando] = useState<Paciente | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ajustes, setAjustes] = useState(false);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pantalla, expediente]);

  // ---------- acciones: cada una va al backend y aplica lo que él devuelve ----------
  const ref = useRef(real);
  ref.current = real;
  const ponerPaciente = (p: Paciente) =>
    setDatos((d) => ({ ...d, pacientes: d.pacientes.some((x) => x.id === p.id) ? d.pacientes.map((x) => (x.id === p.id ? p : x)) : [p, ...d.pacientes] }));
  const ponerHueco = (h: Hueco) => setDatos((d) => ({ ...d, huecos: d.huecos.some((x) => x.id === h.id) ? d.huecos.map((x) => (x.id === h.id ? h : x)) : [...d.huecos, h] }));
  const ponerCampana = (c: Campana) =>
    setDatos((d) => ({ ...d, campanas: d.campanas.some((x) => x.id === c.id) ? d.campanas.map((x) => (x.id === c.id ? c : x)) : [c, ...d.campanas] }));
  const nombre = (id?: string) => pacientes.find((p) => p.id === id)?.nombre.split(' ')[0] ?? 'Paciente';
  const recargar = () => api.panel(demo).then(setDatos);

  // envuelve una llamada: si falla, avisa con el mensaje del backend (la sesión vencida vuelve al login)
  const intentar = async <T,>(accion: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await accion();
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) authClient.signOut();
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo guardar el cambio' });
    }
  };
  // tras tocar un cupo, el paciente también cambia (recuperado, vuelve al 3-7-15…)
  const refrescarPaciente = (id?: string) => id && puedeVer(usuario.rol, 'pacientes') && intentar(() => api.expediente(id).then(ponerPaciente));

  // ---------- motor de campañas: el backend envía un mensaje cada "ritmo" segundos mientras el panel esté abierto ----------
  const ocupado = useRef(false);
  useEffect(() => {
    if (!puedeVer(usuario.rol, 'campanas')) return;
    const t = setInterval(async () => {
      if (ocupado.current) return;
      // sin API (WhatsApp Web) el envío lo hace recepción a mano; con API, solo en horario para poder atender respuestas
      if (!enHorarioClinica()) return;
      const c = ref.current.campanas.find((x) => x.canal === 'api' && siguientePaso(x, Date.now()).tipo !== 'nada');
      if (!c) return;
      ocupado.current = true;
      try {
        ponerCampana(await api.enviarSiguiente(c.id));
      } catch (e) {
        setAviso({ texto: `Campaña “${c.nombre}”: ${e instanceof Error ? e.message : 'error al enviar'}` });
        ponerCampana({ ...c, estado: 'pausada' }); // no reintenta en bucle
      } finally {
        ocupado.current = false;
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const guardarContacto = async (p: Paciente, r: Resultado, mensaje: string, motivo: Motivo, nota: string, nc?: MotivoNoContactar) => {
    let act = await intentar(() => api.contactar(p.id, { resultado: r, mensaje, motivo, nota: nota || undefined }));
    if (!act) return;
    // el motivo tipificado de NO contactar (si el backend ya tiene el endpoint; si no, quedó en la nota)
    if (nc) act = (await api.noContactar(p.id, nc, '').catch(() => undefined)) ?? act;
    ponerPaciente(act);
    setContactando(null);
    setAviso({ texto: r === 'agendo' ? `${nombre(p.id)} recuperado` : `Contacto con ${nombre(p.id)} guardado`, exito: r === 'agendo' });
  };

  // Nueva carga de los Excel: el ETL del backend conserva lo trabajado (contactos, notas, procesos, cupos)
  const subirExcel = async (archivos: Parameters<typeof api.subirExcel>[0]) => {
    const r = await intentar(() => api.subirExcel(archivos));
    if (!r) return false;
    await intentar(recargar);
    setAviso({ texto: `Agenda cargada: ${r.total_pacientes} pacientes y ${r.total_citas} citas. Se conservó lo trabajado.`, exito: true });
    setPantalla(inicio);
    return true;
  };

  const cambiarTelefono = async (id: string, telefono: string) => {
    const act = await intentar(() => api.actualizar(id, { celular: telefono }));
    if (!act) return;
    ponerPaciente(act);
    setContactando((c) => (c && c.id === id ? act : c));
    setAviso({ texto: 'Celular guardado' });
  };

  // RF-10: viaje del Dr. Olarte → el paciente pasa a la agenda de la Dra. Sara
  const reasignar = async (id: string) => {
    const ok = await intentar(async () => {
      await api.actualizar(id, { profesional_principal: 'Dra. Sara López' });
      await api.nota(id, 'Reasignado del Dr. Juan Manuel Olarte a la Dra. Sara López por viaje del doctor.');
      return api.expediente(id);
    });
    if (!ok) return;
    ponerPaciente(ok);
    setContactando((c) => (c && c.id === id ? ok : c));
    setAviso({ texto: 'Paciente reasignado a la Dra. Sara López' });
  };

  const revertirHueco = async (huecoId: string, silencioso = false) => {
    const paciente = ref.current.huecos.find((x) => x.id === huecoId)?.ocupadoPor;
    const h = await intentar(() => api.revertir(huecoId));
    if (!h) return;
    ponerHueco(h);
    await refrescarPaciente(paciente);
    if (!silencioso) setAviso({ texto: `Asignación revertida: ${nombre(paciente)} vuelve a seguimiento` });
  };

  const asignarHueco = async (huecoId: string, pacienteId: string) => {
    const h = await intentar(() => api.asignar(huecoId, pacienteId));
    if (!h) return;
    ponerHueco(h);
    await refrescarPaciente(pacienteId);
    setAviso({ texto: `${nombre(pacienteId)} agendado el ${h.hora}`, exito: true, deshacer: () => revertirHueco(huecoId, true) });
  };

  const marcarAsistencia = async (huecoId: string, a: 'asistio' | 'no_asistio') => {
    const h = await intentar(() => api.asistencia(huecoId, a));
    if (!h) return;
    ponerHueco(h);
    await refrescarPaciente(h.ocupadoPor);
    setAviso({ texto: a === 'asistio' ? 'Asistencia registrada' : 'Inasistencia registrada: vuelve a la regla 3-7-15' });
  };

  const ofrecerHueco = async (huecoId: string, pacienteId: string) => {
    const h = await intentar(() => api.ofrecer(huecoId, pacienteId));
    if (h) ponerHueco(h);
  };

  const rechazarOferta = async (huecoId: string, pacienteId: string) => {
    const h = await intentar(() => api.rechazar(huecoId, pacienteId));
    if (h) ponerHueco(h);
  };

  const confirmarHueco = async (huecoId: string) => {
    const h = await intentar(() => api.confirmar(huecoId));
    if (!h) return;
    ponerHueco(h);
    setAviso({ texto: 'Cita confirmada', exito: true });
  };

  // relee los Excel desde la carpeta configurada en el backend (RUTA_DATOS_EXCEL); lo trabajado se conserva
  const restaurar = async () => {
    if (!confirm('Se volverán a leer los 4 Excel de la clínica desde la carpeta del servidor. Lo trabajado (contactos, notas, cupos) se conserva. ¿Continuar?')) return;
    const r = await intentar(() => api.recargarExcel());
    if (!r) return;
    await intentar(recargar);
    setAviso({ texto: `Excel releídos: ${r.total_pacientes} pacientes`, exito: true });
    setPantalla(inicio);
  };

  const configurar = async (cambios: { asesora?: string; fecha_corte?: string }) => {
    setDatos((d) => ({ ...d, ...(cambios.asesora !== undefined && { asesora: cambios.asesora }), ...(cambios.fecha_corte && { fechaCorte: cambios.fecha_corte }) }));
    await intentar(() => api.configurar(cambios));
  };

  // solo abre expedientes quien puede ver pacientes (campañas no ve expedientes clínicos)
  const abrirExpediente = (id: string) => {
    if (!puedeVer(usuario.rol, 'pacientes')) return;
    setExpediente(id);
    setPantalla('pacientes');
  };

  // ---------- navegación: solo las secciones del rol ----------
  const enviando = campanas.find((c) => c.estado === 'enviando');
  const esp = usuario.rol === 'especialista';
  const items = (
    [
      { id: 'inicio', t: 'Inicio', corto: 'Inicio', icono: House },
      { id: 'hoy', t: 'Hoy toca contactar', corto: 'Hoy', icono: Sparkles, grupo: 'Operación', n: pacientes.filter((p) => tocaHoy(p, hoy)).length, nTxt: 'por contactar' },
      { id: 'pacientes', t: esp ? 'Mis pacientes' : 'Pacientes', corto: 'Pacientes', icono: Users, grupo: 'Operación' },
      { id: 'agenda', t: esp ? 'Mi agenda libre' : 'Agenda libre', corto: 'Agenda', icono: CalendarClock, grupo: 'Operación', n: vista.huecos.filter((h) => h.fecha >= hoy && !h.ocupadoPor).length, nTxt: 'cupos libres' },
      { id: 'campanas', t: 'Campañas', corto: 'Campañas', icono: Megaphone, grupo: 'Operación' },
      { id: 'cargar', t: 'Cargar agenda', corto: 'Cargar', icono: FileSpreadsheet, grupo: 'Operación' },
      { id: 'indicadores', t: 'Indicadores', corto: 'Indicadores', icono: BarChart3, grupo: 'Gestión' },
      { id: 'cuentas', t: 'Equipo', corto: 'Equipo', icono: UserCog, grupo: 'Gestión' },
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
        whatsapp={datos.whatsapp.conectado}
        onFecha={(f) => configurar({ fecha_corte: f })}
        onAsesora={(a) => configurar({ asesora: a })}
        onRestaurar={puedeVer(usuario.rol, 'cargar') ? restaurar : undefined}
        demo={demo}
        onDemo={(v: boolean) => {
          setDemo(v);
          intentar(() => api.panel(v).then(setDatos));
          setDemo(v);
          try {
            localStorage.setItem('blissens-demo', v ? '1' : '0');
          } catch {
            /* sin almacenamiento: dura hasta recargar */
          }
        }}
      />

      <main id="contenido" ref={principal} tabIndex={-1} aria-label={items.find((x) => x.id === pantalla)?.t} className="pb-24 outline-none lg:pb-0 lg:pl-[264px]">
        <div key={pantalla + (expediente ?? '')} className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-12">
          {!puedeVer(usuario.rol, pantalla) && <Vacio titulo="Esta sección no es de tu rol" texto="Vuelve a tu inicio para ver tus responsabilidades." />}
          {pantalla === 'inicio' && <Inicio datos={vista} hoy={hoy} usuario={usuario} onIr={ir} onAbrir={abrirExpediente} />}
          {pantalla === 'hoy' && puedeVer(usuario.rol, 'hoy') && (
            <Hoy pacientes={pacientes} hoy={hoy} onContactar={setContactando} onIrCargar={() => setPantalla('cargar')} onAbrir={abrirExpediente} />
          )}
          {pantalla === 'pacientes' && puedeVer(usuario.rol, 'pacientes') && (
            <Pacientes
              datos={vista}
              hoy={hoy}
              abierto={expediente}
              onAbrir={setExpediente}
              onContactar={setContactando}
              soloLectura={esp}
              onNota={async (id, texto) => {
                if (await intentar(() => api.nota(id, texto)) !== undefined) await refrescarPaciente(id);
              }}
              onReactivar={async (id) => {
                const act = await intentar(() => api.reactivar(id));
                if (act) (ponerPaciente(act), setAviso({ texto: 'Paciente reactivado: empieza un nuevo 3-7-15 hoy' }));
              }}
              onDescartar={async (id, motivo) => {
                const act = await intentar(() => api.noContactar(id, motivo, `${prefijoNoContactar}${NO_CONTACTAR_TXT[motivo]}.`));
                if (act) (ponerPaciente(act), setAviso({ texto: `No se volverá a contactar: ${NO_CONTACTAR_TXT[motivo].toLowerCase()}` }));
              }}
              onCrear={async (nuevo) => {
                const p = await intentar(() => api.crearPaciente(nuevo));
                if (!p) return;
                ponerPaciente(p);
                setExpediente(p.id);
                setAviso({ texto: `${p.nombre} agregado al seguimiento`, exito: true });
              }}
            />
          )}
          {pantalla === 'cargar' && puedeVer(usuario.rol, 'cargar') && <Cargar onSubir={subirExcel} gerencia={usuario.rol === 'direccion'} onFuente={recargar} />}
          {pantalla === 'agenda' && puedeVer(usuario.rol, 'agenda') && (
            <Agenda
              pacientes={vista.pacientes}
              huecos={vista.huecos}
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
              soloLectura={esp}
              sinHora={datos.agendaSinHora}
              sinHorario={datos.sinHorario}
              agendaSinCitas={datos.agendaSinCitas}
              cubiertaHasta={datos.agendaCubiertaHasta}
              onRecargar={recargar}
              ultimaCarga={datos.ultimaCarga}
              onIrCargar={puedeVer(usuario.rol, 'cargar') ? () => setPantalla('cargar') : undefined}
              ocupados={datos.cuposOcupados}
              cargaAutomatica={datos.cargaAutomatica}
              fuenteAgenda={datos.fuenteAgenda}
              fuenteError={datos.fuenteError}
              onVerificar={async (ids, libre) => {
                if (!(await intentar(() => api.verificarCupos(ids, libre)))) return;
                await recargar(); // el backend recalcula: el cupo sale (o vuelve) de la agenda
                if (libre === false)
                  setAviso({ texto: 'Marcado como ocupado: ya no se ofrecerá', deshacer: () => intentar(() => api.verificarCupos(ids, null)).then(recargar) });
                else if (libre === null) setAviso({ texto: 'De vuelta en la agenda libre', exito: true });
              }}
              onIrHorarios={puedeVer(usuario.rol, 'cuentas') ? () => setPantalla('cuentas') : undefined}
              onAgregar={async (h: Hueco) => {
                const nuevo = await intentar(() => api.crearCupo(h));
                if (nuevo) ponerHueco(nuevo);
              }}
              onBorrar={async (id) => {
                if ((await intentar(() => api.borrarCupo(id).then(() => true))) === undefined) return;
                setDatos((d) => ({ ...d, huecos: d.huecos.filter((h) => h.id !== id) }));
                setAviso({ texto: 'Cupo eliminado' });
              }}
            />
          )}
          {pantalla === 'campanas' && puedeVer(usuario.rol, 'campanas') && (
            <Campanas
              pacientes={pacientes}
              campanas={campanas}
              whatsapp={datos.whatsapp}
              onCrear={async (nueva) => {
                const c = await intentar(() => api.crearCampana(nueva));
                if (!c) return false;
                ponerCampana(c);
                setAviso({ texto: `Campaña “${c.nombre}” lista para enviarse`, exito: true });
                return true;
              }}
              onAccion={async (id, accion) => {
                const c = await intentar(() => api.accionCampana(id, accion));
                if (c) ponerCampana(c);
              }}
              hoy={hoy}
              onEnviarManual={async (id: string, envio: string) => {
                const c = await intentar(() => api.marcarEnviadoWeb(id, envio));
                if (c) ponerCampana(c);
              }}
              onRespuesta={async (id, envio, respondio) => {
                const c = await intentar(() => api.respuesta(id, envio, respondio));
                if (c) ponerCampana(c);
              }}
              onBorrar={async (id) => {
                if ((await intentar(() => api.borrarCampana(id).then(() => true))) === undefined) return;
                setDatos((d) => ({ ...d, campanas: d.campanas.filter((c) => c.id !== id) }));
              }}
              onAbrir={puedeVer(usuario.rol, 'pacientes') ? abrirExpediente : undefined}
            />
          )}
          {pantalla === 'indicadores' && puedeVer(usuario.rol, 'indicadores') && <Indicadores datos={datos} hoy={hoy} />}
          {pantalla === 'cuentas' && puedeVer(usuario.rol, 'cuentas') && <Cuentas yo={usuario.id} hoy={hoy} onAviso={(texto) => setAviso({ texto })} onEquipo={recargar} />}
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
        whatsappFallido={!!contactando && fallidos.has(contactando.idPaciente)}
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
