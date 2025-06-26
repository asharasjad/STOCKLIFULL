const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../src/database/inventory.sqlite");
const seedPath = path.join(__dirname, "../src/database/seed-data.sql");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Could not open database:", err);
    process.exit(1);
  }
  console.log("Connected to database");
});

// Read and execute seed data
fs.readFile(seedPath, "utf8", (err, sql) => {
  if (err) {
    console.error("Could not read seed file:", err);
    process.exit(1);
  }

  // Split statements by semicolon and execute each one
  const statements = sql.split(";").filter(stmt => stmt.trim() && !stmt.trim().startsWith("--"));
  
  let completed = 0;
  
  statements.forEach((statement, index) => {
    if (statement.trim()) {
      db.run(statement, (err) => {
        if (err) {
          console.error(`Error executing statement ${index + 1}:`, err);
        } else {
          console.log(`Statement ${index + 1} executed successfully`);
        }
        
        completed++;
        if (completed === statements.length) {
          console.log("All sample data seeded successfully!");
          db.close();
        }
      });
    } else {
      completed++;
      if (completed === statements.length) {
        console.log("All sample data seeded successfully!");
        db.close();
      }
    }
  });
});