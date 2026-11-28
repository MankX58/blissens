// Comprueba el lector contra los Excel reales: npx tsx src/lib/excel.check.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerArchivos, radiografia } from './excel';
import { AUDIENCIAS, personalizar } from './campanas';

// los Excel reales viven fuera del repo (datos de pacientes): por defecto, la carpeta hermana de la clínica
const dir = (process.env.RUTA_EXCEL ?? '../Archivos Blissens Odontologia') + '/';
const nombres = ['Agenda citas y estados .xlsx', 'Agenda y citas .xlsx', 'Arancel precios.xlsx', 'Guiones_Blissens_.xlsx'];
const files = nombres.map((n) => {
  const b = readFileSync(dir + n);
  return { nombre: n, buffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
});

const c = await leerArchivos(files);
assert.deepEqual(c.archivos.map((a) => a.tipo), ['historial', 'detalle', 'arancel', 'guiones']);

const r = radiografia(c.citas);
assert.equal(r.total, 885);
assert.equal(r.pacientes, 255);
assert.equal(r.friccion, 461);
assert.equal(r.atendidas, 391);
assert.equal(r.otras, 33);
assert.deepEqual(Object.fromEntries(r.detalleFriccion.map((d) => [d.estado, d.n])), {
  'Cambio de fecha': 266,
  Anulado: 97,
  'No asiste': 51,
  'Anulado por pcte. via Whatsapp': 47,
});
assert.deepEqual(r.meses.map(([, n]) => n), [271, 264, 231, 119]);
assert.equal(r.sara, 548);
assert.equal(r.olarte, 337);
assert.equal(r.tratamiento, 471);
assert.equal(r.diagnostico, 414);

const grupos = [1, 2, 3, 4].map((g) => c.pacientes.filter((p) => p.grupo === g).length);
assert.deepEqual(grupos, [115, 50, 74, 16]);
assert.equal(c.fechaCorte, '2026-11-12');

const p = (id: string) => c.pacientes.find((x) => x.idPaciente === id)!;
// casos de QA del SRS
assert.equal(p('#36').telefono, '+573108926704');
assert.equal(p('#36').especialista, 'Dr. Juan Manuel Olarte');
assert.equal(p('#36').fallosHistoricos, 3);
assert.equal(p('#36').fallosSeguidos, 3); // nunca ha asistido
assert.equal(p('#36').nivelRiesgo, 'Alto');
assert.match(p('#36').tratamiento, /Lab Corona 47/);
assert.ok(p('#36').valor > 0);
assert.equal(p('#36').grupo, 1);

assert.equal(p('#1116').telefono, '');
assert.equal(p('#1116').antiguedad, 'Nuevo');
assert.equal(p('#1116').especialista, 'Dra. Sara López');
assert.equal(p('#1116').grupo, 1);

assert.equal(p('#710').antiguedad, 'Antiguo');
assert.equal(p('#710').fallosHistoricos, 5); // 4 en octubre + 1 en agosto
assert.equal(p('#710').fallosSeguidos, 4); // las 4 de octubre, después de su última visita del 23-sep
assert.equal(p('#710').nivelRiesgo, 'Alto');

assert.equal(p('#950').ultimaCita?.estado, 'No asiste'); // primera fila del 30-oct
assert.ok(p('#950').etiquetas.includes('Alineadores'));
assert.equal(p('#950').caso, 'no_asistio');

assert.equal(p('#1095').antiguedad, 'Nuevo');
// falló 5 veces pero su última cita fue atendida: riesgo medio, no alto
assert.equal(p('#1096').fallosHistoricos, 5);
assert.equal(p('#1096').fallosSeguidos, 0);
assert.equal(p('#1096').nivelRiesgo, 'Medio');
assert.equal(c.pacientes.filter((x) => x.nivelRiesgo === 'Alto').length, 28);
assert.ok(p('#1149').etiquetas.includes('Valoración virtual'));

const conValor = c.pacientes.filter((x) => x.valor > 0).length;
assert.equal(conValor, 255);
// textos de campaña sobre los pacientes reales: sin variables sueltas, sin comentarios crudos ni frases en minúscula
for (const a of AUDIENCIAS)
  for (const x of c.pacientes) {
    const t = personalizar(a.plantilla, x);
    assert.ok(!/[{}]/.test(t), t);
    assert.ok(!/[.?!] [a-záéíóú]/.test(t), t);
    assert.ok(!/lab |revision|diagn[oó]stico ·/i.test(t), t);
    assert.ok(!/ (de|a) el /.test(t), t);
  }
console.log(personalizar(AUDIENCIAS.find((a) => a.id === 'vip')!.plantilla, p('#875')));
console.log('ok', { grupos, conContacto: c.conContacto, sinCelular: c.pacientes.filter((x) => !x.telefono).length, enPausa: c.pacientes.filter((x) => x.estado === 'pendiente').reduce((s, x) => s + x.valor, 0) });
