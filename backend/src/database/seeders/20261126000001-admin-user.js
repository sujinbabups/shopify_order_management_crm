'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Password123';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';

    // Check if admin already exists
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = :email LIMIT 1;`,
      {
        replacements: { email: adminEmail },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );

    if (existingUsers && existingUsers.length > 0) {
      console.log(`Admin user ${adminEmail} already exists. Skipping.`);
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const id = uuidv4 ? uuidv4() : require('crypto').randomUUID();

    await queryInterface.bulkInsert('users', [
      {
        id,
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    console.log(`Initial admin account created: ${adminEmail}`);
  },

  async down(queryInterface) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    await queryInterface.bulkDelete('users', { email: adminEmail });
  },
};
