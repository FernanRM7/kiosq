# HEL-36 – Reporte de Pruebas Funcionales, Validación, Usabilidad y Regresión

## Historia de Usuario

**COMO** equipo de QA

**QUIERO** ejecutar pruebas funcionales, de validación, manejo de errores y usabilidad en los módulos relevantes

**PARA** detectar problemas visibles antes de cerrar la implementación.

---

# Objetivo

Validar el correcto funcionamiento del cliente y del backend mediante pruebas funcionales, de usabilidad, validación de entradas, manejo de errores y regresión funcional. El propósito es identificar problemas visibles para el usuario antes del cierre de la implementación.

---

# Alcance

Las pruebas se realizaron sobre los módulos principales del sistema, incluyendo el flujo de autenticación, comunicación entre frontend y backend, disponibilidad de servicios, validación de respuestas y manejo de errores.

No se evaluó la lógica interna de servicios externos administrados por terceros.

---

# Entorno de pruebas

| Elemento                  | Valor                 |
| ------------------------- | --------------------- |
| Sistema Operativo         | Windows 10            |
| Backend                   | NestJS                |
| Frontend                  | React + Vite          |
| Base de datos             | PostgreSQL (Supabase) |
| Caché                     | Redis                 |
| Servicio de autenticación | WorkOS AuthKit        |

---

# Casos de prueba ejecutados

## QA-01 Inicio del backend

**Objetivo**

Verificar que el backend inicie correctamente y publique todas las rutas configuradas.

**Resultado esperado**

El servidor inicia sin errores y expone los endpoints correspondientes.

**Resultado obtenido**

El backend inició correctamente y registró los controladores y rutas esperadas.

**Estado**

✅ Aprobado

---

## QA-02 Disponibilidad de Redis

**Objetivo**

Comprobar la conectividad con Redis para el almacenamiento de sesiones.

**Resultado esperado**

Redis responde correctamente y acepta conexiones.

**Resultado obtenido**

Redis respondió correctamente mediante la prueba de conectividad y el backend logró establecer conexión.

**Estado**

✅ Aprobado

---

## QA-03 Disponibilidad de Swagger

**Objetivo**

Verificar la publicación de la documentación de la API.

**Resultado esperado**

La interfaz Swagger se encuentra disponible.

**Resultado obtenido**

La documentación fue accesible desde el servidor local.

**Estado**

✅ Aprobado

---

## QA-04 Flujo de autenticación

**Objetivo**

Validar el inicio del proceso de autenticación mediante WorkOS.

**Resultado esperado**

El endpoint genera correctamente la URL de autorización.

**Resultado obtenido**

El backend generó correctamente la URL de autorización y la Redirect URI configurada.

**Estado**

✅ Aprobado

---

## QA-05 Manejo de errores

**Objetivo**

Verificar que el cliente muestre mensajes controlados cuando ocurre un error de comunicación.

**Resultado esperado**

El usuario recibe mensajes amigables y no se exponen excepciones internas.

**Resultado obtenido**

El cliente presentó mensajes controlados sin mostrar trazas internas del servidor.

**Estado**

✅ Aprobado

---

## QA-06 Validación de sesión

**Objetivo**

Comprobar el comportamiento cuando no existe una sesión válida.

**Resultado esperado**

El servidor responde con autenticación requerida.

**Resultado obtenido**

Se obtuvo una respuesta controlada indicando que el usuario debe autenticarse.

**Estado**

✅ Aprobado

---

## QA-07 Regresión funcional

**Objetivo**

Verificar que los módulos principales continúen funcionando después de las modificaciones realizadas.

**Resultado esperado**

Los módulos mantienen su comportamiento esperado.

**Resultado obtenido**

No se detectaron regresiones funcionales en los módulos evaluados.

**Estado**

✅ Aprobado

---

# Hallazgos

## H-01 Configuración de Redirect URI en WorkOS

**Severidad**

Alta

**Descripción**

Durante las pruebas del flujo de autenticación se detectó que la aplicación de WorkOS no tiene registrada la Redirect URI utilizada actualmente por el backend.

Como consecuencia, el proceso de autenticación no puede completarse, aun cuando el backend genera correctamente la URL de autorización.

**Impacto**

El usuario no puede finalizar el inicio de sesión mediante WorkOS.

**Clasificación**

Dependencia de configuración externa.

**Recomendación**

Actualizar la configuración de Redirect URIs dentro del Dashboard de WorkOS para que coincida con la URI utilizada por el backend.

---

# Conclusiones

Las pruebas permitieron validar el funcionamiento general del sistema y confirmar la estabilidad de los módulos principales.

El backend, Redis y los servicios internos operan correctamente durante las pruebas realizadas.

El único hallazgo de alta prioridad corresponde a una configuración externa del proveedor de autenticación (WorkOS), la cual impide completar el flujo de inicio de sesión. No se identificaron defectos funcionales adicionales en los componentes evaluados.

---

# Resultado final

| Área                  | Estado                                 |
| --------------------- | -------------------------------------- |
| Backend               | ✅ Correcto                            |
| Frontend              | ✅ Correcto                            |
| Redis                 | ✅ Correcto                            |
| Swagger               | ✅ Correcto                            |
| Validación de errores | ✅ Correcto                            |
| Regresión funcional   | ✅ Correcto                            |
| Integración WorkOS    | ⚠️ Bloqueada por configuración externa |
