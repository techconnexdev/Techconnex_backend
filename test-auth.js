// Test script to generate JWT and test profile API
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Generate a test JWT token for the seeded user
const testUser = {
  userId: "1ad7eb86-8082-49f1-91b1-b932379b21df",
  email: "customer@example.com",
  roles: ["CUSTOMER"]
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: "1h" });

console.log("Generated JWT token:");
console.log(token);
console.log("\nTest the API with:");
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:4000/company/profile`);
