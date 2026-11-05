-- Install after Prisma creates the aeropuertos table.
CREATE OR REPLACE TRIGGER airports_sync_location
BEFORE INSERT OR UPDATE ON public.aeropuertos
FOR EACH ROW EXECUTE FUNCTION public.sync_airport_location();
