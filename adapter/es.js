const i_es = require('@elastic/elasticsearch');
const i_lv = require('level');
const i_config = require('../config');

// index.raw should be a folder path for level DB
// i.e. DB_RAW_NAME = /path/to/lvdb_data
const config = { index: i_config.index, };

const C = new i_es.Client({ node: i_config.ES_URL });
const L = new i_lv.Level(config.index.raw);

const refUpdateQueue = {};
async function refUpdateAct(name) {
   const refQ = refUpdateQueue[name];
   if (!refQ) return;
   if (!refQ.z.length) { delete refUpdateQueue[name]; return; }
   if (refQ.L) return;
   refQ.L = true;
   const task = refQ.z.shift();
   try {
      const opt = { refresh: true };
      let obj;
      if (task.id) {
         // obj = await logic.getRefById(task.id);
         // if (!obj) throw 'no such record';
         obj = (await logic.getRefById(task.id)) || { name, };
      } else {
         obj = await logic.getRefByName(task.name);
         if (!obj) obj = { name, };
      }
      Object.keys(task.obj).forEach(source => {
         if (task.obj[source]) {
            obj[source] = task.obj[source];
         } else {
            // null
            delete obj[source];
         }
      });
      if (obj.id) {
         opt.id = obj.id;
         delete obj.id;
      } else if (task.id) {
         opt.id = task.id;
      }
      const rs = await api.index(config.index.ref, obj, opt);
      if (!task.id) task.r(rs);
      task.r(null);
   } catch(err) {
      task.e(err);
   }
   refQ.L = false;
   setTimeout(refUpdateAct, 0, name);
}

const logic = {
   getSomeTodoReqs: async (size, ok) => {
      ok = ok || 0;
      try {
         const rs = await api.search(config.index.req, {
            bool: {
               must: { range: { ok: { gte: ok, lte: ok } } }
            }
         }, {
            size: size || 1,
            sort: [
               { pr: { order: 'desc' } },
               { _script: { type: 'number', script: { source: 'Math.random()' }, order: 'asc' } },
            ],
         });
         const r = {
            total: rs.hits.total,
            items: rs.hits.hits?.map(z => Object.assign({ id: z._id }, z._source)),
         };
         return r;
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   getReqById: async (id) => {
      try {
         const rs = await api.get(config.index.req, id);
         return Object.assign({ id: rs._id }, rs._source);
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   getReqByUrl: async (url) => {
      try {
         const rs = await api.search(config.index.req, {
            match: { url }
         }, {
            size: 5,
         });
         const r = rs.hits.hits.find(z => z._source.url === url);
         if (!r) return null;
         return Object.assign({ id: r._id }, r._source);
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   searchReqs: async (query, from, size) => {
      try {
         const rs = await api.search(config.index.req, {
            match: {
               url: query,
            }
         }, {
            from: from || 0,
            size: size || 50,
            min_score: query.length * 0.9,
            track_total_hits: true,
         });
         const r = {
            total: rs.hits.total,
            items: rs.hits.hits.map(z => Object.assign({ id: z._id }, z._source)),
         };
         return r;
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   updateReq: async (id, obj) => {
      try {
         const opt = { refresh: true };
         if (id) opt.id = id;
         const obj0 = Object.assign({}, obj);
         if (obj0.id) delete obj0.id;
         await api.index(config.index.req, obj0, opt);
      } catch(err) {
         // TODO: elastic crashed
      }
   },
   getRawByUrl: async (url, tag) => {
      try {
         const rs = await api.keyval.get(`${tag?tag:''}:${url}`);
         return { url, raw: JSON.parse(rs) };
      } catch(err) {
         return null;
      }
   },
   updateRaw: async (url, text, tag) => {
      try {
         await api.keyval.put(`${tag?tag:''}:${url}`, JSON.stringify(text));
      } catch (err) {
         // TODO: elastic crashed
      }
   },
   getCookedById: async (id) => {
      try {
         const rs = await api.get(config.index.cooked, id);
         return Object.assign({ id: rs._id }, rs._source);
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   getCookedByName: async (name) => {
      try {
         const rs = await api.search(config.index.cooked, {
            match: { name }
         }, {
            size: 5,
         });
         const r = rs.hits.hits.find(z => z._source.name === name);
         if (!r) return null;
         return Object.assign({ id: r._id }, r._source);
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   searchCookeds: async (query, from, size) => {
      try {
         const rs = await api.search(config.index.cooked, { query_string: { query } }, {
            from: from || 0,
            size: size || 50,
            min_score: query.length * 0.9,
            track_total_hits: true,
         });
         const r = {
            total: rs.hits.total,
            items: rs.hits.hits.map(z => Object.assign({ id: z._id }, z._source)),
         };
         return r;
      } catch (err) {
         // TODO: elastic crashed
         return null;
      }
   },
   updateCooked: async (id, obj) => {
      try {
         const opt = { refresh: true };
         if (id) opt.id = id;
         const obj0 = Object.assign({}, obj);
         if (obj0.id) delete obj0.id;
         const rs = await api.index(config.index.cooked, obj0, opt);
         if (!id) return rs;
         return null;
      } catch (err) {
         // TODO: elastic crashed
         return null;
      }
   },
   getRefById: async (id) => {
      try {
         const rs = await api.get(config.index.ref, id);
         return Object.assign({ id: rs._id }, rs._source);
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   getRefByName: async (name) => {
      try {
         const rs = await api.search(config.index.ref, {
            match: { name }
         }, {
            size: 5,
         });
         const r = rs.hits.hits.find(z => z._source.name === name);
         if (!r) return null;
         return Object.assign({ id: r._id }, r._source);
      } catch(err) {
         // TODO: elastic crashed
         return null;
      }
   },
   updateRef: (id, name, obj) => {
      return new Promise((r, e) => {
         if (!name) return e('no name');
         // L = lock, z = [tasks]
         if (!refUpdateQueue[name]) refUpdateQueue[name] = { L: false, z: [] };
         if (refUpdateQueue[name].length >= 10) return e('too many requests');
         const task = { id, name, obj, r, e, };
         refUpdateQueue[name].z.push(task);
         refUpdateAct(name);
      });
   },
};

const api = {
   rawClient: C,
   rawLevelDB: L,
   config,
   logic,
   createTrigramIndex: (name) => {
      return C.indices.create({
         index: name,
         body: {
            "settings": {
               "analysis": {
                  "analyzer": {
                     "default": { "tokenizer": "trigramtoken", "filter": ["lowercase"] }
                  },
                  "tokenizer": { "trigramtoken": { "type": "ngram", "min_gram": 2, "max_gram": 3 } }
               } // analysis
            } // settings
         },
      });
   },
   blukIndex: (name, objs) => {
      const payload = {
         refresh: true,
         operations: [],
      };
      obj.forEach(obj => {
         payload.operations.push({ index: { _index: name } });
         payload.operations.push(obj);
      });
      return C.bulk(payload);
   },
   index: (name, obj, opt) => {
      opt = opt || {};
      const payload = {
         index: name,
         document: obj
      };
      if (opt.id) payload.id = opt.id;
      if (opt.refresh) payload.refresh = true;
      return C.index(payload);
   },
   get: (name, id) => {
      const payload = {
         index: name,
         id,
      };
      return C.get(payload);
   },
   remove: (name, id, opt) => {
      opt = opt || {};
      const payload = {
         index: name,
         id,
      };
      if (opt.refresh) payload.refresh = true;
      return C.delete(payload);
   },
   exists: (name, id) => {
      const payload = {
         index: name,
         id,
      };
      return C.exists(payload);
   },
   search: (name, query, opt) => {
      // opt e.g. suggest, from, size, ...
      opt = opt || {};
      const payload = {
         index: name,
         query,
         ...opt
      };
      return C.search(payload);
   },
   sql: (name, sql, opt) => {
      const payload = { query: sql };
      // XXX: result.rows[j][result.columns[i].name]
      return C.sql.query(payload);
   },
   keyval: {
      open: () => new Promise((r, e) => L.open((err) => err ? e(err) : r())),
      close: () => new Promise((r, e) => L.close((err) => err ? e(err) : r())),
      get: (key) => new Promise((r, e) => L.get(key, (err, val) => err ? e(err) : r(val))),
      put: (key, val) => new Promise((r, e) => L.put(key, val, (err) => err ? e(err) : r())),
      del: (key) => new Promise((r, e) => L.del(key, (err) => err ? e(err) : r())),
   },
};

module.exports = api;
