// Comprobación rápida: npx tsx src/lib/reglas.check.ts
import assert from 'node:assert/strict';
import type { Campana, Paciente } from '../types';
import { diasDeRetraso, nivelRiesgo, fechaQueToca, normalizarCelular, nuevoCiclo, pasoActual, registrarContacto, semaforo, soloDigitos, sumarDias, tocaHoy } from './reglas';
import { leerFecha } from './excel';
import { siguientePaso } from './campanas';
import { rellenar, recomendados } from './guiones';

const hoy = '2026-11-12';
const base: Paciente = {
  id: 't', idPaciente: '#1', nombre: 'Ana María Test', telefono: '+573140000000', email: '', apoderado: '', ciudad: '',
  segmento: 'local', antiguedad: 'Antiguo', etiquetas: [], grupo: 1, fallosHistoricos: 1, fallosSeguidos: 1, nivelRiesgo: 'Medio',
  caso: 'cancelo', fechaEvento: sumarDias(hoy, -2), tratamiento: 'Revision', especialista: 'Dra. Sara López', valor: 310000,
  motivo: 'sin_dato', estado: 'pendiente', contactos: [], notas: [], ciclos: [], origen: 'manual', creadoEl: hoy,
};
const hace = (dias: number, extra: Partial<Paciente> = {}): Paciente => ({ ...base, fechaEvento: sumarDias(hoy, -dias), ...extra });

// RN-05: etapa por días desde el evento y color del semáforo
assert.equal(pasoActual(hace(2), hoy), 3);
assert.equal(fechaQueToca(hace(2), hoy), sumarDias(hoy, -2)); // el día 3 se atiende apenas ocurre
assert.ok(tocaHoy(hace(0), hoy));
assert.equal(semaforo(hace(2), hoy), 'rojo');
assert.equal(pasoActual(hace(9), hoy), 7);
assert.equal(semaforo(hace(9), hoy), 'amarillo');
assert.equal(pasoActual(hace(40), hoy), 15);
assert.equal(semaforo(hace(40), hoy), 'verde'); // rescate
assert.equal(semaforo(hace(40, { fallosSeguidos: 3 }), hoy), 'rojo'); // riesgo alto manda
assert.equal(semaforo(hace(40, { fallosHistoricos: 6, fallosSeguidos: 0 }), hoy), 'verde'); // falló antes pero volvió: no es riesgo alto
assert.equal(nivelRiesgo(3, 3), 'Alto');
assert.equal(nivelRiesgo(0, 5), 'Medio'); // reprograma mucho pero sí viene
assert.equal(nivelRiesgo(1, 1), 'Medio');
assert.equal(nivelRiesgo(0, 2), 'Bajo');
assert.equal(semaforo(hace(9, { etiquetas: ['VIP'] }), hoy), 'rojo');
assert.equal(semaforo(hace(9, { caso: 'limpieza' }), hoy), 'verde');
assert.equal(diasDeRetraso(hace(5), hoy), 0); // día 7 vence el día 14
assert.equal(diasDeRetraso(hace(20), hoy), 0); // el rescate no vence
assert.ok(!tocaHoy(hace(-5), hoy)); // control de limpieza que vence en el futuro

// cada etapa admite un intento; el rescate sin respuesta deja "agotado"
let p = registrarContacto(hace(2), 'sin_respuesta', 'm', 'agenda', hoy);
assert.equal(p.contactos[0].paso, 3);
assert.equal(pasoActual(p, hoy), 7);
assert.equal(fechaQueToca(p, hoy), sumarDias(hoy, 5));
assert.equal(p.motivo, 'agenda');
p = registrarContacto(hace(40), 'sin_respuesta', 'm', 'sin_dato', hoy);
assert.equal(p.estado, 'agotado');
assert.equal(pasoActual(p, hoy), null);
assert.equal(registrarContacto(base, 'agendo', 'm', 'sin_dato', hoy).estado, 'recuperado');
assert.equal(registrarContacto(base, 'no_interesa', 'm', 'costos', hoy).estado, 'descartado');
const n = nuevoCiclo(p, 'no_asistio', hoy);
assert.equal(n.ciclos[0].cierre, 'agotado');
assert.equal(pasoActual(n, hoy), 3);

// celulares del Excel
assert.equal(normalizarCelular(573108926704), '+573108926704');
assert.equal(normalizarCelular(3108926704), '+573108926704');
assert.equal(normalizarCelular(' 317 8320278'), '+573178320278');
assert.equal(normalizarCelular('5.7318E11'), ''); // perdió dígitos
assert.equal(normalizarCelular(4769430), ''); // fijo
assert.equal(normalizarCelular('-'), '');
assert.equal(soloDigitos('+573146821904'), '573146821904');
assert.equal(leerFecha('03/11/2026'), '2026-11-03');

// guiones oficiales: variables y profesional
const t = rellenar('Hola, [NOMBRE]. Te saluda [ASESOR/A] de parte del Dr. Juan Manuel Olarte. Valor $[VALOR]. Cita del [FECHA].', base, { asesora: 'Isabel Cristina' });
assert.equal(t, 'Hola, Ana. Te saluda Isabel Cristina de parte de la Dra. Sara López. Valor $310.000. Cita del [FECHA].');
assert.equal(
  rellenar('con la Dra. Sara López o con el Dr. Juan Manuel Olarte', { ...base, especialista: 'Dr. Juan Manuel Olarte' }, { asesora: 'x' }),
  'con la Dra. Sara López o con el Dr. Juan Manuel Olarte' // nombra a los dos: no se toca
);
assert.deepEqual(recomendados(hace(2), hoy), [7]); // cancelación día 3 → cat. 03
assert.deepEqual(recomendados(hace(2, { especialista: 'Dr. Juan Manuel Olarte' }), hoy), [7, 9]);
assert.deepEqual(recomendados(hace(30, { caso: 'limpieza' }), hoy), [10, 12, 17]);
assert.equal(recomendados(hace(9, { etiquetas: ['Convenio FLAIRES'] }), hoy)[0], 18);

// motor de campañas: respeta inicio programado, ritmo entre mensajes y cierre
const t0 = Date.parse('2026-11-18T10:00:00Z');
const camp: Campana = {
  id: 'c', nombre: 'c', audiencia: '', plantilla: '', creadaEl: '', inicio: new Date(t0 + 60_000).toISOString(),
  ritmoSeg: 10, canal: 'simulado', estado: 'programada',
  envios: [
    { pacienteId: 'a', nombre: 'a', telefono: '1', texto: '', estado: 'enviado', fecha: new Date(t0).toISOString() },
    { pacienteId: 'b', nombre: 'b', telefono: '1', texto: '', estado: 'pendiente' },
  ],
};
assert.deepEqual(siguientePaso(camp, t0), { tipo: 'nada' });
assert.deepEqual(siguientePaso(camp, t0 + 61_000), { tipo: 'enviar', idx: 1 });
assert.deepEqual(siguientePaso({ ...camp, estado: 'enviando' }, t0 + 5_000), { tipo: 'nada' });
assert.deepEqual(siguientePaso({ ...camp, estado: 'pausada' }, t0 + 99_000), { tipo: 'nada' });
assert.deepEqual(siguientePaso({ ...camp, estado: 'enviando', envios: [camp.envios[0]] }, t0), { tipo: 'completar' });
console.log('ok');
