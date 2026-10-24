-- Install after Prisma creates the airports table.
CREATE OR REPLACE TRIGGER airports_sync_location
BEFORE INSERT OR UPDATE ON public.airports
FOR EACH ROW EXECUTE FUNCTION public.sync_airport_location();
