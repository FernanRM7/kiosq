import { LifeBuoy, Mail, MessageSquareText } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const supportItems = [
  {
    description:
      "Si algo no carga, vuelve a abrir el panel o revisa tu sesión.",
    icon: MessageSquareText,
    title: "Problemas en pantalla",
  },
  {
    description:
      "Si perdiste acceso al negocio, el dueño puede volver a darte entrada.",
    icon: Mail,
    title: "Acceso y credenciales",
  },
  {
    description:
      "Más adelante aquí podremos abrir tickets o escribir a soporte.",
    icon: LifeBuoy,
    title: "Ayuda general",
  },
] as const;

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg">Soporte</h1>
        <p className="text-muted-foreground text-sm">
          Este espacio no cierra sesión. Solo sirve para ayudarte dentro del
          panel.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {supportItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardHeader className="gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </div>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Button render={<Link to="/dashboard" />}>Volver al panel</Button>
    </div>
  );
}
