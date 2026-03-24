/**
 * Seed complet : clients + visites (historique 3 mois) + rendez-vous
 * Usage : npx ts-node src/seed-data.ts
 */
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/dany1st';

// ─── Schémas ────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema(
  {
    firstName: String, lastName: String, email: { type: String, unique: true, lowercase: true },
    password: String, phone: String, role: { type: String, default: 'client' },
    loyaltyPoints: { type: Number, default: 0 }, visitCount: { type: Number, default: 0 },
    loyaltyTier: { type: String, default: 'bronze' }, favoriteStyle: String,
    preferences: String, birthDate: Date, birthdayBonusClaimedThisYear: { type: Boolean, default: false },
    referralCode: String, referredBy: String, referralCount: { type: Number, default: 0 },
    lastVisitAt: Date,
  },
  { timestamps: true },
);

const VisitSchema = new mongoose.Schema(
  {
    clientId: String, clientName: String, serviceType: String,
    price: Number, notes: String,
    paymentMethod: { type: String, enum: ['especes', 'virement', 'en_ligne'], default: 'especes' },
    visitDate: String,
  },
  { timestamps: true },
);

const AppointmentSchema = new mongoose.Schema(
  {
    clientId: String, clientName: String, clientEmail: String,
    serviceType: String, date: String, time: String,
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
    notes: String,
    paymentMethod: { type: String, enum: ['especes', 'virement', 'en_ligne'], default: 'especes' },
  },
  { timestamps: true },
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeTier(visits: number): string {
  if (visits >= 30) return 'platinum';
  if (visits >= 15) return 'gold';
  if (visits >= 5)  return 'silver';
  return 'bronze';
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SERVICES = [
  { name: 'Coupe',           price: 20, points: 10 },
  { name: 'Coupe + Dégradé', price: 22, points: 12 },
  { name: 'Coupe + Barbe',   price: 30, points: 15 },
  { name: 'Barbe seule',     price: 15, points: 8  },
  { name: 'Dégradé',         price: 18, points: 9  },
  { name: 'Coupe enfant',    price: 15, points: 8  },
];

const PAYMENTS: ('especes' | 'virement' | 'en_ligne')[] = ['especes', 'especes', 'especes', 'virement', 'en_ligne'];

const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];

// ─── Données clients ─────────────────────────────────────────────────────────

const CLIENTS = [
  { firstName: 'Karim',   lastName: 'Benzara',  email: 'karim.b@gmail.com',   visits: 34, points: 380, style: 'Dégradé propre + tempes rasées', referrals: 3, daysAgo: 150, phone: '0612345678' },
  { firstName: 'Jordan',  lastName: 'Mbaye',    email: 'jordan.m@gmail.com',  visits: 31, points: 340, style: 'Afro taillé court',                referrals: 2, daysAgo: 170, phone: '0623456789' },
  { firstName: 'Thomas',  lastName: 'Lecomte',  email: 'thomas.l@gmail.com',  visits: 22, points: 240, style: 'Coupe classique avec raie',        referrals: 1, daysAgo: 120, phone: '0634567890' },
  { firstName: 'Yassine', lastName: 'Hamidi',   email: 'yassine.h@gmail.com', visits: 18, points: 195, style: 'Fade bas + barbe dessinée',         referrals: 0, daysAgo: 90,  phone: '0645678901' },
  { firstName: 'Lucas',   lastName: 'Ferreira', email: 'lucas.f@gmail.com',   visits: 16, points: 170, style: 'Buzz cut + dégradé',                referrals: 2, daysAgo: 95,  phone: '0656789012' },
  { firstName: 'Mehdi',   lastName: 'Ouali',    email: 'mehdi.o@gmail.com',   visits: 12, points: 130, style: 'Mid fade',                          referrals: 1, daysAgo: 60,  phone: '0667890123' },
  { firstName: 'Kevin',   lastName: 'Dupont',   email: 'kevin.d@gmail.com',   visits: 9,  points: 95,  style: 'Coupe texturée',                    referrals: 0, daysAgo: 45,  phone: '0678901234' },
  { firstName: 'Axel',    lastName: 'Martin',   email: 'axel.m@gmail.com',    visits: 7,  points: 75,  style: 'Pompadour dégradé',                 referrals: 1, daysAgo: 30,  phone: '0689012345' },
  { firstName: 'Bryan',   lastName: 'Ndiaye',   email: 'bryan.n@gmail.com',   visits: 6,  points: 60,  style: 'High fade + design',                referrals: 0, daysAgo: 55,  phone: '0690123456' },
  { firstName: 'Julien',  lastName: 'Petit',    email: 'julien.p@gmail.com',  visits: 5,  points: 55,  style: 'Classique court',                   referrals: 0, daysAgo: 40,  phone: '0601234567' },
  { firstName: 'Rayan',   lastName: 'Chouaib',  email: 'rayan.c@gmail.com',   visits: 4,  points: 40,  style: '',                                  referrals: 0, daysAgo: 25,  phone: '0611111111' },
  { firstName: 'Matteo',  lastName: 'Romano',   email: 'matteo.r@gmail.com',  visits: 3,  points: 30,  style: 'Dégradé simple',                    referrals: 0, daysAgo: 20,  phone: '0622222222' },
  { firstName: 'Samir',   lastName: 'Belkaid',  email: 'samir.b@gmail.com',   visits: 2,  points: 20,  style: '',                                  referrals: 0, daysAgo: 15,  phone: '0633333333' },
  { firstName: 'Antoine', lastName: 'Girard',   email: 'antoine.g@gmail.com', visits: 2,  points: 20,  style: 'Undercut',                          referrals: 0, daysAgo: 10,  phone: '0644444444' },
  { firstName: 'Nolan',   lastName: 'Bernard',  email: 'nolan.be@gmail.com',  visits: 1,  points: 10,  style: '',                                  referrals: 0, daysAgo: 8,   phone: '0655555555' },
  { firstName: 'Ilyes',   lastName: 'Kaci',     email: 'ilyes.k@gmail.com',   visits: 1,  points: 10,  style: '',                                  referrals: 0, daysAgo: 5,   phone: '0666666666' },
  { firstName: 'Hugo',    lastName: 'Laurent',  email: 'hugo.la@gmail.com',   visits: 0,  points: 0,   style: '',                                  referrals: 0, daysAgo: 3,   phone: '0677777777' },
  { firstName: 'Théo',    lastName: 'Simon',    email: 'theo.si@gmail.com',   visits: 0,  points: 0,   style: '',                                  referrals: 0, daysAgo: 2,   phone: '0688888888' },
];

// ─── Seed principal ──────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connecté à MongoDB\n');

  const User        = mongoose.model('User',        UserSchema);
  const Visit       = mongoose.model('Visit',       VisitSchema);
  const Appointment = mongoose.model('Appointment', AppointmentSchema);

  const hashedPassword = await bcrypt.hash('client1234', 10);

  // ── 1. Clients ──────────────────────────────────────────────────────────
  console.log('── Clients ──────────────────────────────────────────');
  const userMap = new Map<string, { id: string; fullName: string; email: string }>();

  for (const c of CLIENTS) {
    let user = await User.findOne({ email: c.email });
    if (!user) {
      const lastVisitAt = c.visits > 0 ? daysAgo(Math.floor(Math.random() * c.daysAgo)) : undefined;
      const createdAt   = daysAgo(c.daysAgo + 5);
      user = await User.create({
        firstName: c.firstName, lastName: c.lastName, email: c.email,
        password: hashedPassword, phone: c.phone, role: 'client',
        loyaltyPoints: c.points, visitCount: c.visits,
        loyaltyTier: computeTier(c.visits),
        favoriteStyle: c.style || undefined,
        referralCode: uuidv4().substring(0, 8).toUpperCase(),
        referralCount: c.referrals,
        lastVisitAt, createdAt, updatedAt: createdAt,
      });
      console.log(`  ✅ ${c.firstName} ${c.lastName} (${computeTier(c.visits)})`);
    } else {
      console.log(`  ⏭  ${c.firstName} ${c.lastName} (déjà existant)`);
    }
    userMap.set(c.email, { id: user._id.toString(), fullName: `${c.firstName} ${c.lastName}`, email: c.email });
  }

  // ── 2. Visites passées (3 mois d'historique) ─────────────────────────
  console.log('\n── Visites ──────────────────────────────────────────');
  const existingVisits = await Visit.countDocuments();
  if (existingVisits > 0) {
    console.log(`  ⏭  ${existingVisits} visite(s) déjà présente(s), skip.`);
  } else {
    // Visites des clients inscrits
    const visitDefs: Array<{ email: string; daysBack: number; serviceIdx: number; payment: 'especes' | 'virement' | 'en_ligne' }> = [
      // Karim — 8 visites sur 3 mois
      { email:'karim.b@gmail.com',   daysBack: 3,  serviceIdx:1, payment:'especes'  },
      { email:'karim.b@gmail.com',   daysBack: 18, serviceIdx:1, payment:'virement' },
      { email:'karim.b@gmail.com',   daysBack: 35, serviceIdx:0, payment:'especes'  },
      { email:'karim.b@gmail.com',   daysBack: 52, serviceIdx:1, payment:'especes'  },
      { email:'karim.b@gmail.com',   daysBack: 69, serviceIdx:2, payment:'en_ligne' },
      { email:'karim.b@gmail.com',   daysBack: 83, serviceIdx:1, payment:'especes'  },
      { email:'karim.b@gmail.com',   daysBack: 74, serviceIdx:4, payment:'especes'  },
      { email:'karim.b@gmail.com',   daysBack: 60, serviceIdx:0, payment:'virement' },
      // Jordan — 7 visites
      { email:'jordan.m@gmail.com',  daysBack: 5,  serviceIdx:0, payment:'especes'  },
      { email:'jordan.m@gmail.com',  daysBack: 20, serviceIdx:4, payment:'especes'  },
      { email:'jordan.m@gmail.com',  daysBack: 38, serviceIdx:0, payment:'en_ligne' },
      { email:'jordan.m@gmail.com',  daysBack: 55, serviceIdx:2, payment:'especes'  },
      { email:'jordan.m@gmail.com',  daysBack: 70, serviceIdx:0, payment:'virement' },
      { email:'jordan.m@gmail.com',  daysBack: 80, serviceIdx:4, payment:'especes'  },
      { email:'jordan.m@gmail.com',  daysBack: 88, serviceIdx:0, payment:'especes'  },
      // Thomas — 6 visites
      { email:'thomas.l@gmail.com',  daysBack: 7,  serviceIdx:0, payment:'especes'  },
      { email:'thomas.l@gmail.com',  daysBack: 22, serviceIdx:2, payment:'virement' },
      { email:'thomas.l@gmail.com',  daysBack: 40, serviceIdx:0, payment:'especes'  },
      { email:'thomas.l@gmail.com',  daysBack: 58, serviceIdx:1, payment:'especes'  },
      { email:'thomas.l@gmail.com',  daysBack: 75, serviceIdx:0, payment:'en_ligne' },
      { email:'thomas.l@gmail.com',  daysBack: 85, serviceIdx:2, payment:'especes'  },
      // Yassine — 5 visites
      { email:'yassine.h@gmail.com', daysBack: 10, serviceIdx:2, payment:'especes'  },
      { email:'yassine.h@gmail.com', daysBack: 25, serviceIdx:3, payment:'especes'  },
      { email:'yassine.h@gmail.com', daysBack: 44, serviceIdx:2, payment:'virement' },
      { email:'yassine.h@gmail.com', daysBack: 62, serviceIdx:3, payment:'especes'  },
      { email:'yassine.h@gmail.com', daysBack: 79, serviceIdx:2, payment:'especes'  },
      // Lucas — 5 visites
      { email:'lucas.f@gmail.com',   daysBack: 12, serviceIdx:4, payment:'especes'  },
      { email:'lucas.f@gmail.com',   daysBack: 28, serviceIdx:1, payment:'en_ligne' },
      { email:'lucas.f@gmail.com',   daysBack: 47, serviceIdx:4, payment:'especes'  },
      { email:'lucas.f@gmail.com',   daysBack: 65, serviceIdx:0, payment:'especes'  },
      { email:'lucas.f@gmail.com',   daysBack: 82, serviceIdx:1, payment:'virement' },
      // Mehdi — 4 visites
      { email:'mehdi.o@gmail.com',   daysBack: 14, serviceIdx:2, payment:'especes'  },
      { email:'mehdi.o@gmail.com',   daysBack: 32, serviceIdx:3, payment:'especes'  },
      { email:'mehdi.o@gmail.com',   daysBack: 50, serviceIdx:2, payment:'especes'  },
      { email:'mehdi.o@gmail.com',   daysBack: 68, serviceIdx:0, payment:'en_ligne' },
      // Kevin — 3 visites
      { email:'kevin.d@gmail.com',   daysBack: 16, serviceIdx:0, payment:'especes'  },
      { email:'kevin.d@gmail.com',   daysBack: 36, serviceIdx:1, payment:'especes'  },
      { email:'kevin.d@gmail.com',   daysBack: 57, serviceIdx:0, payment:'virement' },
      // Axel — 3 visites
      { email:'axel.m@gmail.com',    daysBack: 8,  serviceIdx:1, payment:'especes'  },
      { email:'axel.m@gmail.com',    daysBack: 30, serviceIdx:0, payment:'especes'  },
      { email:'axel.m@gmail.com',    daysBack: 55, serviceIdx:1, payment:'en_ligne' },
      // Bryan — 2 visites
      { email:'bryan.n@gmail.com',   daysBack: 20, serviceIdx:4, payment:'especes'  },
      { email:'bryan.n@gmail.com',   daysBack: 48, serviceIdx:0, payment:'especes'  },
      // Julien — 2 visites
      { email:'julien.p@gmail.com',  daysBack: 15, serviceIdx:0, payment:'especes'  },
      { email:'julien.p@gmail.com',  daysBack: 45, serviceIdx:2, payment:'virement' },
      // Rayan — 2 visites
      { email:'rayan.c@gmail.com',   daysBack: 22, serviceIdx:0, payment:'especes'  },
      { email:'rayan.c@gmail.com',   daysBack: 60, serviceIdx:4, payment:'especes'  },
      // Matteo — 2 visites
      { email:'matteo.r@gmail.com',  daysBack: 18, serviceIdx:4, payment:'especes'  },
      { email:'matteo.r@gmail.com',  daysBack: 50, serviceIdx:0, payment:'especes'  },
      // Samir — 1 visite
      { email:'samir.b@gmail.com',   daysBack: 14, serviceIdx:0, payment:'especes'  },
      // Antoine — 1 visite
      { email:'antoine.g@gmail.com', daysBack: 9,  serviceIdx:1, payment:'especes'  },
      // Nolan — 1 visite
      { email:'nolan.be@gmail.com',  daysBack: 7,  serviceIdx:0, payment:'especes'  },
      // Ilyes — 1 visite
      { email:'ilyes.k@gmail.com',   daysBack: 4,  serviceIdx:5, payment:'especes'  },
    ];

    // Walk-ins supplémentaires (sans compte client)
    const walkIns = [
      { daysBack: 1,  serviceIdx: 0, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 3,  serviceIdx: 2, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 6,  serviceIdx: 1, payment: 'virement' as const, name: 'Client walk-in' },
      { daysBack: 11, serviceIdx: 0, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 17, serviceIdx: 4, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 24, serviceIdx: 3, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 31, serviceIdx: 0, payment: 'en_ligne' as const, name: 'Client walk-in' },
      { daysBack: 43, serviceIdx: 1, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 53, serviceIdx: 0, payment: 'especes'  as const, name: 'Client walk-in' },
      { daysBack: 66, serviceIdx: 2, payment: 'especes'  as const, name: 'Client walk-in' },
    ];

    let count = 0;
    for (const v of visitDefs) {
      const user = userMap.get(v.email);
      if (!user) continue;
      const svc = SERVICES[v.serviceIdx];
      const d = daysAgo(v.daysBack);
      await Visit.create({
        clientId: user.id,
        serviceType: svc.name,
        price: svc.price,
        paymentMethod: v.payment,
        visitDate: dateStr(d),
        createdAt: d, updatedAt: d,
      });
      count++;
    }

    for (const w of walkIns) {
      const svc = SERVICES[w.serviceIdx];
      const d = daysAgo(w.daysBack);
      await Visit.create({
        clientId: 'walk-in',
        clientName: w.name,
        serviceType: svc.name,
        price: svc.price,
        paymentMethod: w.payment,
        visitDate: dateStr(d),
        createdAt: d, updatedAt: d,
      });
      count++;
    }
    console.log(`  ✅ ${count} visite(s) créée(s)`);
  }

  // ── 3. Rendez-vous ────────────────────────────────────────────────────
  console.log('\n── Rendez-vous ──────────────────────────────────────');
  const existingAppts = await Appointment.countDocuments();
  if (existingAppts > 0) {
    console.log(`  ⏭  ${existingAppts} rendez-vous déjà présent(s), skip.`);
  } else {
    // Rendez-vous futurs (à venir)
    const future = [
      { email:'karim.b@gmail.com',   daysAhead: 2,  time:'10:00', serviceIdx:1, status:'confirmed', payment:'especes'  as const },
      { email:'thomas.l@gmail.com',  daysAhead: 2,  time:'11:30', serviceIdx:0, status:'confirmed', payment:'especes'  as const },
      { email:'yassine.h@gmail.com', daysAhead: 3,  time:'14:00', serviceIdx:2, status:'pending',   payment:'especes'  as const },
      { email:'jordan.m@gmail.com',  daysAhead: 3,  time:'15:30', serviceIdx:0, status:'confirmed', payment:'en_ligne' as const },
      { email:'lucas.f@gmail.com',   daysAhead: 4,  time:'09:30', serviceIdx:4, status:'pending',   payment:'especes'  as const },
      { email:'mehdi.o@gmail.com',   daysAhead: 5,  time:'16:00', serviceIdx:2, status:'confirmed', payment:'virement' as const },
      { email:'kevin.d@gmail.com',   daysAhead: 7,  time:'10:30', serviceIdx:0, status:'pending',   payment:'especes'  as const },
      { email:'axel.m@gmail.com',    daysAhead: 7,  time:'14:30', serviceIdx:1, status:'confirmed', payment:'especes'  as const },
      { email:'nolan.be@gmail.com',  daysAhead: 9,  time:'09:00', serviceIdx:5, status:'pending',   payment:'especes'  as const },
      { email:'bryan.n@gmail.com',   daysAhead: 10, time:'11:00', serviceIdx:4, status:'pending',   payment:'especes'  as const },
      { email:'julien.p@gmail.com',  daysAhead: 12, time:'15:00', serviceIdx:0, status:'confirmed', payment:'especes'  as const },
      { email:'hugo.la@gmail.com',   daysAhead: 14, time:'10:00', serviceIdx:0, status:'pending',   payment:'especes'  as const },
      { email:'theo.si@gmail.com',   daysAhead: 14, time:'16:30', serviceIdx:2, status:'pending',   payment:'en_ligne' as const },
    ];

    // Rendez-vous passés (récents)
    const past = [
      { email:'rayan.c@gmail.com',   daysBack: 1, time:'09:30', serviceIdx:0, status:'confirmed', payment:'especes'  as const },
      { email:'matteo.r@gmail.com',  daysBack: 2, time:'14:00', serviceIdx:4, status:'confirmed', payment:'especes'  as const },
      { email:'samir.b@gmail.com',   daysBack: 3, time:'11:00', serviceIdx:0, status:'cancelled', payment:'especes'  as const },
      { email:'ilyes.k@gmail.com',   daysBack: 4, time:'15:30', serviceIdx:5, status:'confirmed', payment:'especes'  as const },
      { email:'antoine.g@gmail.com', daysBack: 5, time:'10:30', serviceIdx:1, status:'confirmed', payment:'virement' as const },
    ];

    let count = 0;
    const futureDate = (n: number) => {
      const d = new Date(Date.now() + n * 86_400_000);
      return dateStr(d);
    };

    for (const a of future) {
      const user = userMap.get(a.email);
      if (!user) continue;
      const svc = SERVICES[a.serviceIdx];
      await Appointment.create({
        clientId: user.id, clientName: user.fullName, clientEmail: user.email,
        serviceType: svc.name, date: futureDate(a.daysAhead), time: a.time,
        status: a.status, paymentMethod: a.payment,
      });
      count++;
    }

    for (const a of past) {
      const user = userMap.get(a.email);
      if (!user) continue;
      const svc = SERVICES[a.serviceIdx];
      const d = daysAgo(a.daysBack);
      await Appointment.create({
        clientId: user.id, clientName: user.fullName, clientEmail: user.email,
        serviceType: svc.name, date: dateStr(d), time: a.time,
        status: a.status, paymentMethod: a.payment,
        createdAt: d, updatedAt: d,
      });
      count++;
    }
    console.log(`  ✅ ${count} rendez-vous créé(s)`);
  }

  console.log('\n✅ Seed terminé.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
