import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seed de datos iniciales para FlyWise ---');

  // 1. Administrador inicial
  const passwordHash = await bcrypt.hash('admin123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@flywise.com' },
    update: {},
    create: {
      email: 'admin@flywise.com',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`✓ Administrador inicial creado: ${admin.email}`);

  // 2. Países clave
  const countriesData = [
    { name: 'Argentina', isoCode: 'AR', dafifCode: 'AR' },
    { name: 'United States', isoCode: 'US', dafifCode: 'US' },
    { name: 'Spain', isoCode: 'ES', dafifCode: 'SP' },
    { name: 'United Kingdom', isoCode: 'GB', dafifCode: 'UK' },
    { name: 'Japan', isoCode: 'JP', dafifCode: 'JA' },
    { name: 'Brazil', isoCode: 'BR', dafifCode: 'BR' },
    { name: 'Chile', isoCode: 'CL', dafifCode: 'CI' },
    { name: 'France', isoCode: 'FR', dafifCode: 'FR' },
    { name: 'Germany', isoCode: 'DE', dafifCode: 'GM' },
    { name: 'United Arab Emirates', isoCode: 'AE', dafifCode: 'AE' },
    { name: 'Singapore', isoCode: 'SG', dafifCode: 'SN' },
  ];

  for (const c of countriesData) {
    await prisma.country.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }
  console.log(`✓ ${countriesData.length} países creados.`);

  // 3. Aeropuertos Hubs Globales
  const airportsData = [
    {
      openflightsId: 3988,
      name: 'Ministro Pistarini International Airport',
      city: 'Buenos Aires',
      countryName: 'Argentina',
      iata: 'EZE',
      icao: 'SAEZ',
      latitude: -34.8222,
      longitude: -58.5358,
      altitudeFt: 67,
      routeCount: 140,
    },
    {
      openflightsId: 3576,
      name: 'Miami International Airport',
      city: 'Miami',
      countryName: 'United States',
      iata: 'MIA',
      icao: 'KMIA',
      latitude: 25.7959,
      longitude: -80.2906,
      altitudeFt: 8,
      routeCount: 220,
    },
    {
      openflightsId: 3797,
      name: 'John F Kennedy International Airport',
      city: 'New York',
      countryName: 'United States',
      iata: 'JFK',
      icao: 'KJFK',
      latitude: 40.6398,
      longitude: -73.7789,
      altitudeFt: 13,
      routeCount: 310,
    },
    {
      openflightsId: 1229,
      name: 'Adolfo Suárez Madrid–Barajas Airport',
      city: 'Madrid',
      countryName: 'Spain',
      iata: 'MAD',
      icao: 'LEMD',
      latitude: 40.4719,
      longitude: -3.5626,
      altitudeFt: 2000,
      routeCount: 260,
    },
    {
      openflightsId: 507,
      name: 'London Heathrow Airport',
      city: 'London',
      countryName: 'United Kingdom',
      iata: 'LHR',
      icao: 'EGLL',
      latitude: 51.4706,
      longitude: -0.4619,
      altitudeFt: 83,
      routeCount: 380,
    },
    {
      openflightsId: 2279,
      name: 'Tokyo Haneda International Airport',
      city: 'Tokyo',
      countryName: 'Japan',
      iata: 'HND',
      icao: 'RJTT',
      latitude: 35.5523,
      longitude: 139.7797,
      altitudeFt: 21,
      routeCount: 250,
    },
    {
      openflightsId: 2564,
      name: 'São Paulo/Guarulhos–Governador André Franco Montoro International Airport',
      city: 'São Paulo',
      countryName: 'Brazil',
      iata: 'GRU',
      icao: 'SBGR',
      latitude: -23.4356,
      longitude: -46.4731,
      altitudeFt: 2461,
      routeCount: 210,
    },
    {
      openflightsId: 2688,
      name: 'Arturo Merino Benítez International Airport',
      city: 'Santiago',
      countryName: 'Chile',
      iata: 'SCL',
      icao: 'SCEL',
      latitude: -33.393,
      longitude: -70.7858,
      altitudeFt: 1555,
      routeCount: 110,
    },
    {
      openflightsId: 1382,
      name: 'Charles de Gaulle International Airport',
      city: 'Paris',
      countryName: 'France',
      iata: 'CDG',
      icao: 'LFPG',
      latitude: 49.0128,
      longitude: 2.55,
      altitudeFt: 392,
      routeCount: 350,
    },
    {
      openflightsId: 340,
      name: 'Frankfurt am Main Airport',
      city: 'Frankfurt',
      countryName: 'Germany',
      iata: 'FRA',
      icao: 'EDDF',
      latitude: 50.0333,
      longitude: 8.5706,
      altitudeFt: 364,
      routeCount: 360,
    },
    {
      openflightsId: 2188,
      name: 'Dubai International Airport',
      city: 'Dubai',
      countryName: 'United Arab Emirates',
      iata: 'DXB',
      icao: 'OMDB',
      latitude: 25.2528,
      longitude: 55.3644,
      altitudeFt: 62,
      routeCount: 320,
    },
    {
      openflightsId: 3316,
      name: 'Singapore Changi Airport',
      city: 'Singapore',
      countryName: 'Singapore',
      iata: 'SIN',
      icao: 'WSSS',
      latitude: 1.3502,
      longitude: 103.9944,
      altitudeFt: 22,
      routeCount: 300,
    },
  ];

  const airportMap = new Map<string, string>();
  for (const a of airportsData) {
    const created = await prisma.airport.upsert({
      where: { openflightsId: a.openflightsId },
      update: a,
      create: a,
    });
    airportMap.set(a.iata, created.id);
  }
  console.log(`✓ ${airportsData.length} aeropuertos clave creados.`);

  // 4. Aerolíneas Globales
  const airlinesData = [
    {
      openflightsId: 257,
      name: 'Aerolineas Argentinas',
      iata: 'AR',
      icao: 'ARG',
      callsign: 'ARGENTINA',
      country: 'Argentina',
      active: true,
    },
    {
      openflightsId: 24,
      name: 'American Airlines',
      iata: 'AA',
      icao: 'AAL',
      callsign: 'AMERICAN',
      country: 'United States',
      active: true,
    },
    {
      openflightsId: 2822,
      name: 'Iberia',
      iata: 'IB',
      icao: 'IBE',
      callsign: 'IBERIA',
      country: 'Spain',
      active: true,
    },
    {
      openflightsId: 1355,
      name: 'British Airways',
      iata: 'BA',
      icao: 'BAW',
      callsign: 'SPEEDBIRD',
      country: 'United Kingdom',
      active: true,
    },
    {
      openflightsId: 324,
      name: 'Air France',
      iata: 'AF',
      icao: 'AFR',
      callsign: 'AIRFRANS',
      country: 'France',
      active: true,
    },
    {
      openflightsId: 3320,
      name: 'Lufthansa',
      iata: 'LH',
      icao: 'DLH',
      callsign: 'LUFTHANSA',
      country: 'Germany',
      active: true,
    },
    {
      openflightsId: 2183,
      name: 'Emirates',
      iata: 'EK',
      icao: 'UAE',
      callsign: 'EMIRATES',
      country: 'United Arab Emirates',
      active: true,
    },
    {
      openflightsId: 4547,
      name: 'Singapore Airlines',
      iata: 'SQ',
      icao: 'SIA',
      callsign: 'SINGAPORE',
      country: 'Singapore',
      active: true,
    },
    {
      openflightsId: 3200,
      name: 'LATAM Airlines',
      iata: 'LA',
      icao: 'LAN',
      callsign: 'LAN CHILE',
      country: 'Chile',
      active: true,
    },
    {
      openflightsId: 3000,
      name: 'Japan Airlines',
      iata: 'JL',
      icao: 'JAL',
      callsign: 'JAPANAIR',
      country: 'Japan',
      active: true,
    },
  ];

  const airlineMap = new Map<string, string>();
  for (const al of airlinesData) {
    const created = await prisma.airline.upsert({
      where: { openflightsId: al.openflightsId },
      update: al,
      create: al,
    });
    airlineMap.set(al.iata, created.id);
  }
  console.log(`✓ ${airlinesData.length} aerolíneas creadas.`);

  // 5. Red Top 100 Rutas Intercontinentales (Grandes Corredores Aéreos)
  const routesData = [
    { origin: 'EZE', dest: 'MIA', airline: 'AR', distKm: 7098.5 },
    { origin: 'MIA', dest: 'EZE', airline: 'AA', distKm: 7098.5 },
    { origin: 'EZE', dest: 'MAD', airline: 'IB', distKm: 10075.2 },
    { origin: 'MAD', dest: 'EZE', airline: 'AR', distKm: 10075.2 },
    { origin: 'EZE', dest: 'JFK', airline: 'AA', distKm: 8529.1 },
    { origin: 'EZE', dest: 'GRU', airline: 'AR', distKm: 1722.0 },
    { origin: 'GRU', dest: 'EZE', airline: 'LA', distKm: 1722.0 },
    { origin: 'SCL', dest: 'EZE', airline: 'LA', distKm: 1150.3 },
    { origin: 'GRU', dest: 'MIA', airline: 'AA', distKm: 6592.4 },
    { origin: 'JFK', dest: 'LHR', airline: 'BA', distKm: 5556.2 },
    { origin: 'LHR', dest: 'JFK', airline: 'AA', distKm: 5556.2 },
    { origin: 'CDG', dest: 'JFK', airline: 'AF', distKm: 5837.1 },
    { origin: 'MAD', dest: 'MIA', airline: 'IB', distKm: 7105.0 },
    { origin: 'LHR', dest: 'DXB', airline: 'EK', distKm: 5498.0 },
    { origin: 'DXB', dest: 'LHR', airline: 'BA', distKm: 5498.0 },
    { origin: 'FRA', dest: 'SIN', airline: 'LH', distKm: 10278.4 },
    { origin: 'SIN', dest: 'HND', airline: 'SQ', distKm: 5313.2 },
    { origin: 'HND', dest: 'JFK', airline: 'JL', distKm: 10860.5 },
    { origin: 'DXB', dest: 'SIN', airline: 'EK', distKm: 5845.0 },
    { origin: 'CDG', dest: 'DXB', airline: 'AF', distKm: 5248.0 },
  ];

  await prisma.route.deleteMany({});

  for (const r of routesData) {
    const originId = airportMap.get(r.origin);
    const destId = airportMap.get(r.dest);
    const airlineId = airlineMap.get(r.airline);

    if (originId && destId) {
      await prisma.route.create({
        data: {
          airlineCode: r.airline,
          airlineId,
          originIata: r.origin,
          originId,
          destinationIata: r.dest,
          destinationId: destId,
          distanceKm: r.distKm,
          distanceNm: Math.round(r.distKm / 1.852),
          popularityScore: 19.5,
          isTop100: true,
          stops: 0,
        },
      });
    }
  }
  console.log(`✓ ${routesData.length} rutas Top 100 iniciales creadas.`);
  console.log('--- Seed finalizado exitosamente ---');
}

main()
  .catch((e) => {
    console.error('Error durante seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
