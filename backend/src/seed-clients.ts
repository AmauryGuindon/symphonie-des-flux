import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/dany1st';

const UserSchema = new mongoose.Schema({
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  phone:      { type: String },
  role:       { type: String, default: 'client' },
  loyaltyPoints:    { type: Number, default: 0 },
  visitCount:       { type: Number, default: 0 },
  loyaltyTier:      { type: String, default: 'bronze' },
  favoriteStyle:    { type: String },
  preferences:      { type: String },
  birthDate:        { type: Date },
  birthdayBonusClaimedThisYear: { type: Boolean, default: false },
  referralCode:     { type: String },
  referredBy:       { type: String },
  referralCount:    { type: Number, default: 0 },
  lastVisitAt:      { type: Date },
}, { timestamps: true });

function computeTier(visits: number): string {
  if (visits >= 30) return 'platinum';
  if (visits >= 15) return 'gold';
  if (visits >= 5)  return 'silver';
  return 'bronze';
}

// Dates de création réparties sur les 6 derniers mois
function randomDateInPast(maxDaysAgo: number, minDaysAgo = 0): Date {
  const ms = (minDaysAgo + Math.random() * (maxDaysAgo - minDaysAgo)) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

const clients = [
  // Platine
  { firstName: 'Karim',    lastName: 'Benzara',   email: 'karim.b@gmail.com',   visits: 34, points: 380, style: 'Dégradé propre + tempes rasées', referrals: 3, daysAgo: 150 },
  { firstName: 'Jordan',   lastName: 'Mbaye',     email: 'jordan.m@gmail.com',  visits: 31, points: 340, style: 'Afro taillé court', referrals: 2, daysAgo: 170 },

  // Or
  { firstName: 'Thomas',   lastName: 'Lecomte',   email: 'thomas.l@gmail.com',  visits: 22, points: 240, style: 'Coupe classique avec raie', referrals: 1, daysAgo: 120 },
  { firstName: 'Yassine',  lastName: 'Hamidi',    email: 'yassine.h@gmail.com', visits: 18, points: 195, style: 'Fade bas + barbe dessinée', referrals: 0, daysAgo: 90 },
  { firstName: 'Lucas',    lastName: 'Ferreira',  email: 'lucas.f@gmail.com',   visits: 16, points: 170, style: 'Buzz cut + dégradé', referrals: 2, daysAgo: 95 },

  // Argent
  { firstName: 'Mehdi',    lastName: 'Ouali',     email: 'mehdi.o@gmail.com',   visits: 12, points: 130, style: 'Mid fade', referrals: 1, daysAgo: 60 },
  { firstName: 'Kevin',    lastName: 'Dupont',    email: 'kevin.d@gmail.com',   visits: 9,  points: 95,  style: 'Coupe texturée', referrals: 0, daysAgo: 45 },
  { firstName: 'Axel',     lastName: 'Martin',    email: 'axel.m@gmail.com',    visits: 7,  points: 75,  style: 'Pompadour dégradé', referrals: 1, daysAgo: 30 },
  { firstName: 'Bryan',    lastName: 'Ndiaye',    email: 'bryan.n@gmail.com',   visits: 6,  points: 60,  style: 'High fade + design', referrals: 0, daysAgo: 55 },
  { firstName: 'Julien',   lastName: 'Petit',     email: 'julien.p@gmail.com',  visits: 5,  points: 55,  style: 'Classique court', referrals: 0, daysAgo: 40 },

  // Bronze
  { firstName: 'Rayan',    lastName: 'Chouaib',   email: 'rayan.c@gmail.com',   visits: 4,  points: 40,  style: '', referrals: 0, daysAgo: 25 },
  { firstName: 'Matteo',   lastName: 'Romano',    email: 'matteo.r@gmail.com',  visits: 3,  points: 30,  style: 'Dégradé simple', referrals: 0, daysAgo: 20 },
  { firstName: 'Samir',    lastName: 'Belkaid',   email: 'samir.b@gmail.com',   visits: 2,  points: 20,  style: '', referrals: 0, daysAgo: 15 },
  { firstName: 'Antoine',  lastName: 'Girard',    email: 'antoine.g@gmail.com', visits: 2,  points: 20,  style: 'Undercut', referrals: 0, daysAgo: 10 },
  { firstName: 'Nolan',    lastName: 'Bernard',   email: 'nolan.be@gmail.com',  visits: 1,  points: 10,  style: '', referrals: 0, daysAgo: 8 },
  { firstName: 'Ilyes',    lastName: 'Kaci',      email: 'ilyes.k@gmail.com',   visits: 1,  points: 10,  style: '', referrals: 0, daysAgo: 5 },
  { firstName: 'Hugo',     lastName: 'Laurent',   email: 'hugo.la@gmail.com',   visits: 0,  points: 0,   style: '', referrals: 0, daysAgo: 3 },
  { firstName: 'Théo',     lastName: 'Simon',     email: 'theo.si@gmail.com',   visits: 0,  points: 0,   style: '', referrals: 0, daysAgo: 2 },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connecté à MongoDB');

  const User = mongoose.model('User', UserSchema);
  const hashedPassword = await bcrypt.hash('client1234', 10);

  let created = 0;
  let skipped = 0;

  for (const c of clients) {
    const existing = await User.findOne({ email: c.email });
    if (existing) { skipped++; continue; }

    const lastVisitAt = c.visits > 0 ? randomDateInPast(c.daysAgo, 1) : undefined;
    const createdAt   = randomDateInPast(c.daysAgo + 5, c.daysAgo);

    await User.create({
      firstName:     c.firstName,
      lastName:      c.lastName,
      email:         c.email,
      password:      hashedPassword,
      role:          'client',
      loyaltyPoints: c.points,
      visitCount:    c.visits,
      loyaltyTier:   computeTier(c.visits),
      favoriteStyle: c.style || undefined,
      referralCode:  uuidv4().substring(0, 8).toUpperCase(),
      referralCount: c.referrals,
      lastVisitAt,
      createdAt,
      updatedAt:     createdAt,
    });
    created++;
    console.log(`✅ ${c.firstName} ${c.lastName} (${computeTier(c.visits)})`);
  }

  console.log(`\n${created} client(s) créé(s), ${skipped} déjà existant(s).`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
