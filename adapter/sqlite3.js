const i_db = require('sqlite3');
const i_config = require('../config');

const config = { index: i_config.index, };

const C = new i_db.Database(i_config.DB_FILE);

function ser(asyncFn) {
   return new Promise((r, e) => {
      C.serialize(() => {
         (async () => {
            try {
               r(await asyncFn());
            } catch(err) {
               e(err);
            }
         })();
      });
   });
}

const logic = {
   getSomeTodoReqs: async (size, ok) => {
      ok = ok || 0;
      if (isNaN(size)) size = 20;
      if (size === 0) return [];
      try {
         return await ser(async() => {
            const rows = await api.dball(`SELECT
               id, url, pr, ok, ts, params FROM ${config.index.req}
               WHERE ok = ?
               ORDER BY pr DESC, RANDOM() LIMIT ${size}
            `, ok);
            return {
               total: rows.length,
               items: rows.map(z => {
                  if (z.params) z.params = JSON.parse(z.params);
                  return z;
               }),
            }
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getReqById: async (id) => {
      try {
         return await ser(async() => {
            const row = await api.dbget(`SELECT id, url, pr, ok, ts, params FROM ${config.index.req} WHERE id = ?`, id);
            if (row.params) row.params = JSON.parse(row.params);
            return row;
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getReqByUrl: async (url) => {
      try {
         return await ser(async() => {
            const row = await api.dbget(`SELECT id, url, pr, ok, ts, params FROM ${config.index.req} WHERE url = ?`, url);
            if (row.params) row.params = JSON.parse(row.params);
            return row;
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   searchReqs: async (query, from, size) => {
      if (isNaN(from)) from = 0;
      if (isNaN(size)) size = 10;
      try {
         // query => url
         return await ser(async() => {
            const q = `%${query}%`
            const cnt = await api.dbget(`SELECT
               COUNT(id) AS n FROM ${config.index.req}
               WHERE UPPER(url) LIKE ?
            `, q);
            const rows = await api.dball(`SELECT
               id, url, pr, ok, ts, params FROM ${config.index.req}
               WHERE UPPER(url) LIKE ?
               LIMIT ${size} OFFSET ${from}
            `, q);
            return {
               total: cnt.n,
               items: rows.map(z => {
                  if (z.params) z.params = JSON.parse(z.params);
                  return z;
               }),
            }
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   updateReq: async (id, obj) => {
      try {
         return await ser(async() => {
            if (id) {
               const row = await api.dbget(`SELECT id, url, pr, ok, ts, params FROM ${config.index.req} WHERE id = ?`, id);
               C.run(`UPDATE ${config.index.req}
                  SET pr = ?, ok = ?, ts = CURRENT_TIMESTAMP
                  WHERE id = ?
               `, obj.pr || row.pr, obj.ok || row.ok, id);
            } else {
               C.run(`INSERT INTO ${config.index.req}
                  (url, pr, ok, ts, params) VALUES
                  (?,   ?,  ?,  CURRENT_TIMESTAMP,  ?)
               `, obj.url, obj.pr || 0, 0, obj.params ? JSON.stringify(obj.params) : null);
            }
         });
      } catch(err) {
         // TODO: handle err
      }
   },
   getRawByUrl: async (url, tag) => {
      try {
         return await ser(async() => {
            const row = await api.dbget(`SELECT id FROM ${config.index.req} WHERE url = ?`, url);
            if (!row) return;
            const rs = await api.dbget(`SELECT ts, ok, dom FROM ${config.index.raw} WHERE id = ? AND tag = ?`, [row.id, tag || null]);
            if (!rs) return;
            rs.url = url;
            return rs;
         });
      } catch(err) {
         return null;
      }
   },
   updateRaw: async (url, text, tag) => {
      try {
         const json = JSON.parse(text);
         return await ser(async() => {
            const row = await api.dbget(`SELECT id FROM ${config.index.req} WHERE url = ?`, url);
            if (!row) return;
            const rs = await api.dbget(`SELECT id, tag FROM ${config.index.raw} WHERE id = ? AND tag = ?`, [row.id, tag || null]);
            if (rs) {
               C.run(`UPDATE ${config.index.raw}
                  SET dom = ?, ok = ?, ts = CURRENT_TIMESTAMP
                  WHERE id = ? AND tag = ?
               `, json.dom, json.ok, row.id, tag);
            } else {
               C.run(`INSERT INTO ${config.index.raw}
                  (id, tag, dom, ok, ts) VALUES
                  (?,   ?,  ?,  ?, CURRENT_TIMESTAMP)
               `, row.id, tag, json.dom, json.ok);
            }
         });
      } catch (err) {
         // TODO: handle err
      }
   },
   getCookedById: async (id) => {
      try {
         return await ser(async() => {
            const row = await api.dbget(`SELECT id, name, type, ts, ok, obj FROM ${config.index.cooked} WHERE id = ?`, id);
            if (row.obj) row.obj = JSON.parse(row.obj);
            return row;
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getCookedByName: async (name) => {
      try {
         return await ser(async() => {
            const row = await api.dbget(`SELECT id, name, type, ts, ok, obj FROM ${config.index.cooked} WHERE name = ?`, name);
            if (row.obj) row.obj = JSON.parse(row.obj);
            return row;
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   searchCookeds: async (query, from, size) => {
      if (isNaN(from)) from = 0;
      if (isNaN(size)) size = 10;
      try {
         // query => url
         return await ser(async() => {
            const q = `%${query}%`;
            const cnt = await api.dball(`SELECT
               COUNT(id) AS n FROM ${config.index.cooked}
               WHERE UPPER(name) LIKE ? OR UPPER(obj) LIKE ?
            `, q, q);
            const rows = await api.dball(`SELECT
               id, name, type, ts, ok, obj FROM ${config.index.cooked}
               WHERE UPPER(name) LIKE ? OR UPPER(obj) LIKE ?
               LIMIT ${size} OFFSET ${from}
            `, q, q);
            return {
               total: cnt.n,
               items: rows.map(z => {
                  if (z.obj) z.obj = JSON.parse(z.obj);
                  return z;
               }),
            };
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   updateCooked: async (id, obj) => {
      try {
         return await ser(async() => {
            if (id) {
               const row = await api.dbget(`SELECT id, name, type, ok, obj FROM ${config.index.cooked} WHERE id = ?`, id);
               C.run(`UPDATE ${config.index.cooked}
                  SET type = ?, ok = ?, obj = ?, ts = CURRENT_TIMESTAMP
                  WHERE id = ?
               `, obj.type || row.type, obj.ok || row.ok, obj ? JSON.stringify(obj.obj) : row.obj, id);
            } else {
               C.run(`INSERT INTO ${config.index.cooked}
                  (name, type, ok, ts, obj) VALUES
                  (?,   ?,  ?,  CURRENT_TIMESTAMP,  ?)
               `, obj.name, obj.type, obj.ok || 0, obj.obj ? JSON.stringify(obj.obj) : null);
            }
         });
      } catch(err) {
         // TODO: handle err
      }
   },
   getRefById: async (id) => {
      try {
         return await ser(async() => {
            const row = await api.dbget(`SELECT id FROM ${config.index.cooked} WHERE id = ?`, id);
            if (!row) return null;
            const sources = await api.dball(`SELECT source, ref FROM ${config.index.ref} WHERE id = ?`, row.id);
            const obj = {};
            sources.forEach(z => { if (z.ref) obj[z.source] = JSON.parse(z.ref); });
            obj.name = name;
            obj.id = row.id;
            return obj;
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getRefByName: async (name) => {
      try {
         return await ser(async () => {
            const row = await api.dbget(`SELECT id FROM ${config.index.cooked} WHERE name = ?`, name);
            if (!row) return null;
            const sources = await api.dball(`SELECT source, ref FROM ${config.index.ref} WHERE id = ?`, row.id);
            const obj = {};
            sources.forEach(z => { if (z.ref) obj[z.source] = JSON.parse(z.ref); });
            obj.name = name;
            obj.id = row.id;
            return obj;
         });
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   updateRef: async (id, src_name, obj) => {
      try {
         await ser(async () => {
            const row = await api.dbget(`SELECT id FROM ${config.index.ref} WHERE id = ? AND source = ?`, id, src_name);
            if (row) {
               C.run(`UPDATE ${config.index.ref} SET ts = CURRENT_TIMESTAMP, ref = ? WHERE id = ? AND source = ?`, obj ? JSON.stringify(obj) : null, id, src_name);
            } else {
               C.run(`INSERT INTO ${config.index.ref} (id, source, ref) VALUES (?, ?, ?)`, id, src_name, obj ? JSON.stringify(obj) : null);
            }
         });
      } catch (err) {
         // TODO: handle err
      }
   },
};

const api = {
   rawClient: C,
   config,
   logic,
   createTables: async () => {
      await ser(async () => {
         C.run(`CREATE TABLE ${config.index.req} (
            id INTEGER PRIMARY KEY,
            url VARCHAR(1024) UNIQUE,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pr INTEGER DEFAULT 0,
            ok INTEGER DEFAULT 0,
            params TEXT
         )`);
         C.run(`CREATE TABLE ${config.index.raw} (
            id INTEGER REFERENCES ${config.index.req}(id),
            tag VARCHAR(100),
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ok INTEGER DEFAULT 0,
            dom TEXT
         )`);
         C.run(`CREATE TABLE ${config.index.cooked} (
            id INTEGER PRIMARY KEY,
            name VARCHAR(1024),
            type VARCHAR(100),
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ok INTEGER DEFAULT 0,
            obj TEXT
         )`);
         C.run(`CREATE TABLE ${config.index.ref} (
            id INTEGER REFERENCES ${config.index.cooked}(id),
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            source VARCHAR(100),
            ok INTEGER DEFAULT 0,
            ref TEXT
         )`);
      });
   },
   dbget: (...args) => new Promise((r, e) => {
      C.get(...args, (err, row) => {
         if (err) return e(err);
         r(row);
      });
   }),
   dball: (...args) => new Promise((r, e) => {
      C.all(...args, (err, rows) => {
         if (err) return e(err);
         r(rows);
      });
   }),
};

module.exports = api;
