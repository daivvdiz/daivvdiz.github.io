"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { saveProfile } from "@/lib/profile/actions";
import { profileSchema, type ProfileInput } from "@/lib/profile/schema";

const ZONES = ["America/Bogota", "America/Mexico_City", "America/Lima", "America/New_York", "America/Santiago", "America/Argentina/Buenos_Aires", "Europe/Madrid", "UTC"];

export function ProfileForm({ initial, email }: { initial: ProfileInput; email: string }) {
  const { register, handleSubmit, formState } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });

  const onSubmit = handleSubmit(async (v) => {
    const res = await saveProfile(v);
    if (res.ok) toast.success("Perfil guardado");
    else toast.error(res.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Nombre</Label>
        <Input id="full_name" {...register("full_name")} placeholder="¿Cómo quieres que te salude?" />
        <FieldError message={formState.errors.full_name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Zona horaria</Label>
        <Select id="timezone" {...register("timezone")}>
          {ZONES.map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">Moneda</Label>
        <Select id="currency" {...register("currency")}>
          <option value="COP">Peso colombiano (COP)</option>
          <option value="USD">Dólar (USD)</option>
          <option value="EUR">Euro (EUR)</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="week_starts_on">La semana empieza el</Label>
        <Select id="week_starts_on" {...register("week_starts_on")}>
          <option value={1}>Lunes</option>
          <option value={0}>Domingo</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="default_period">Periodo de analítica por defecto</Label>
        <Select id="default_period" {...register("default_period")}>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
          <option value="180d">Últimos 6 meses</option>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Guardando…" : "Guardar perfil"}</Button>
      </div>
    </form>
  );
}
