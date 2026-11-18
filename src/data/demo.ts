import type { Campana, Caso, Contacto, Datos, Estado, Hueco, Motivo, Paciente, Resultado, Segmento } from '../types';
import { PASOS, hoyISO, sumarDias } from '../lib/reglas';

const SARA = 'Dra. Sara López · Rehabilitación oral';
const JUANMA = 'Dr. Juan Manuel Olarte · Implantes';
const FELIPE = 'Dr. Felipe Giraldo · Periodoncia';
const CAMILA = 'Dra. Camila Restrepo · Ortodoncia';

type Fila = [
  nombre: string,
  telefono: string,
  ciudad: string,
  segmento: Segmento,
  caso: Caso,
  haceDias: number, // días desde el evento
  tratamiento: string,
  especialista: string,
  valor: number,
  motivo: Motivo,
  intentos: Resultado[], // contactos ya hechos, en orden
  estado?: Estado,
];

const FILAS: Fila[] = [
  // toca hoy
  ['Isabela Restrepo Gómez', '+57 314 682 1904', 'Medellín', 'local', 'diagnostico', 15, 'Diseño de sonrisa con carillas', SARA, 12_800_000, 'costos', ['sin_respuesta', 'lo_pensara']],
  ['Marcus Vance', '+1 305 842 9910', 'Miami, USA', 'internacional', 'cancelo', 7, 'Implantes de carga inmediata', JUANMA, 24_500_000, 'viaje', ['sin_respuesta']],
  ['Juliana Vélez Montoya', '+57 301 554 3321', 'Medellín', 'deportista', 'limpieza', 3, 'Limpieza y mantenimiento', FELIPE, 480_000, 'agenda', []],
  ['Tomás Saldarriaga', '+57 311 720 4498', 'Envigado', 'local', 'no_asistio', 3, 'Alineadores etapa 3', CAMILA, 7_900_000, 'sin_dato', []],
  ['Sofía Arango Uribe', '+57 312 448 9021', 'Itagüí', 'local', 'cancelo', 8, 'Endodoncia molar', SARA, 1_350_000, 'miedo', ['sin_respuesta']],
  ['Daniel Ochoa', '+57 320 771 2290', 'Medellín · Atlético Nacional', 'deportista', 'diagnostico', 4, 'Rehabilitación con coronas', JUANMA, 9_600_000, 'sin_dato', []],
  ['Emily Carter', '+1 416 555 0182', 'Toronto, Canadá', 'internacional', 'diagnostico', 18, 'Rehabilitación oral completa', SARA, 38_000_000, 'costos', ['sin_respuesta', 'sin_respuesta']],
  ['Carlos Mario Zapata', '+57 304 210 5567', 'Bello', 'local', 'limpieza', 7, 'Control semestral', FELIPE, 320_000, 'sin_dato', ['sin_respuesta']],
  // próximos días
  ['Valentina Ríos', '+57 318 334 7781', 'Medellín', 'local', 'no_asistio', 1, 'Blanqueamiento', SARA, 1_200_000, 'agenda', []],
  ['Andrea Castaño', '+57 316 902 4410', 'Rionegro', 'local', 'diagnostico', 5, 'Implante unitario', JUANMA, 5_400_000, 'costos', ['lo_pensara']],
  ['Lucas Fernández', '+34 612 445 980', 'Madrid, España', 'internacional', 'cancelo', 2, 'Carillas de porcelana', SARA, 18_900_000, 'viaje', []],
  // resultados de días anteriores (alimentan indicadores)
  ['Mariana Henao', '+57 300 455 8812', 'Medellín', 'local', 'cancelo', 10, 'Corona en zirconio', SARA, 2_100_000, 'agenda', ['sin_respuesta', 'agendo'], 'recuperado'],
  ['Kevin Brooks', '+1 786 555 0144', 'Miami, USA', 'internacional', 'diagnostico', 12, 'Implantes All-on-4', JUANMA, 42_000_000, 'viaje', ['agendo'], 'recuperado'],
  ['Natalia Gil', '+57 311 680 3321', 'Medellín · Selección Ciclismo', 'deportista', 'no_asistio', 6, 'Ortodoncia', CAMILA, 6_800_000, 'agenda', ['agendo'], 'recuperado'],
  ['Jorge Iván Pérez', '+57 313 220 9087', 'La Estrella', 'local', 'limpieza', 9, 'Limpieza', FELIPE, 300_000, 'sin_dato', ['agendo'], 'recuperado'],
  ['Paula Duque', '+57 317 554 1290', 'Envigado', 'local', 'diagnostico', 20, 'Ortodoncia invisible', CAMILA, 11_500_000, 'costos', ['sin_respuesta', 'no_interesa'], 'descartado'],
  ['Ricardo Londoño', '+57 301 998 4402', 'Medellín', 'local', 'cancelo', 22, 'Prótesis parcial', SARA, 3_900_000, 'sin_dato', ['sin_respuesta', 'sin_respuesta', 'sin_respuesta'], 'agotado'],
  ['Sarah Mitchell', '+1 212 555 0199', 'New York, USA', 'internacional', 'diagnostico', 25, 'Diseño de sonrisa', SARA, 21_000_000, 'costos', ['sin_respuesta', 'lo_pensara', 'sin_respuesta'], 'agotado'],
];

export function pacientesDemo(): Paciente[] {
  const hoy = hoyISO();
  return FILAS.map((f, i) => {
    const [nombre, telefono, ciudad, segmento, caso, haceDias, tratamiento, especialista, valor, motivo, intentos, estado] = f;
    const fechaEvento = sumarDias(hoy, -haceDias);
    const contactos: Contacto[] = intentos.map((resultado, k) => ({
      fecha: sumarDias(fechaEvento, PASOS[k]),
      paso: PASOS[k],
      resultado,
      mensaje: '(mensaje enviado desde el panel)',
    }));
    const ultimo = contactos[contactos.length - 1];
    return {
      id: `demo-${i}`,
      nombre,
      telefono,
      ciudad,
      segmento,
      caso,
      fechaEvento,
      tratamiento,
      especialista,
      valor,
      motivo,
      estado: estado ?? 'pendiente',
      contactos,
      recuperadoEl: estado === 'recuperado' ? ultimo?.fecha : undefined,
      notas: [],
      ciclos: [],
      origen: 'demo',
      creadoEl: fechaEvento,
    };
  });
}

export function datosDemo(): Datos {
  const hoy = hoyISO();
  const pacientes = pacientesDemo();
  const por = (n: string) => pacientes.find((p) => p.nombre.startsWith(n))!;
  const iso = (dias: number, h = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  // Natalia y Mariana se recuperaron llenando espacios de la agenda abierta
  const natalia = por('Natalia');
  natalia.contactos.at(-1)!.huecoId = 'h4';
  const mariana = por('Mariana');
  mariana.contactos.at(-1)!.huecoId = 'h5';

  // historial más rico para el expediente
  const jorge = por('Jorge');
  jorge.ciclos = [
    {
      caso: 'limpieza',
      fechaEvento: sumarDias(hoy, -200),
      cierre: 'recuperado',
      motivo: 'sin_dato',
      contactos: [{ fecha: sumarDias(hoy, -197), paso: 3, resultado: 'agendo', mensaje: '(control semestral anterior)' }],
    },
  ];
  por('Isabela').notas = [
    { fecha: sumarDias(hoy, -8), texto: 'Pidió conocer opciones de pago por etapas antes de decidir.' },
  ];
  por('Emily').notas = [{ fecha: sumarDias(hoy, -10), texto: 'Viaja a Medellín en enero; prefiere videollamada antes.' }];

  const huecos: Hueco[] = [
    { id: 'h1', fecha: sumarDias(hoy, 1), hora: '09:00', minutos: 60, especialista: SARA, ofertas: [{ pacienteId: por('Emily').id, fecha: hoy }] },
    { id: 'h2', fecha: sumarDias(hoy, 1), hora: '15:30', minutos: 90, especialista: JUANMA, ofertas: [] },
    { id: 'h3', fecha: sumarDias(hoy, 3), hora: '11:00', minutos: 45, especialista: FELIPE, ofertas: [] },
    { id: 'h4', fecha: sumarDias(hoy, 2), hora: '08:00', minutos: 60, especialista: CAMILA, ofertas: [], ocupadoPor: natalia.id, asignadoEl: natalia.recuperadoEl, estadoPrevio: 'pendiente' },
    { id: 'h5', fecha: sumarDias(hoy, -2), hora: '16:00', minutos: 60, especialista: SARA, ofertas: [], ocupadoPor: mariana.id, asignadoEl: mariana.recuperadoEl, estadoPrevio: 'pendiente', asistencia: 'asistio' },
    { id: 'h6', fecha: sumarDias(hoy, -1), hora: '10:30', minutos: 45, especialista: FELIPE, ofertas: [] },
  ];

  const intl = pacientes.filter((p) => p.segmento === 'internacional');
  const campanas: Campana[] = [
    {
      id: 'c-demo',
      nombre: 'Internacionales · temporada de viajes',
      audiencia: 'Internacionales',
      plantilla: 'Hola {nombre}, si planeas viajar a Medellín, coordinamos tu {tratamiento} con hotel y transporte.',
      creadaEl: iso(-4, 9),
      inicio: iso(-4, 9),
      ritmoSeg: 15,
      canal: 'simulado',
      estado: 'completada',
      envios: intl.map((p, k) => ({
        pacienteId: p.id,
        nombre: p.nombre,
        telefono: p.telefono,
        texto: `Hola ${p.nombre.split(' ')[0]}, si planeas viajar a Medellín, coordinamos tu ${p.tratamiento.toLowerCase()} con hotel y transporte.`,
        estado: k === 1 ? 'respondio' : 'enviado',
        fecha: iso(-4, 9),
      })),
    },
  ];

  return { pacientes, huecos, campanas, config: { token: '', phoneId: '', plantilla: '', idioma: 'es' } };
}

export const ESPECIALISTAS = [SARA, JUANMA, FELIPE, CAMILA];
