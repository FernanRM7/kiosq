# QA — Migración a Zustand + TanStack Query

> Checklist manual de regresión. Ejecutar sobre el build de desarrollo (`npm run dev` en `apps/front` con `apps/back` corriendo).
>
> Cada flujo debe verificarse en el orden indicado. Si un paso falla, anotar el error y continuar con el siguiente flujo independiente.

---

## 1. Auth — Login

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1.1 | Navegar a `http://localhost:5173/login` | Se muestra el botón "Continue with WorkOS". |
| 1.2 | Click en "Continue with WorkOS" | El botón muestra "Opening WorkOS...", se redirige a la URL de WorkOS AuthKit. |
| 1.3 | Completar login en WorkOS | El backend redirige a `/dashboard`. |
| 1.4 | Verificar sidebar | Aparece el nombre/email del usuario en `UserNav` (footer del sidebar) y el workspace activo en la cabecera. |
| 1.5 | Recargar la página (F5) | La sesión persiste (cookie `wos-session`), no redirige a login. |

## 2. Auth — Logout

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 2.1 | Click en avatar del usuario en sidebar footer | Se abre popover con nombre/email y botón "Log out". |
| 2.2 | Click en "Log out" | El botón muestra "Logging out...", se redirige a WorkOS logout. |
| 2.3 | Intentar acceder a `/dashboard` sin sesión | Redirige a `/login`. |

## 3. Auth — Registro

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 3.1 | Navegar a `/register` | Se muestra el botón "Continue with WorkOS". |
| 3.2 | Click en "Continue with WorkOS" | Redirige a WorkOS con flujo de registro. |
| 3.3 | Completar registro | Vuelve a la app, sesión creada. Redirige a `/onboarding` si no tiene tenant. |

## 4. Auth — ProtectedRoute

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 4.1 | Cerrar sesión, navegar a `/dashboard/products` | Redirige a `/login`. |
| 4.2 | Iniciar sesión, navegar a `/login` estando autenticado | El ProtectedRoute deja pasar (no redirige). La página de login es pública pero no debería mostrar error. |

## 5. Productos — Listar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 5.1 | Navegar a `/dashboard/products` | Se muestra "Cargando productos..." brevemente, luego la tabla con los productos existentes (SKU, nombre, precio, stock, categoría). |
| 5.2 | Si no hay productos, confirmar que se muestra la tabla vacía sin error. | Tabla con 0 filas, sin mensaje de error. |
| 5.3 | Navegar a otra página (ej. Categories) y volver a Products | La tabla se muestra inmediatamente (cache de 30s), sin "Cargando..." intermedio. |
| 5.4 | Abrir `SalesDrawer` desde el top bar (botón "Sales") y cerrarlo | La tabla de productos sigue intacta, sin re-fetch innecesario. |

## 6. Productos — Crear

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 6.1 | En Products, ir al top bar y click en "Product" | Se abre el diálogo "Agregar producto". |
| 6.2 | Llenar SKU, nombre, precio, stock, categoría y click en "Agregar producto" | El botón muestra "Guardando...", el diálogo se cierra. |
| 6.3 | Verificar tabla de productos | El nuevo producto aparece **sin recargar la página** (query refetched). |
| 6.4 | Abrir `SalesDrawer` (botón "Sales" en la misma top bar) y buscar el nuevo producto | Aparece en los resultados de búsqueda del drawer. |

## 7. Productos — Editar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 7.1 | En la fila de un producto, click en icono de editar (lápiz) | Se abre el diálogo "Editar Producto" con los datos precargados. |
| 7.2 | Cambiar el nombre o precio y click en "Guardar" | El diálogo se cierra y la fila refleja el cambio en la tabla. |
| 7.3 | Cambiar la categoría del producto a una diferente | El cambio persiste al recargar. |

## 8. Productos — Eliminar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 8.1 | En la fila de un producto, click en icono de eliminar (trash) | Se abre diálogo de confirmación con el nombre del producto. |
| 8.2 | Click en "Eliminar" | El botón muestra "Eliminando...", diálogo se cierra, producto desaparece de la tabla. |
| 8.3 | Click en "Cancelar" (repetir paso 8.1 con otro producto) | El diálogo se cierra, el producto sigue en la tabla. |

## 9. Categorías — Listar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 9.1 | Navegar a `/dashboard/categories` | Se muestra "Cargando categorías...", luego tabs "Activas (N)" y "Eliminadas (N)". |
| 9.2 | Verificar que ambas pestañas tienen datos correctos | Las activas son las visibles en el select de categoría del formulario de producto. |
| 9.3 | Navegar a otra página y volver | Cache funciona, no hay "Cargando..." en el segundo montaje. |

## 10. Categorías — Crear

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 10.1 | Click en "Nueva categoría" | Se abre diálogo con campo "Nombre". |
| 10.2 | Ingresar nombre y click en "Crear" | Diálogo se cierra, la categoría aparece en la pestaña "Activas" **sin recargar**. |
| 10.3 | Abrir el diálogo "Agregar producto" y ver el select de categoría | La nueva categoría aparece como opción en el `<select>`. |
| 10.4 | Enviar el formulario vacío (nombre en blanco) | Se muestra error de validación "Nombre inválido". |
| 10.5 | Click en "Cancelar" en el diálogo de creación | El diálogo se cierra sin crear nada. |

## 11. Categorías — Editar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 11.1 | En la fila de una categoría activa, click en editar | Se abre diálogo con el nombre precargado. |
| 11.2 | Cambiar nombre y click en "Guardar" | La categoría se actualiza en la tabla sin recargar. |
| 11.3 | Editar una categoría asignada a un producto existente | El producto sigue mostrando la categoría con el nombre actualizado. |

## 12. Categorías — Eliminar (soft-delete)

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 12.1 | En la fila de una categoría activa, click en eliminar | Diálogo de confirmación. |
| 12.2 | Click en "Eliminar" | La categoría desaparece de "Activas" y aparece en "Eliminadas". |
| 12.3 | Ir al formulario de producto y ver el select de categoría | La categoría eliminada **no** aparece como opción. |

## 13. Categorías — Restaurar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 13.1 | En la pestaña "Eliminadas", click en restaurar | Se muestra "Restaurando...", la categoría vuelve a "Activas". |
| 13.2 | Verificar que aparece en el select de categoría del formulario de producto | Sí, aparece de nuevo como opción. |

## 14. Ventas — Listar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 14.1 | Navegar a `/dashboard/sales` | Se muestra "Cargando ventas...", luego un grid de tarjetas con fecha, total, subtotal e IVA. |
| 14.2 | Si no hay ventas, confirmar mensaje "No hay ventas registradas". | Sin error. |

## 15. Ventas — Completar una venta y verificar stock

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 15.1 | En la top bar, click en "Sales" | Se abre el drawer "Nueva Venta" a la derecha. |
| 15.2 | Buscar un producto por nombre o SKU en el campo de búsqueda | Aparecen resultados filtrados. |
| 15.3 | Click en un producto para agregarlo al carrito | El producto aparece en el carrito con cantidad 1, precio, IVA y stock máximo. |
| 15.4 | Usar +/- para ajustar cantidad | La cantidad cambia, no puede bajar de 1 ni superar el stock máximo. |
| 15.5 | Agregar un segundo producto al carrito | Ambos productos aparecen en el carrito, subtotal/IVA/total se recalculan. |
| 15.6 | Click en "Completar Venta" | El botón muestra "Procesando...", se cierra el drawer, aparece diálogo "Venta completada". |
| 15.7 | Navegar a `/dashboard/sales` | La nueva venta aparece en el grid **sin recargar**. |
| 15.8 | Navegar a `/dashboard/products`, ver el stock de los productos vendidos | El stock se ha descontado (el backend lo maneja, pero la query de productos se refetchó). |
| 15.9 | Repetir paso 15.1-15.6 con un producto que tenga stock=1, intentar poner cantidad 2 | El botón + se deshabilita al llegar al máximo. |

## 16. Workspace — Listar y cambiar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 16.1 | En el sidebar, click en el workspace switcher (cabecera) | Se abre popover con el workspace activo (check verde) y lista de otros workspaces. |
| 16.2 | Si pertenece a más de un workspace, click en otro | El botón muestra "...", se recarga la página en el nuevo tenant. |
| 16.3 | Verificar que los datos (productos, categorías, ventas) corresponden al nuevo workspace | Los datos cambian (scoped por tenant). |

## 17. Onboarding — Crear tenant nuevo

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 17.1 | Crear un usuario nuevo (sin tenant) vía WorkOS | Al iniciar sesión, redirige a `/onboarding`. |
| 17.2 | Se muestra spinner "Verificando tu espacio de trabajo..." | Luego de ~800ms aparece el diálogo "Nuevo Workspace". |
| 17.3 | Ingresar nombre del local y click en "Crear Workspace" | El botón muestra "Creando...", el diálogo se cierra, redirige a `/dashboard`. |
| 17.4 | Verificar que el workspace switcher muestra el nuevo workspace como activo | Nombre del workspace en la cabecera del sidebar. |
| 17.5 | Enviar formulario vacío (nombre en blanco) | Se muestra error "El nombre del local es obligatorio". |

## 18. Sesiones activas — Listar y revocar

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 18.1 | Navegar a `/dashboard/settings` | Se muestra tarjeta "Active Sessions" con skeletons de carga, luego la lista de sesiones. |
| 18.2 | Confirmar que la sesión actual tiene badge "Current" | Badge azul claro con texto "Current". |
| 18.3 | Si hay otra sesión (ej. otro navegador), click en el icono de trash | El botón muestra estado disabled mientras revoca, la sesión desaparece de la lista. |
| 18.4 | Recargar la página de settings | La sesión revocada ya no aparece. |

---

## Resumen de resultados

| Flujo                         | Estado          | Observaciones |
| ----------------------------- | --------------- | ------------- |
| 1. Login                      | ☐ Pass / ☐ Fail |               |
| 2. Logout                     | ☐ Pass / ☐ Fail |               |
| 3. Registro                   | ☐ Pass / ☐ Fail |               |
| 4. ProtectedRoute             | ☐ Pass / ☐ Fail |               |
| 5. Productos — Listar         | ☐ Pass / ☐ Fail |               |
| 6. Productos — Crear          | ☐ Pass / ☐ Fail |               |
| 7. Productos — Editar         | ☐ Pass / ☐ Fail |               |
| 8. Productos — Eliminar       | ☐ Pass / ☐ Fail |               |
| 9. Categorías — Listar        | ☐ Pass / ☐ Fail |               |
| 10. Categorías — Crear        | ☐ Pass / ☐ Fail |               |
| 11. Categorías — Editar       | ☐ Pass / ☐ Fail |               |
| 12. Categorías — Eliminar     | ☐ Pass / ☐ Fail |               |
| 13. Categorías — Restaurar    | ☐ Pass / ☐ Fail |               |
| 14. Ventas — Listar           | ☐ Pass / ☐ Fail |               |
| 15. Ventas — Crear y stock    | ☐ Pass / ☐ Fail |               |
| 16. Workspace — Cambiar       | ☐ Pass / ☐ Fail |               |
| 17. Onboarding — Crear tenant | ☐ Pass / ☐ Fail |               |
| 18. Sesiones — Revocar        | ☐ Pass / ☐ Fail |               |
