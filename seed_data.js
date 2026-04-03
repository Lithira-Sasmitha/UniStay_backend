const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const RoommatePreference = require('./models/RoommatePreference');
const Property = require('./models/Property');
const Room = require('./models/Room');

// Preference data for each verified student
const STUDENT_PREFERENCES = {
  'it23001144@my.sliit.lk': {  // Kasun Perera
    sleepSchedule: 'night_owl',
    cleanliness: 'moderate',
    noiseLevel: 'moderate',
    studyHabits: 'in_room',
    socialLevel: 'ambivert',
    smoking: 'no',
    drinking: 'occasionally',
    guestPolicy: 'occasional',
    budget: 'moderate',
  },
  'it23112233@my.sliit.lk': {  // Amara Silva
    sleepSchedule: 'early_bird',
    cleanliness: 'very_tidy',
    noiseLevel: 'quiet',
    studyHabits: 'library',
    socialLevel: 'introvert',
    smoking: 'no',
    drinking: 'no',
    guestPolicy: 'no_guests',
    budget: 'low',
  },
  'it22998877@my.sliit.lk': {  // Nuwan Bandara
    sleepSchedule: 'flexible',
    cleanliness: 'moderate',
    noiseLevel: 'lively',
    studyHabits: 'mixed',
    socialLevel: 'extrovert',
    smoking: 'occasionally',
    drinking: 'occasionally',
    guestPolicy: 'open',
    budget: 'high',
  },
  'it23005544@my.sliit.lk': {  // Thisara Gunawardana
    sleepSchedule: 'night_owl',
    cleanliness: 'relaxed',
    noiseLevel: 'moderate',
    studyHabits: 'in_room',
    socialLevel: 'ambivert',
    smoking: 'no',
    drinking: 'no',
    guestPolicy: 'occasional',
    budget: 'moderate',
  },
  'it23006655@my.sliit.lk': {  // Sanduni Perera
    sleepSchedule: 'early_bird',
    cleanliness: 'very_tidy',
    noiseLevel: 'quiet',
    studyHabits: 'library',
    socialLevel: 'ambivert',
    smoking: 'no',
    drinking: 'no',
    guestPolicy: 'occasional',
    budget: 'moderate',
  },
};

// Find or create a boarding owner for seed boardings
async function getOrCreateOwner() {
  let owner = await User.findOne({ role: 'boardingowner' });
  if (owner) return owner;

  owner = new User({
    name: 'Kamal Jayasinghe',
    username: 'kamal.owner@unistay.com',
    email: 'kamal.owner@unistay.com',
    password: 'password123',
    role: 'boardingowner',
    university: 'N/A',
    address: 'Malabe, Colombo',
    age: 42,
    nic: '198212345678',
    phonenumber: '0771234567',
  });
  await owner.save();
  return owner;
}

// Seed boarding properties
const BOARDING_DATA = [
  {
    name: 'UniNest Malabe',
    address: 'No. 45, Malabe Road, Malabe, Colombo 10115',
    description: 'Modern student boarding near SLIIT with all facilities. Walking distance to campus with AC rooms, Wi-Fi, and hot water.',
    rooms: [
      { roomType: 'Single Room (AC)', monthlyRent: 18000, advanceAmount: 18000, totalCapacity: 1, facilities: ['AC', 'Wi-Fi', 'Hot Water', 'Study Table', 'Wardrobe'] },
      { roomType: 'Shared Room (2 Beds)', monthlyRent: 12000, advanceAmount: 12000, totalCapacity: 2, facilities: ['Fan', 'Wi-Fi', 'Hot Water', 'Study Table'] },
      { roomType: 'Triple Room', monthlyRent: 8500, advanceAmount: 8500, totalCapacity: 3, facilities: ['Fan', 'Wi-Fi', 'Shared Bathroom'] },
    ],
  },
  {
    name: 'Scholar\'s Haven',
    address: 'No. 112/A, Kaduwela Road, Malabe, Colombo 10115',
    description: 'Premium boarding facility with gym, study hall, and CCTV security. Ideal for serious students looking for a quiet environment.',
    rooms: [
      { roomType: 'Premium Single', monthlyRent: 28000, advanceAmount: 28000, totalCapacity: 1, facilities: ['AC', 'Wi-Fi', 'Hot Water', 'Attached Bath', 'Mini Fridge', 'Study Table'] },
      { roomType: 'Standard Double', monthlyRent: 15000, advanceAmount: 15000, totalCapacity: 2, facilities: ['AC', 'Wi-Fi', 'Hot Water', 'Study Table'] },
    ],
  },
  {
    name: 'Green View Hostel',
    address: 'No. 78, Pittugala, Malabe, Colombo 10115',
    description: 'Budget-friendly boarding with a garden environment. Home-cooked meals available. Great community of SLIIT students.',
    rooms: [
      { roomType: 'Shared Room (2 Beds)', monthlyRent: 10000, advanceAmount: 10000, totalCapacity: 2, facilities: ['Fan', 'Wi-Fi', 'Hot Water'] },
      { roomType: 'Shared Room (3 Beds)', monthlyRent: 7500, advanceAmount: 7500, totalCapacity: 3, facilities: ['Fan', 'Wi-Fi'] },
      { roomType: 'Single Room', monthlyRent: 14000, advanceAmount: 14000, totalCapacity: 1, facilities: ['Fan', 'Wi-Fi', 'Hot Water', 'Study Table'] },
    ],
  },
  {
    name: 'Campus Edge Residency',
    address: 'No. 23, New Kandy Road, Malabe, Colombo 10115',
    description: 'Top-tier student accommodation with modern amenities. Rooftop lounge, laundry service, and 24/7 security.',
    rooms: [
      { roomType: 'Deluxe Single', monthlyRent: 32000, advanceAmount: 32000, totalCapacity: 1, facilities: ['AC', 'Wi-Fi', 'Hot Water', 'Attached Bath', 'TV', 'Mini Kitchen'] },
      { roomType: 'Twin Sharing', monthlyRent: 20000, advanceAmount: 20000, totalCapacity: 2, facilities: ['AC', 'Wi-Fi', 'Hot Water', 'Study Table', 'Wardrobe'] },
    ],
  },
  {
    name: 'Lotus Student Lodge',
    address: 'No. 56/B, Athurugiriya Road, Malabe, Colombo 10115',
    description: 'Affordable and comfortable boarding for students. Close to main bus route. Meals package available at extra cost.',
    rooms: [
      { roomType: 'Economy Shared (4 Beds)', monthlyRent: 6000, advanceAmount: 6000, totalCapacity: 4, facilities: ['Fan', 'Wi-Fi'] },
      { roomType: 'Standard Shared (2 Beds)', monthlyRent: 9000, advanceAmount: 9000, totalCapacity: 2, facilities: ['Fan', 'Wi-Fi', 'Study Table'] },
      { roomType: 'Single Room', monthlyRent: 13000, advanceAmount: 13000, totalCapacity: 1, facilities: ['Fan', 'Wi-Fi', 'Hot Water', 'Study Table'] },
    ],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Seed Preferences
    console.log('\n--- Seeding Preferences ---');
    for (const [username, prefs] of Object.entries(STUDENT_PREFERENCES)) {
      const user = await User.findOne({ username });
      if (!user) {
        console.log(`  ✗ User ${username} not found — skipped`);
        continue;
      }
      await RoommatePreference.findOneAndUpdate(
        { user: user._id },
        { user: user._id, ...prefs, completedAt: new Date() },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Preferences saved for ${user.name}`);
    }

    // 2. Seed Boardings
    console.log('\n--- Seeding Boardings ---');
    const owner = await getOrCreateOwner();
    console.log(`  Owner: ${owner.name} (${owner._id})`);

    for (const data of BOARDING_DATA) {
      const existing = await Property.findOne({ name: data.name });
      if (existing) {
        console.log(`  ○ "${data.name}" already exists — skipped`);
        continue;
      }

      const property = await Property.create({
        name: data.name,
        address: data.address,
        description: data.description,
        owner: owner._id,
        photos: [],
        verificationStatus: 'verified',
        trustBadge: 'gold',
        isActive: true,
      });

      for (const room of data.rooms) {
        await Room.create({
          property: property._id,
          ...room,
          advanceType: 'fixed',
          keyMoney: 0,
        });
      }
      console.log(`  ✓ Created "${data.name}" with ${data.rooms.length} rooms`);
    }

    console.log('\n✅ Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error);
    process.exit(1);
  }
}

seed();
