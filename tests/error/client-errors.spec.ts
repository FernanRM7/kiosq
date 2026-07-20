import { test, expect } from "@playwright/test";

test.describe("HEL-43 - Manejo de errores en cliente", () => {
  // QA-ERR-001
  // Verifica que la aplicación muestre un mensaje amigable cuando
  // el backend no responde y que no exponga errores técnicos.

  test("QA-ERR-001 Debe mostrar un mensaje amigable cuando el backend no responde", async ({
    page,
  }) => {
    // Intercepta la petición al endpoint de login y la cancela,
    // simulando que el backend está fuera de servicio.
    await page.route("**/api/auth/login", async (route) => {
      await route.abort();
    });

    // Accede a la pantalla de inicio de sesión.
    await page.goto("/login");

    // Intenta iniciar sesión mediante WorkOS.
    await page
      .getByRole("button", {
        name: "Continue with WorkOS",
      })
      .click();

    // Comprueba que se muestre un mensaje claro para el usuario.
    await expect(
      page.getByText(
        "No se pudo conectar con el backend. Verifica que Nest y Redis esten activos."
      )
    ).toBeVisible();

    // Verifica que no se muestren errores internos del servidor.
    await expect(page.getByText("Internal Server Error")).toHaveCount(0);

    // Verifica que no se expongan errores de Prisma.
    await expect(page.getByText("PrismaClientInitializationError")).toHaveCount(
      0
    );

    // Verifica que no se muestren errores generados por Axios.
    await expect(page.getByText("AxiosError")).toHaveCount(0);
  });

  // QA-ERR-002
  // Verifica que, cuando el servidor responde con un error 500,
  // la aplicación muestre un mensaje entendible y oculte los detalles técnicos.

  test("QA-ERR-002 Debe mostrar un mensaje cuando el servidor responde con error 500", async ({
    page,
  }) => {
    // Simula una respuesta del servidor con código HTTP 500.
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "La solicitud no pudo completarse.",
          },
          success: false,
        }),
        contentType: "application/json",
        status: 500,
      });
    });

    // Abre la pantalla de inicio de sesión.
    await page.goto("/login");

    // Intenta iniciar sesión mediante WorkOS.
    await page
      .getByRole("button", {
        name: "Continue with WorkOS",
      })
      .click();

    // Comprueba que el usuario vea el mensaje definido por la aplicación.
    await expect(
      page.getByText("La solicitud no pudo completarse.")
    ).toBeVisible();

    // Verifica que el usuario permanezca en la pantalla de login.
    await expect(page).toHaveURL(/login/u);

    // Comprueba que no se expongan errores técnicos del servidor.
    await expect(page.getByText("Internal Server Error")).toHaveCount(0);

    // Verifica que no aparezcan errores de Prisma.
    await expect(page.getByText("PrismaClientInitializationError")).toHaveCount(
      0
    );

    // Verifica que no se muestren errores de Axios.
    await expect(page.getByText("AxiosError")).toHaveCount(0);
  });
});
test("QA-ERR-003 Debe manejar correctamente una respuesta inesperada del backend", async ({
  page,
}) => {
  // Simula una respuesta HTTP 200 con un cuerpo inválido.
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        unexpected: true,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  // Abre la pantalla de login.
  await page.goto("/login");

  // Intenta iniciar sesión.
  await page
    .getByRole("button", {
      name: "Continue with WorkOS",
    })
    .click();

  // Comprueba que el usuario vea el mensaje definido por la aplicación.
  await expect(
    page.getByText("El backend devolvio una respuesta inesperada.")
  ).toBeVisible();

  // Verifica que permanezca en la pantalla de login.
  await expect(page).toHaveURL(/login/u);

  // Verifica que no aparezcan errores técnicos.
  await expect(page.getByText("Internal Server Error")).toHaveCount(0);
  await expect(page.getByText("PrismaClientInitializationError")).toHaveCount(
    0
  );
  await expect(page.getByText("AxiosError")).toHaveCount(0);
});
test("QA-ERR-004 Debe redirigir al usuario cuando la sesión haya expirado", async ({
  page,
}) => {
  // Simula que el backend responde con un 401 (Unauthorized).
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
        success: false,
      }),
      contentType: "application/json",
      status: 401,
    });
  });

  // El usuario intenta acceder al dashboard.
  await page.goto("/dashboard");

  // Debe ser redirigido al login.
  await expect(page).toHaveURL(/login/u);

  // Debe mostrarse el botón para iniciar sesión.
  await expect(
    page.getByRole("button", {
      name: "Continue with WorkOS",
    })
  ).toBeVisible();

  // No deben mostrarse errores técnicos.
  await expect(page.getByText("Internal Server Error")).toHaveCount(0);
  await expect(page.getByText("PrismaClientInitializationError")).toHaveCount(
    0
  );
  await expect(page.getByText("AxiosError")).toHaveCount(0);
});
