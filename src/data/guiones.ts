// Las 24 plantillas oficiales de "Guiones_Blissens_.xlsx" (hoja "Guiones organizados", categoría combinada rellenada hacia abajo).
// n = número del guion; fila = n + 1 en el Excel (la fila 1 es el encabezado).
export interface GuionOficial { n: number; categoria: string; situacion: string; texto: string; nota: string }
export const GUIONES: GuionOficial[] = [
  {
    "n": 1,
    "categoria": "01. Captación y bienvenida",
    "situacion": "Paciente nuevo referido",
    "texto": "Hola, [NOMBRE]. ¡Te damos la bienvenida a BLISSENS ODONTOLOGÍA! Nos contaron que deseas una cita con nosotros y estamos listos para atenderte. Puedes elegir una cita con la Dra. Sara López o con el Dr. Juan Manuel Olarte. ¿Te gustaría que agendáramos una cita para conocernos?",
    "nota": "Completar nombre y profesional."
  },
  {
    "n": 2,
    "categoria": "01. Captación y bienvenida",
    "situacion": "Paciente nuevo – contacto compartido",
    "texto": "Buenos días, [NOMBRE]. ¡Te damos la bienvenida a BLISSENS! Nos compartieron tu número para que vivas la experiencia BLISSENS. Cuéntanos, ¿te queda mejor una cita con la Dra. Sara López en la mañana o en la tarde?",
    "nota": "Confirmar profesional y disponibilidad."
  },
  {
    "n": 3,
    "categoria": "01. Captación y bienvenida",
    "situacion": "Paciente nuevo – contacto compartido (alternativa)",
    "texto": "Hola, [NOMBRE]. ¡Bienvenido/a a BLISSENS! Nos compartieron tu número para que vivas la experiencia BLISSENS. Cuéntanos, ¿te queda mejor una cita con el Dr. Juan Manuel Olarte en la mañana o en la tarde?",
    "nota": "Alternativa dirigida al paciente que será atendido por el Dr. Juan Manuel."
  },
  {
    "n": 4,
    "categoria": "01. Captación y bienvenida",
    "situacion": "Consulta por precios / solicitud de presupuesto",
    "texto": "Agradecemos tu interés en nuestros servicios. Para ofrecerte un presupuesto preciso y personalizado, es necesario realizar una valoración inicial. Esto nos permitirá conocer tus necesidades y objetivos. Una vez realizada la valoración, te proporcionaremos información detallada sobre los precios, las formas de pago y el tratamiento recomendado. ¿Te gustaría programar una cita para la valoración? ¿Prefieres en la mañana o en la tarde?",
    "nota": "Unifica los fragmentos de las filas 37–40 y 42."
  },
  {
    "n": 5,
    "categoria": "01. Captación y bienvenida",
    "situacion": "Datos para registro del paciente",
    "texto": "Para brindarte el mejor servicio, queremos tener tu información completa antes de recibirte en BLISSENS. ¿Nos ayudas diligenciando los siguientes datos?\n\n• Nombre completo:\n• Documento de identidad:\n• Correo electrónico:\n• Teléfono:",
    "nota": "El archivo original incluye la solicitud de datos, pero no el enlace de la encuesta."
  },
  {
    "n": 6,
    "categoria": "02. Agendamiento y confirmación",
    "situacion": "Confirmación de cita agendada",
    "texto": "Hola, [NOMBRE]. Sabes que siempre cuentas con nosotros. Te escribimos para recordarte tu cita odontológica con la Dra. Sara López. Te esperamos en BLISSENS ODONTOLOGÍA. ¿Confirmas tu asistencia?",
    "nota": "El original no especifica fecha, hora ni dirección en este bloque. Añadir esos datos al enviar."
  },
  {
    "n": 7,
    "categoria": "03. Reprogramaciones y cancelaciones",
    "situacion": "Cambio de cita por parte de la clínica",
    "texto": "Hola, [NOMBRE]. Hicimos todo lo posible para evitarlo; sin embargo, necesitamos reprogramar la cita que tenías programada para el [FECHA] a las [HORA] con el Dr. Juan Manuel Olarte. ¿Te queda bien el [NUEVA FECHA] a las [NUEVA HORA] en BLISSENS ODONTOLOGÍA?",
    "nota": "Plantilla basada en el ejemplo original. Verificar fechas y horas antes de enviar."
  },
  {
    "n": 8,
    "categoria": "03. Reprogramaciones y cancelaciones",
    "situacion": "Respuesta a cancelación por motivo de salud",
    "texto": "Buenos días, [NOMBRE]. ¿Cómo estás? Comprendemos la cancelación de la cita y les deseamos una pronta recuperación.",
    "nota": "Mensaje de respuesta amable a una cancelación."
  },
  {
    "n": 9,
    "categoria": "03. Reprogramaciones y cancelaciones",
    "situacion": "Ofrecer cita con otro profesional",
    "texto": "Te contamos que la cita más cercana disponible en este momento es con la Dra. Sara López, debido a que el Dr. Juan Manuel Olarte ha estado viajando frecuentemente por motivos laborales. ¿Te gustaría agendar tu cita con la Dra. Sara?",
    "nota": "Confirmar disponibilidad antes de enviar. El original indica que la Dra. Sara es esposa del doctor; se omite ese dato por no ser necesario para el paciente."
  },
  {
    "n": 10,
    "categoria": "04. Seguimiento y reactivación",
    "situacion": "Paciente de limpieza o revisión cada 4 o 6 meses",
    "texto": "Hola, [NOMBRE]. En BLISSENS ODONTOLOGÍA sabemos que tienes muchas ocupaciones y por eso queremos recordarte que ya es momento de programar tu próxima limpieza dental con la Dra. Sara López. ¿Agendamos tu cita? ¿Prefieres en la mañana o en la tarde?",
    "nota": "Dirigido a pacientes con limpieza o revisión periódica pendiente."
  },
  {
    "n": 11,
    "categoria": "04. Seguimiento y reactivación",
    "situacion": "Paciente inactivo – recuperación de base de datos",
    "texto": "Hola, [NOMBRE]. ¡Te extrañamos y queremos que lo sepas! En BLISSENS ODONTOLOGÍA queremos seguir cuidando tu sonrisa. Nos encantaría volver a verte y acompañarte en tu salud oral. ¿Te gustaría agendar una cita con el Dr. Juan Manuel Olarte o la Dra. Sara López?",
    "nota": "Elegir el profesional según disponibilidad y preferencia del paciente."
  },
  {
    "n": 12,
    "categoria": "04. Seguimiento y reactivación",
    "situacion": "Seguimiento de paciente que no asiste hace varios meses",
    "texto": "Hola, [NOMBRE]. Buenos días, ¿cómo has estado? Te saluda [ASESOR/A], de BLISSENS ODONTOLOGÍA, de parte del Dr. Juan Manuel Olarte. Al revisar tu historia clínica, notamos que hace varios meses no vienes a control y queremos saber cómo estás. ¿Te gustaría que agendáramos una cita de revisión y limpieza? ¿Prefieres en la mañana o en la tarde?",
    "nota": "Integra los fragmentos de saludo, presentación y seguimiento."
  },
  {
    "n": 13,
    "categoria": "04. Seguimiento y reactivación",
    "situacion": "Seguimiento del plan de tratamiento",
    "texto": "Hola, [NOMBRE]. Te escribimos de parte de la Dra. Sara López. Tenemos pendiente agendar una cita para continuar con el proceso de tu plan de tratamiento. ¿Prefieres una cita en la mañana o en la tarde?",
    "nota": "Para pacientes con tratamiento pendiente."
  },
  {
    "n": 14,
    "categoria": "05. Cobros y pagos",
    "situacion": "Recordatorio general de pago",
    "texto": "Hola, [NOMBRE]. Buenos días, ¿cómo estás? Queremos recordarte que tienes un pago pendiente con BLISSENS ODONTOLOGÍA. Quedamos atentos a cualquier inquietud. ¡Feliz día!",
    "nota": "Mensaje cordial y general."
  },
  {
    "n": 15,
    "categoria": "05. Cobros y pagos",
    "situacion": "Solicitud de fecha para abono",
    "texto": "Hola, [NOMBRE]. Me comunico para recordarte el saldo pendiente que tienes con nosotros. ¿Podrías confirmarme en qué fecha estarías realizando un abono a tu plan de tratamiento?",
    "nota": "Para saldos de planes de tratamiento."
  },
  {
    "n": 16,
    "categoria": "05. Cobros y pagos",
    "situacion": "Recordatorio de pago de consulta",
    "texto": "Buen día, [NOMBRE]. En BLISSENS sabemos que, con todas las ocupaciones del día, es posible que se te haya pasado realizar el pago de la última consulta de [NOMBRE DEL PACIENTE]. Por eso queremos recordártelo. Si tienes alguna duda, estamos aquí para ayudarte. ¡Feliz día!",
    "nota": "El original está dirigido a un familiar/responsable de otro paciente; adaptar el trato según corresponda."
  },
  {
    "n": 17,
    "categoria": "05. Cobros y pagos",
    "situacion": "Recordatorio de pago por limpieza",
    "texto": "Buenas tardes, [NOMBRE]. ¿Cómo estás? Esperamos que te encuentres muy bien. Te escribimos para recordarte que el valor correspondiente a la limpieza realizada es de $[VALOR]. Los pagos se realizan a la cuenta de ahorros de Bancolombia indicada por la clínica. Agradecemos tu gestión y quedamos atentos. ¡Feliz tarde!",
    "nota": "El valor original era $310.000. Confirmar valor y datos oficiales de pago antes de enviar. No incluir números de cuenta en esta plantilla."
  },
  {
    "n": 18,
    "categoria": "06. Bonos y campañas",
    "situacion": "Bono de limpieza – convenio FLAIRES",
    "texto": "Hola, [NOMBRE]. Me comunico para recordarte que, por ser parte de FLAIRES, tienes un bono para una limpieza dental en BLISSENS ODONTOLOGÍA. ¡Nos encantaría conocerte y ayudarte a hacer efectivo tu bono! ¿Agendamos tu cita?",
    "nota": "Verificar vigencia y condiciones del bono."
  },
  {
    "n": 19,
    "categoria": "07. Mensajes especiales",
    "situacion": "Mensaje de apoyo – donaciones para Isaac",
    "texto": "Hoy puedes hacer la diferencia en la vida de Isaac. 🤍\n\nInformación para donaciones:\n[BANCO Y DATOS DE DONACIÓN VERIFICADOS POR LA FAMILIA O RESPONSABLE]\n\n¡Muchas gracias por tu apoyo!",
    "nota": "El archivo original contiene datos bancarios y de identificación personal. Se dejan como campos para validar antes de difundir."
  },
  {
    "n": 20,
    "categoria": "08. Guiones de llamada / conversación",
    "situacion": "Inicio de conversación telefónica",
    "texto": "Hola, buenos días. Gracias por comunicarte con BLISSENS ODONTOLOGÍA. Mi nombre es [NOMBRE DEL ASESOR/A]. ¿En qué puedo ayudarte?",
    "nota": "Adaptación del saludo original."
  },
  {
    "n": 21,
    "categoria": "08. Guiones de llamada / conversación",
    "situacion": "Presentación del asesor",
    "texto": "Me comunico de BLISSENS ODONTOLOGÍA, de parte del Dr. Juan Manuel Olarte. Mi nombre es [NOMBRE DEL ASESOR/A].",
    "nota": "Fragmento original de presentación."
  },
  {
    "n": 22,
    "categoria": "08. Guiones de llamada / conversación",
    "situacion": "Conversación de bienestar y revisión",
    "texto": "¿Cómo has estado? Queremos saber cómo te sientes. ¿Has notado tensión en los hombros, el cuello o la mordida? ¿Sientes que tus dientes necesitan una limpieza? Si es así, ¿te parece si agendamos una cita de revisión?",
    "nota": "Guion conversacional reconstruido a partir de frases sueltas. Usar con naturalidad, sin presentar preguntas como diagnóstico."
  },
  {
    "n": 23,
    "categoria": "08. Guiones de llamada / conversación",
    "situacion": "Pausa en el guion",
    "texto": "[Hacer una pausa breve para permitir que el paciente responda.]",
    "nota": "El archivo indicaba una pausa de 3 segundos y varios puntos aislados."
  },
  {
    "n": 24,
    "categoria": "09. Mensajes operativos",
    "situacion": "Ubicación para asistir a la cita",
    "texto": "Te esperamos en BLISSENS ODONTOLOGÍA, en El Tesoro, torre médica 2, consultorio 1157.",
    "nota": "Verificar que la dirección siga vigente. Añadir fecha y hora de la cita."
  }
];
