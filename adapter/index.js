const i_config = require('../config');

const api = {};
switch (i_config.DB_TYPE) {
case 'postgres':
   api.logic = require('./postgres').logic;
   i_config.DB_HOST = i_config.DB_HOST || '127.0.0.1:5432';
   i_config.DB_USER = i_config.DB_USER || 'postgres';
   break;
case 'elasticsearch':
   api.logic = require('./es').logic;
   i_config.ES_URL = i_config.ES_URL || 'http://127.0.0.1:9200';
   break;
case 'sqlite3': default:
   api.logic = require('./sqlite3').logic;
   i_config.DB_FILE = i_config.DB_FILE || 'sqlite3.db';
   break;
}

module.exports = api;
