const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

class PasswordUtil {
  static async hash(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  static async compare(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = PasswordUtil;
