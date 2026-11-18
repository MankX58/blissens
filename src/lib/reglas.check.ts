// Comprobación rápida: npx tsx src/lib/reglas.check.ts
import assert from 'node:assert/strict';
import type { Paciente } from '../types';
import { nuevoCiclo, fechaQueToca, pasoActual, registrarContacto, semaforo, soloDigitos, sumarDias, tocaHoy } from './reglas';
import { detectarCaso, leerFecha } from './excel';
import { siguientePaso } from './campanas';
import type { Campana } from '../types';

const hoy = '2026-11-18';
const base: Paciente = {
  id: 't', nombre: 'Ana Test', telefono: '314 000 0000', ciudad: 'Medellín', segmento: 'local', caso: 'cancelo',
  fechaEvento: sumarDias(hoy, -3), tratamiento: 'x', especialista: 'Dra. X', valor: 0, motivo: 'sin_dato',
  estado: 'pendiente', contactos: [], notas: [], ciclos: [], origen: 'manual', creadoEl: hoy,
};

assert.equal(pasoActual(base), 3);
assert.equal(fechaQueToca(base), hoy);
assert.ok(tocaHoy(base, hoy));
assert.equal(semaforo(base, hoy), 'verde');
assert.equal(semaforo({ ...base, fechaEvento: sumarDias(hoy, -6) }, hoy), 'rojo'); // 3 días tarde

let p = registrarContacto(base, 'sin_respuesta', 'm', 'agenda', hoy);
assert.equal(pasoActual(p), 7);
assert.equal(p.motivo, 'agenda');
assert.ok(!tocaHoy(p, hoy));
p = registrarContacto(p, 'lo_pensara', 'm', 'sin_dato', hoy);
assert.equal(pasoActual(p), 15);
assert.equal(p.motivo, 'agenda'); // sin_dato no borra el motivo anterior
p = registrarContacto(p, 'sin_respuesta', 'm', 'sin_dato', hoy);
assert.equal(p.estado, 'agotado');
assert.equal(pasoActual(p), null);
assert.equal(registrarContacto(base, 'agendo', 'm', 'sin_dato', hoy).estado, 'recuperado');
assert.equal(registrarContacto(base, 'no_interesa', 'm', 'costos', hoy).estado, 'descartado');

assert.equal(sumarDias('2026-11-28', 7), '2026-12-05');
assert.equal(soloDigitos('314 682 1904'), '573146821904');
assert.equal(soloDigitos('+1 305 842 9910'), '13058429910');

assert.equal(detectarCaso('No asistió', ''), 'no_asistio');
assert.equal(detectarCaso('Canceló cita', ''), 'cancelo');
assert.equal(detectarCaso('Diagnóstico sin iniciar', ''), 'diagnostico');
assert.equal(detectarCaso('Pendiente', 'Limpieza'), 'limpieza');
assert.equal(detectarCaso('Asistió', 'Valoración'), null);
assert.equal(leerFecha('03/11/2026'), '2026-11-03');
assert.equal(leerFecha('2026-11-03'), '2026-11-03');

const n = nuevoCiclo(p, 'no_asistio', hoy);
assert.equal(n.ciclos.length, 1);
assert.equal(n.ciclos[0].cierre, 'agotado');
assert.equal(pasoActual(n), 3);
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
assert.deepEqual(siguientePaso(camp, t0), { tipo: 'nada' }); // aún no empieza
assert.deepEqual(siguientePaso(camp, t0 + 61_000), { tipo: 'enviar', idx: 1 });
assert.deepEqual(siguientePaso({ ...camp, estado: 'enviando' }, t0 + 5_000), { tipo: 'nada' }); // respeta el ritmo
assert.deepEqual(siguientePaso({ ...camp, estado: 'pausada' }, t0 + 99_000), { tipo: 'nada' });
assert.deepEqual(siguientePaso({ ...camp, estado: 'enviando', envios: [camp.envios[0]] }, t0), { tipo: 'completar' });
console.log('ok');
