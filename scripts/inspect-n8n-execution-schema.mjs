import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite');

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

try {
  const tables = await all("select name from sqlite_master where type='table' order by name");
  const names = tables.map((row) => row.name);
  const relevant = names.filter((name) => /execution/i.test(name));
  const info = {};
  for (const name of relevant) {
    info[name] = await all(`pragma table_info(${name})`);
  }
  console.log(JSON.stringify({ relevant, info }, null, 2));
} finally {
  db.close();
}
