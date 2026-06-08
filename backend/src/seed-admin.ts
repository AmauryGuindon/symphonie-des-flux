import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/datacut';

// ── Modifie ces valeurs avant de lancer le script ──────────────────────────
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME  = 'DataCut';
const ADMIN_EMAIL      = 'admin@datacut.fr';
const ADMIN_PASSWORD   = 'Admin2024!';
// ───────────────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  role:       { type: String, default: 'client' },
  loyaltyPoints: { type: Number, default: 0 },
  visitCount:    { type: Number, default: 0 },
  loyaltyTier:   { type: String, default: 'bronze' },
  referralCode:  { type: String },
  referralCount: { type: Number, default: 0 },
  birthdayBonusClaimedThisYear: { type: Boolean, default: false },
}, { timestamps: true });

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connecté à MongoDB');

  const User = mongoose.model('User', UserSchema);

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`⚠️  Un compte existe déjà avec l'email ${ADMIN_EMAIL}`);
    console.log('   Pour réinitialiser, supprime le document dans MongoDB puis relance.');
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await User.create({
    firstName:   ADMIN_FIRST_NAME,
    lastName:    ADMIN_LAST_NAME,
    email:       ADMIN_EMAIL,
    password:    hashedPassword,
    role:        'admin',
    referralCode: uuidv4().substring(0, 8).toUpperCase(),
  });

  console.log('✅ Compte admin créé avec succès !');
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASSWORD}`);
  console.log('   ⚠️  Change le mot de passe depuis le backoffice après la première connexion.');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});
