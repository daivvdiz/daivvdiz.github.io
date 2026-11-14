import type { Metadata } from "next";
import { UpcomingModule } from "@/components/upcoming-module";
import { MODULES } from "@/lib/modules";

const mod = MODULES.find((m) => m.href === "/mental-health")!;
export const metadata: Metadata = { title: mod.label };

export default function Page() {
  return <UpcomingModule module={mod} />;
}
