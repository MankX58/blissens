import type { Datos, Hueco } from '../types';
import { leerArchivos, type Carga } from '../lib/excel';
import { sumarDias } from '../lib/reglas';

// Los 4 archivos reales de la clínica, servidos desde /public/datos
export const ARCHIVOS_INICIALES = [
  ['agenda-citas-estados.xlsx', 'Agenda citas y estados .xlsx'],
  ['agenda-citas-detalle.xlsx', 'Agenda y citas .xlsx'],
  ['arancel-precios.xlsx', 'Arancel precios.xlsx'],
  ['guiones.xlsx', 'Guiones_Blissens_.xlsx'],
] as const;

export const CONFIG_VACIA = { token: '', phoneId: '', plantilla: '', idioma: 'es' };

// Cupos de ejemplo para mostrar la agenda libre (la exportación no trae cupos futuros)
function espaciosEjemplo(corte: string): Hueco[] {
  return [
    { id: 'h1', fecha: sumarDias(corte, 1), hora: '09:00', minutos: 60, especialista: 'Dra. Sara López', ofertas: [] },
    { id: 'h2', fecha: sumarDias(corte, 1), hora: '14:00', minutos: 45, especialista: 'Dr. Juan Manuel Olarte', ofertas: [] },
    { id: 'h3', fecha: sumarDias(corte, 2), hora: '10:00', minutos: 60, especialista: 'Dra. Sara López', ofertas: [] },
    { id: 'h4', fecha: sumarDias(corte, 3), hora: '16:00', minutos: 60, especialista: 'Dra. Sara López', ofertas: [] },
  ];
}

export function datosDesdeCarga(c: Carga, anterior?: Datos): Datos {
  return {
    pacientes: c.pacientes,
    citas: c.citas,
    huecos: anterior?.huecos.length ? anterior.huecos : espaciosEjemplo(c.fechaCorte),
    campanas: anterior?.campanas ?? [],
    config: anterior?.config ?? CONFIG_VACIA,
    asesora: anterior?.asesora ?? 'Isabel Cristina',
    fechaCorte: c.fechaCorte,
    archivos: c.archivos.map((a) => a.nombre),
  };
}

// Panel vacío para empezar subiendo los Excel desde "Cargar agenda"
export const datosVacios = (fecha: string): Datos => ({ pacientes: [], citas: [], huecos: [], campanas: [], config: CONFIG_VACIA, asesora: 'Isabel Cristina', fechaCorte: fecha, archivos: [] });

export async function cargarDatosIniciales(): Promise<Datos> {
  const files = await Promise.all(
    ARCHIVOS_INICIALES.map(async ([archivo, nombre]) => {
      const r = await fetch(`${import.meta.env.BASE_URL}datos/${archivo}`);
      // sin el archivo, el servidor de desarrollo devuelve la página HTML con código 200
      if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`no está ${nombre} en public/datos`);
      return { nombre, buffer: await r.arrayBuffer() };
    })
  );
  return datosDesdeCarga(await leerArchivos(files));
}
