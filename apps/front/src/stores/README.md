# Zustand Stores

## Convenciones

### Nombrado de archivos

Cada store vive en su propio archivo con el patrón `stores/<dominio>.store.ts`.

```
stores/
├── README.md
├── auth.store.ts
├── products.store.ts
├── sales.store.ts
└── ui.store.ts
```

### Estructura del store

Usamos la sintaxis de función creadora para mantener tipado completo sin necesidad de declarar interfaces intermedias:

```ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface BearState {
  bears: number;
  increase: () => void;
  reset: () => void;
}

export const useBearStore = create<BearState>()(
  devtools(
    (set) => ({
      bears: 0,
      increase: () => set((state) => ({ bears: state.bears + 1 })),
      reset: () => set({ bears: 0 }),
    }),
    { name: "bear-store" }
  )
);
```

### Cuándo usar slices

Si un store crece más de ~150 líneas, se parte en slices con el patrón `StateCreator`:

```ts
// stores/auth.store.ts
import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

interface SessionSlice { user: User | null; setUser: (u: User) => void }
interface AuthSlice { status: Status; login: () => Promise<void> }

const createSessionSlice: StateCreator<SessionSlice & AuthSlice, [], [], SessionSlice> = (set) => ({ ... });
const createAuthSlice:    StateCreator<SessionSlice & AuthSlice, [], [], AuthSlice>    = (set) => ({ ... });

export const useAuthStore = create<SessionSlice & AuthSlice>()(
  devtools((...args) => ({ ...createSessionSlice(...args), ...createAuthSlice(...args) }), { name: "auth-store" })
);
```

### Middleware

- **`devtools`**: activar siempre (habilita inspección en React DevTools y Zustand DevTools). El `name` debe coincidir con el nombre del archivo.
- **`persist`**: solo para estado que debe sobrevivir refrescos de página (tema dark/light, preferencias de UI, último workspace seleccionado). Usar siempre `partialize` para no persistir datos efímeros.
- **`immer`**: no instalar por ahora. La inmutabilidad es manejable con `set`.

### Reglas

1. No uses stores de Zustand para estado de formularios o UI local que no se comparte entre rutas (eso sigue siendo `useState` o React Hook Form).
2. Las acciones asíncronas (que llaman APIs) deben delegar el fetching a TanStack Query, no hacer `fetch` directamente desde el store. El store guarda el resultado o estado derivado.
3. Los stores NO deben importar componentes de React ni hooks de React.
4. Si un store necesita el `queryClient` para invalidar queries después de una mutación, se pasa como parámetro o se obtiene del closure de inicialización. Alternativa preferida: hacer la invalidación desde el componente que ejecuta la mutación con `useMutation`.
