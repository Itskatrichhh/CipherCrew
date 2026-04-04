const User = require('../models/User');

const authorizedUsers = [
  {
    username: 'sid_artzzzz',
    email: 'sita.kuchibhatla@gmail.com',
    password: 'Welcome@123',
    displayName: 'Karthik',
    isAuthorized: true
  },
  {
    username: 'panipuri3018',
    email: 'sravasthigoli07@gmail.com',
    password: 'Welcome@123',
    displayName: 'Sravasthi',
    isAuthorized: true
  },
  {
    username: 'sahss',
    email: 'sahithyacupcake@gmail.com',
    password: 'Welcome@123',
    displayName: 'Sahithya',
    isAuthorized: true
  },
  {
    username: 'dhe-erenjeager',
    email: 'dheerajgummaraju09@gmail.com',
    password: 'Welcome@123',
    displayName: 'Dheeraj',
    isAuthorized: true
  }
];

const seedUsers = async () => {
  try {
    for (const userData of authorizedUsers) {
      const existingUser = await User.findOne({ 
        $or: [
          { username: userData.username },
          { email: userData.email }
        ]
      });

      if (!existingUser) {
        await User.create(userData);
        console.log(`✅ Created user: ${userData.displayName} (${userData.username})`);
      } else {
        // Update password if changed
        existingUser.password = userData.password;
        await existingUser.save();
        console.log(`🔄 Updated user: ${userData.displayName}`);
      }
    }
    console.log('✅ User seeding complete');
  } catch (error) {
    console.error('❌ Error seeding users:', error);
  }
};

module.exports = { seedUsers, authorizedUsers };
