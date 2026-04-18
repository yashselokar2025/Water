const fs = require('fs');
const path = require('path');

const files = [
  'server/index.js',
  'server/simulation.js',
  'server/services/smsService.js',
  'server/routes/testing.js',
  'server/routes/auth.js',
  'server/routes/api.js'
];

files.forEach(f => {
  const p = path.join('c:/Users/VICTUS/OneDrive/Desktop/Water', f);
  if (!fs.existsSync(p)) return;
  
  let content = fs.readFileSync(p, 'utf8');

  // Replace `database.all(` -> `db.query(`
  content = content.replace(/database\.all\(/g, 'db.query(');
  // Replace `database.run(` -> `db.execute(`
  content = content.replace(/database\.run\(/g, 'db.execute(');
  
  // Also check `db.getDB().run(`
  content = content.replace(/db\.getDB\(\)\.run\(/g, 'db.execute(');
  content = content.replace(/db\.getDB\(\)\.all\(/g, 'db.query(');
  
  // Ensure we didn't end up with db.query where we didn't import db if needed, but they usually do.
  
  // Specific fix in index.js for res.send
  content = content.replace('SmartWater AI Backend (SQLite) is running', 'SmartWater AI Backend (Postgres) is running');

  fs.writeFileSync(p, content, 'utf8');
  console.log('Fixed', f);
});
