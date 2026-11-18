# Blissens · Hoy toca contactar

Panel diario para la auxiliar administrativa de Blissens Odontología: lee la agenda exportada en Excel, detecta a los pacientes que se están perdiendo y arma la lista de contacto del día con la regla 3-7-15.

## Secciones (agrupadas por rol)

**Auxiliar administrativa**
- **Hoy toca contactar**: lista del día por semáforo (rojo = último intento o atrasado, amarillo = día 7, verde = día 3) y valor. En *Contactar* se elige el guion, se abre WhatsApp con el mensaje listo y se registra la respuesta y el motivo.
- **Pacientes**: expediente de cada paciente con su proceso 3-7-15, historia completa (contactos, campañas, citas, notas, procesos anteriores), notas internas, reactivar o sacar del seguimiento y alta manual.
- **Cargar agenda**: lee el Excel del software; las cancelaciones futuras se convierten en espacios de la agenda abierta. Si un paciente ya existía, su proceso anterior queda en el expediente.

**Recepción y agenda**
- **Agenda abierta**: espacios disponibles con pacientes sugeridos (mismo especialista, alto valor primero), registro de a quién se le ofreció, asignaciones con opción de revertir y marcar asistencia. Si no asiste, el paciente vuelve solo a la regla 3-7-15.

**Mercadeo y comercial**
- **Campañas automáticas**: audiencia + mensaje con variables + envío ahora o programado, con pausa entre mensajes. Se envían solas mientras el panel está abierto, con avance en vivo, pausa, cancelación y reintento de fallidos. Sin conexión funcionan en modo simulación; con WhatsApp Business Cloud API (token + ID de número, opcionalmente una plantilla aprobada) salen de verdad.

**Dirección y especialistas**
- **Indicadores**: valor recuperado, cancelaciones, inasistencias, tasa de recuperación, actividad de 14 días, motivos, efectividad por intento, recuperación por segmento, agenda abierta y campañas. Las tablas (seguimiento, pacientes, agenda abierta, campañas) se ven en pantalla con búsqueda y orden, y se pueden descargar una a una o todas en un Excel.

## Regla 3-7-15

Se escribe al paciente 3, 7 y 15 días después del evento. Si agenda, queda recuperado; si dice que no, sale de la lista; si no responde al día 15, pasa a la campaña "No respondieron al 3-7-15".

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npx tsx src/lib/reglas.check.ts   # prueba de la regla y del lector de Excel
```

Los datos se guardan en el navegador (localStorage). "Restaurar datos de ejemplo" en el pie de página vuelve a los datos demo.
