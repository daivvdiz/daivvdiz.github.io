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
  { href: "/overview", label: "Overview", icon: LayoutDashboard, description: "Your life context today." },
  { href: "/calendar", label: "Calendar & journal", icon: CalendarDays, description: "Events, daily entry, gratitude, memories and accomplishments." },
  { href: "/mental-health", label: "Mental health", icon: Brain, description: "Mood, energy, stress, sleep and strategies that help you." },
  { href: "/goals", label: "Goals & habits", icon: Target, description: "Goals, milestones and habits without streak pressure." },
  { href: "/finances", label: "Finances", icon: Wallet, description: "Transactions, budget, savings and net worth in COP." },
  { href: "/career", label: "Career", icon: Briefcase, description: "Applications, skills, projects and learning." },
  { href: "/physical", label: "Training", icon: Dumbbell, description: "Physical and study training: sessions, practice exams, progress and measurements." },
  { href: "/archive", label: "Life archive", icon: Archive, description: "Memories, chapters, documents and on this day." },
  { href: "/analytics", label: "Life analytics", icon: LineChart, description: "How every area of your life changes, without judgment." },
  { href: "/settings", label: "Settings", icon: Settings, description: "Profile, appearance, privacy and your data." },
];
