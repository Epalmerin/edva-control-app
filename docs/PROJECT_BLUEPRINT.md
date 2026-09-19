# EDVA Operating System

## 1. Visión

EDVA Control App evolucionará hasta convertirse en el sistema operativo empresarial de EDVA Publicidad.

La plataforma centralizará los procesos administrativos, operativos, comerciales y de recursos humanos de la empresa en un solo lugar.

Su propósito es reducir procesos manuales, automatizar tareas repetitivas, disminuir errores operativos y proporcionar información útil para la toma de decisiones.

Todo nuevo desarrollo deberá acercar a la empresa a este objetivo.

---

## 2. Misión

Crear una plataforma moderna, segura, escalable y basada en datos que permita administrar la operación nacional de EDVA Publicidad.

La aplicación deberá convertirse en el principal punto de entrada para colaboradores, supervisores, administrativos y directivos.

---

## 3. Objetivos generales

- Centralizar la información operativa de EDVA.
- Automatizar procesos administrativos.
- Mejorar el control de la operación nacional.
- Facilitar la supervisión de promotores.
- Reducir errores y duplicidad de información.
- Mejorar la trazabilidad de los procesos.
- Generar reportes ejecutivos en tiempo real.
- Integrar inteligencia artificial de forma segura.
- Preparar la plataforma para crecer con nuevos clientes y cuentas.

---

## 4. Arquitectura tecnológica actual

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend y base de datos

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime

### Infraestructura

- GitHub
- Vercel
- Replit para análisis y desarrollo controlado

### Ramas principales

- `main`: producción
- `replit-integracion`: pruebas e integración

---

## 5. Dominios del negocio

### 5.1 Recursos Humanos

- Empleados
- Expedientes
- Documentos
- Contratos
- Términos de contrato
- Renovaciones
- Vacaciones
- Permisos
- Incapacidades
- Cumpleaños
- Evaluaciones
- Capacitaciones
- Onboarding
- Offboarding
- Historial laboral

### 5.2 Reclutamiento

- Vacantes
- Clientes
- Tiendas
- Publicaciones
- Bolsas de empleo
- Redes sociales
- Candidatos
- CV
- Llamadas
- Entrevistas
- Evaluaciones
- Aprobación del cliente
- Contratación
- Documentación
- Inducción
- Seguimiento

### 5.3 Operación

- Asistencias
- Entradas
- Salidas
- Comidas
- Retardos
- Faltas
- Geolocalización
- Evidencias fotográficas
- Ventas
- Incidencias
- Supervisión
- Visitas
- Reportes
- KPIs

### 5.4 Administración

- Nómina
- Recibos
- Bonos
- Comisiones
- Descuentos
- Gastos
- Presupuestos
- Facturación
- Tesorería
- Flujo de efectivo

### 5.5 Inteligencia de Mercados

- Competencia
- Exhibiciones
- Fotografías
- Precios
- Participación
- Categorías
- Indicadores
- Dashboards
- Reportes
- Análisis con IA

### 5.6 Productividad

- Tareas
- Proyectos
- Áreas de trabajo
- Comentarios
- Historial
- Recordatorios
- Calendario
- Objetivos
- Automatizaciones

### 5.7 Clientes y tiendas

- Clientes
- Cuentas
- Cadenas
- Tiendas
- Ubicaciones
- Supervisores
- Empleados asignados
- Vacantes
- Visitas
- Reportes
- Indicadores

### 5.8 Inteligencia Artificial

- Asistente ejecutivo
- Asistente de recursos humanos
- Asistente de reclutamiento
- Asistente comercial
- Reportes inteligentes
- Alertas
- Recomendaciones
- Detección de anomalías
- Automatización de procesos

---

## 6. Entidades principales del sistema

La plataforma debe organizarse alrededor de entidades centrales conectadas entre sí.

### Empleado

Un empleado puede tener:

- Perfil
- Contrato
- Términos de contrato
- Vacaciones
- Asistencias
- Ventas
- Incidencias
- Documentos
- Cumpleaños
- Evaluaciones
- Capacitaciones
- Tareas
- Historial laboral

### Cliente

Un cliente puede tener:

- Cuentas
- Tiendas
- Empleados
- Vacantes
- Ventas
- Reportes
- Inteligencia de mercados
- Indicadores

### Tienda

Una tienda puede tener:

- Cliente
- Cadena
- Ubicación
- Empleados asignados
- Vacantes
- Visitas
- Ventas
- Reportes
- Competencia
- Exhibiciones

### Vacante

Una vacante puede tener:

- Cliente
- Tienda
- Puesto
- Sueldo
- Publicaciones
- Candidatos
- Llamadas
- Entrevistas
- Evaluaciones
- Aprobaciones
- Tareas
- Estatus
- Contratación

### Tarea

Una tarea puede estar relacionada con:

- Proyecto
- Área
- Empleado
- Vacante
- Candidato
- Cliente
- Tienda
- Incidencia
- Reporte

---

## 7. Reglas obligatorias de desarrollo

### Nunca

- Trabajar directamente sobre `main`.
- Convertir el proyecto a Vite.
- Cambiar Next.js sin autorización.
- Eliminar módulos existentes.
- Modificar autenticación sin revisión.
- Ejecutar migraciones en producción sin validación.
- Exponer claves privadas.
- Usar `SUPABASE_SERVICE_ROLE_KEY` en el navegador.
- Hacer push directo a producción.
- Instalar librerías sin justificar su uso.
- Crear tablas duplicadas.
- Modificar políticas RLS sin revisión.

### Siempre

- Trabajar en una rama de desarrollo.
- Revisar el estado de Git antes de modificar.
- Documentar nuevas funciones.
- Diseñar primero el modelo de datos.
- Mantener compatibilidad con producción.
- Ejecutar pruebas antes de fusionar.
- Revisar permisos por rol.
- Mantener trazabilidad de cambios.
- Priorizar seguridad y estabilidad.
- Probar con datos ficticios antes de usar datos reales.

---

## 8. Reglas para agentes de IA

Antes de modificar cualquier archivo, un agente de IA deberá:

1. Leer este documento.
2. Analizar la arquitectura actual.
3. Identificar dependencias.
4. Proponer un plan.
5. Explicar los riesgos.
6. Esperar autorización antes de hacer cambios importantes.

El agente no deberá:

- Cambiar el framework.
- Reescribir grandes secciones sin aprobación.
- Modificar producción.
- Ejecutar SQL en producción.
- Cambiar autenticación.
- Cambiar roles o permisos.
- Publicar la aplicación.
- Hacer push automático a `main`.

Toda implementación deberá ser incremental, reversible y compatible con la operación actual.

---

## 9. Principios de producto

Toda nueva funcionalidad deberá cumplir al menos uno de estos objetivos:

- Reducir trabajo manual.
- Mejorar el control operativo.
- Automatizar procesos.
- Mejorar la experiencia del usuario.
- Centralizar información.
- Generar datos útiles.
- Reducir errores.
- Mejorar la trazabilidad.
- Facilitar la toma de decisiones.

---

## 10. Roadmap general

### Fase 1

- Documentación
- Auditoría técnica
- Base de datos de desarrollo
- Gestión de tareas
- Proyectos
- Comentarios
- Historial

### Fase 2

- Reclutamiento
- Vacantes
- Candidatos
- Seguimiento
- Aprobación
- Onboarding

### Fase 3

- Vacaciones
- Cumpleaños
- Contratos
- Términos de contrato
- Alertas
- Renovaciones

### Fase 4

- Inteligencia de mercados
- Reportes ejecutivos
- Dashboards
- Automatizaciones

### Fase 5

- Inteligencia artificial
- Recomendaciones
- Alertas predictivas
- Asistente ejecutivo

---

## 11. Estado actual

EDVA Control App se encuentra en producción y es utilizada para procesos reales de la empresa.

Los módulos existentes deben considerarse críticos y no deberán modificarse sin pruebas y autorización.

La prioridad actual de desarrollo es:

1. Gestión de tareas.
2. Reclutamiento.
3. Vacaciones.
4. Cumpleaños.
5. Contratos y términos de contrato.
6. Inteligencia de mercados.