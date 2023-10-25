const i_pg = require('pg');
const i_config = require('../config');

const config = { index: i_config.index, };

const C = new i_pg.Pool({
   host: i_config.DB_HOST || '127.0.0.1',
   user: i_config.DB_USER,
   password: i_config.DB_PASS || undefined,
   database: i_config.DB_NAME,
   port: parseInt(i_config.DB_PORT || '5432'),
   ssl: !!i_config.DB_SSL,
   max: 20,
   idleTimeoutMillis: 30000,
   connectionTimeoutMillis: 5000,
});

async function atom(asyncFn) {
   const C0 = await C.connect();
   try {
      await C0.query(`BEGIN`);
      await asyncFn(C0);
      await C0.query(`COMMIT`);
      return null;
   } catch (err) {
      await C0.query(`ROLLBACK`);
      return err;
   } finally {
      C0.release();
   }
}

const logic = {
   getSomeTodoReqs: async (size, ok) => {
      ok = ok || 0;
      if (isNaN(size)) size = 20;
      if (size === 0) return [];
      try {
         const rows = await api.dball(`SELECT
            id, url, pr, ok, ts, params FROM ${config.index.req}
            WHERE ok = $1
            ORDER BY pr DESC, RANDOM() LIMIT ${size}
         `, [ok]);
         return {
            total: rows.length,
            items: rows,
         }
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getReqById: async (id) => {
      try {
         const row = await api.dbget(`SELECT id, url, pr, ok, ts, params FROM ${config.index.req} WHERE id = $1`, [id]);
         return row;
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getReqByUrl: async (url) => {
      try {
         const row = await api.dbget(`SELECT id, url, pr, ok, ts, params FROM ${config.index.req} WHERE url = $1`, [url]);
         return row;
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
         const q = `%${query}%`
         const cnt = await api.dbget(`SELECT
            COUNT(id) AS n FROM ${config.index.req}
            WHERE url ILIKE $1
         `, [q]);
         const rows = await api.dball(`SELECT
            id, url, pr, ok, ts, params FROM ${config.index.req}
            WHERE url ILIKE $1
            ${from} LIMIT ${size}
         `, [q]);
         return {
            total: cnt.n,
            items: rows,
         };
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   updateReq: async (id, obj) => {
      try {
         if (id) {
            const row = await api.dbget(`SELECT id, url, pr, ok, ts, params FROM ${config.index.req} WHERE id = $1`, [id]);
            await C.query(`UPDATE ${config.index.req}
               SET pr = $1, ok = $2, ts = NOW()
               WHERE id = $3
            `, [obj.pr || row.pr, obj.ok || row.ok, id]);
         } else {
            await C.query(`INSERT INTO ${config.index.req}
               (url, pr, ok, ts, params) VALUES
               ($1,   $2,  $3,  NOW(),  $4)
            `, [obj.url, obj.pr || 0, 0, obj.params ? JSON.stringify(obj.params) : null]);
         }
      } catch(err) {
         // TODO: handle err
      }
   },
   getRawByUrl: async (url, tag) => {
      try {
         const row = await api.dbget(`SELECT id FROM ${config.index.req} WHERE url = $1`, [url]);
         if (!row) return null;
         const rs = await api.dbget(`SELECT ts, ok, dom FROM ${config.index.raw} WHERE id = $1 AND tag = $2`, [row.id, tag || null]);
         if (!rs) return null;
         return { url, raw: rs };
      } catch(err) {
         return null;
      }
   },
   updateRaw: async (url, text, tag) => {
      try {
         const json = JSON.parse(text);
         const row = await api.dbget(`SELECT id FROM ${config.index.req} WHERE url = $1`, [url]);
         if (!row) return;
         const rs = await api.dbget(`SELECT id, tag FROM ${config.index.raw} WHERE id = $1 AND tag = $2`, [row.id, tag || null]);
         if (rs) {
            await C.query(`UPDATE ${config.index.raw}
               SET dom = $1, ok = $2, ts = NOW()
               WHERE id = $3 AND tag = $4
            `, [json.dom, json.ok, row.id, tag]);
         } else {
            await C.query(`INSERT INTO ${config.index.raw}
               (id, tag, dom, ok, ts) VALUES
               ($1,   $2,  $3,  $4, NOW())
            `, [row.id, tag, json.dom, json.ok]);
         }
      } catch (err) {
         // TODO: handle err
      }
   },
   getCookedById: async (id) => {
      try {
         const row = await api.dbget(`SELECT id, name, type, ts, ok, obj FROM ${config.index.cooked} WHERE id = $1`, [id]);
         return row;
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getCookedByName: async (name) => {
      try {
         const row = await api.dbget(`SELECT id, name, type, ts, ok, obj FROM ${config.index.cooked} WHERE name = $1`, [name]);
         return row;
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
         const q = `%${query}%`;
         const cnt = await api.dball(`SELECT
            COUNT(id) AS n FROM ${config.index.cooked}
            WHERE name ILIKE $1 OR obj ILIKE $1
         `, [q]);
         const rows = await api.dball(`SELECT
            id, name, type, ts, ok, obj FROM ${config.index.cooked}
            WHERE name ILIKE $1 OR obj LIKE $1
            OFFSET ${from} LIMIT ${size}
         `, [q]);
         return {
            total: cnt.n,
            items: rows,
         };
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   updateCooked: async (id, obj) => {
      try {
         if (id) {
            const row = await api.dbget(`SELECT id, name, type, ok, obj FROM ${config.index.cooked} WHERE id = $1`, [id]);
            await C.query(`UPDATE ${config.index.cooked}
               SET type = $1, ok = $2, obj = $3, ts = NOW()
               WHERE id = $4
            `, [obj.type || row.type, obj.ok || row.ok, obj ? JSON.stringify(obj.obj) : row.obj, id]);
         } else {
            await C.query(`INSERT INTO ${config.index.cooked}
               (name, type, ok, ts, obj) VALUES
               ($1,   $2,  $3,  NOW(),  $4)
            `, [obj.name, obj.type, obj.ok || 0, obj.obj ? JSON.stringify(obj.obj) : null]);
         }
      } catch(err) {
         // TODO: handle err
      }
   },
   getRefById: async (id) => {
      try {
         const row = await api.dbget(`SELECT id FROM ${config.index.cooked} WHERE id = $1`, [id]);
         if (!row) return null;
         const sources = await api.dball(`SELECT source, ref FROM ${config.index.ref} WHERE id = $1`, [row.id]);
         const obj = {};
         sources.forEach(z => { if (z.ref) obj[z.source] = z.ref; });
         obj.name = name;
         obj.id = row.id;
         return obj;
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   getRefByName: async (name) => {
      try {
         const row = await api.dbget(`SELECT id FROM ${config.index.cooked} WHERE name = $1`, [name]);
         if (!row) return null;
         const sources = await api.dball(`SELECT source, ref FROM ${config.index.ref} WHERE id = $1`, [row.id]);
         const obj = {};
         sources.forEach(z => { if (z.ref) obj[z.source] = z.ref; });
         obj.name = name;
         obj.id = row.id;
         return obj;
      } catch(err) {
         // TODO: handle err
         return null;
      }
   },
   updateRef: async (id, src_name, obj) => {
      try {
         const row = await api.dbget(`SELECT id FROM ${config.index.ref} WHERE id = $1 AND source = $2`, [id, src_name]);
         if (row) {
            await C.query(`UPDATE ${config.index.ref} SET ts = CURRENT_TIMESTAMP, ref = $1 WHERE id = $2 AND source = $3`, [obj ? JSON.stringify(obj) : null, id, src_name]);
         } else {
            await C.query(`INSERT INTO ${config.index.ref} (id, source, ref) VALUES ($1, $2, $3)`, [id, src_name, obj ? JSON.stringify(obj) : null]);
         }
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
      await atom(async (C0) => {
         await C0.query(`CREATE TABLE ${config.index.req} (
            id SERIAL PRIMARY KEY,
            url VARCHAR(1024) UNIQUE,
            ts TIMESTAMP DEFAULT NOW(),
            pr INTEGER DEFAULT 0,
            ok INTEGER DEFAULT 0,
            params JSON
         )`);
         await C0.query(`CREATE INDEX index_req_url ON ${config.index.req}(url)`);
         await C0.query(`CREATE TABLE ${config.index.raw} (
            id BIGINT REFERENCES ${config.index.req}(id),
            tag VARCHAR(100),
            ts TIMESTAMP DEFAULT NOW(),
            ok INTEGER DEFAULT 0,
            dom TEXT
         )`);
         await C0.query(`CREATE INDEX index_raw_tag ON ${config.index.raw}(tag)`);
         await C0.query(`CREATE TABLE ${config.index.cooked} (
            id SERIAL PRIMARY KEY,
            name VARCHAR(1024),
            type VARCHAR(100),
            ts TIMESTAMP DEFAULT NOW(),
            ok INTEGER DEFAULT 0,
            obj JSON
         )`);
         await C0.query(`CREATE INDEX index_cooked_name ON ${config.index.cooked}(name)`);
         await C0.query(`CREATE INDEX index_cooked_type ON ${config.index.cooked}(type)`);
         await C0.query(`CREATE TABLE ${config.index.ref} (
            id BIGINT REFERENCES ${config.index.cooked}(id),
            ts TIMESTAMP DEFAULT NOW(),
            source VARCHAR(100),
            ok INTEGER DEFAULT 0,
            ref JSON
         )`);
         await C0.query(`CREATE INDEX index_ref_source ON ${config.index.ref}(source)`);
      });
   },
   dbget: async (sql, vals) => {
      const rs = await C.query(sql, vals);
      return rs.rows[0];
   },
   dball: async (sql, vals) => {
      const rs = await C.query(sql, vals);
      return rs.rows;
   },
};

module.exports = api;
