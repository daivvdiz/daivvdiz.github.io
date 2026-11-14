import {
  LayoutDashboard, CalendarDays, Brain, Target, Wallet, Briefcase, Dumbbell, Archive, LineChart, Settings,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Fase del plan en la que se construye (las ya disponibles no lo llevan). */
  phase?: number;
}

export const MODULES: ModuleDef[] = [
  { href: "/overview", label: "Resumen", icon: LayoutDashboard, description: "Tu contexto de vida hoy." },
  { href: "/calendar", label: "Calendario y diario", icon: CalendarDays, description: "Eventos, entrada diaria, gratitud, recuerdos y logros.", phase: 2 },
  { href: "/mental-health", label: "Salud mental", icon: Brain, description: "Ánimo, energía, estrés, sueño y estrategias que te ayudan.", phase: 3 },
  { href: "/goals", label: "Metas y hábitos", icon: Target, description: "Metas, hitos y hábitos sin presión de rachas.", phase: 4 },
  { href: "/finances", label: "Finanzas", icon: Wallet, description: "Movimientos, presupuesto, ahorro y patrimonio en COP.", phase: 5 },
  { href: "/career", label: "Carrera", icon: Briefcase, description: "Aplicaciones, skills, proyectos y aprendizaje.", phase: 5 },
  { href: "/physical", label: "Físico", icon: Dumbbell, description: "Entrenamientos, progresión y medidas corporales.", phase: 6 },
  { href: "/archive", label: "Archivo de vida", icon: Archive, description: "Recuerdos, capítulos, documentos y un día como hoy.", phase: 3 },
  { href: "/analytics", label: "Analítica de vida", icon: LineChart, description: "Tu evolución en todas las áreas, sin juicios.", phase: 7 },
  { href: "/settings", label: "Ajustes", icon: Settings, description: "Perfil, apariencia, privacidad y tus datos." },
];
