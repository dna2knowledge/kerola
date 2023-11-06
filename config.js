const i_path = require('path');
const i_dotenv = require('dotenv');
i_dotenv.config({ path: i_path.join(__dirname, `.env`) });

module.exports = {
   index: {
      req: process.env.DB_REQ_NAME || 'kerola_req',
      raw: process.env.DB_RAW_NAME || 'kerola_raw',
      cooked: process.env.DB_COOKED_NAME || 'kerola_cooked',
      ref: process.env.DB_REF_NAME || 'kerola_ref',
   },
   TINY_DEBUG: !!process.env.TINY_DEBUG,
   TINY_HOST: process.env.TINY_HOST || '127.0.0.1',
   TINY_PORT: parseInt(process.env.TINY_PORT || '8081'),
   TINY_HTTPS_CA_DIR: process.env.TINY_HTTPS_CA_DIR ? i_path.resolve(process.env.TINY_HTTPS_CA_DIR) : null,
   HOSTALLOW: process.env.HOSTALLOW ? process.env.HOSTALLOW.split(',') : [],

   AUTH_USERPASS_FILE: process.env.AUTH_USERPASS_FILE,
   MAX_PAYLOAD_SIZE: parseInt(process.env.MAX_PAYLOAD_SIZE || '10') * 1024, /* by default 10KB */

   DB_TYPE: process.env.DB_TYPE,
   DB_HOST: process.env.DB_HOST,
   DB_FILE: process.env.DB_FILE,
   DB_PORT: process.env.DB_PORT,
   DB_USER: process.env.DB_USER,
   DB_PASS: process.env.DB_PASS,
   DB_NAME: process.env.DB_NAME,
   DB_SSL: process.env.DB_SSL,
   ES_URL: process.env.ES_URL,

   CR_ACT_N: parseInt(process.env.CR_ACT_N || '1'),
   CR_TMP_DIR: process.env.CR_TMP_DIR || '/tmp',
   CR_QUEUE_MAX: parseInt(process.env.CR_QUEUE_MAX || '10'),
   CR_PENALTY_S: parseInt(process.env.CR_PENALTY_S || '10') /* seconds */,
   CR_USERDIR: process.env.CR_USERDIR ? i_path.resolve(process.env.CR_USERDIR) : null,
};

