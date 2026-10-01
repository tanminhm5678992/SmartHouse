const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Hỗ trợ serialize BigInt sang string/number khi trả về qua JSON
BigInt.prototype.toJSON = function () {
  const intVal = Number(this);
  return intVal <= Number.MAX_SAFE_INTEGER ? intVal : this.toString();
};

module.exports = prisma;
