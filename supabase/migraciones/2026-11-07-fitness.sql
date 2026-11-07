-- Opcional: renombra los registros antiguos de "gimnasio" a "fitness".
-- La app ya los muestra en Fitness aunque no ejecutes esto.
update public.registros set categoria = 'fitness' where categoria = 'gimnasio';
update public.registros set unidad = 'kg'
  where categoria = 'fitness' and (unidad is null or unidad = 'peso');
