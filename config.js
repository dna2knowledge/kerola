const i_dotenv = require('dotenv');
i_dotenv.config({ path: `.env` });

module.exports = {
   index: {
      req: process.env.ES_REQ_NAME || 'kerola_req',
      raw: process.env.ES_RAW_FILE_NAME || '/tmp/kerola-raw.lvdb',
      cooked: process.env.ES_COOKED_NAME || 'kerola_cooked',
      ref: process.env.ES_REF_NAME || 'kerola_ref',
   },
   DB_HOST: process.env.DB_HOST,
   DB_PORT: process.env.DB_PORT,
   DB_USER: process.env.DB_USER,
   DB_PASS: process.env.DB_PASS,
   DB_NAME: process.env.DB_NAME,
   DB_SSL: process.env.DB_SSL,
   ES_URL: process.env.ES_URL || 'http://127.0.0.1:9200',
   AUTH_USERPASS_FILE: process.env.AUTH_USERPASS_FILE,
   MAX_PAYLOAD_SIZE: parseInt(process.env.MAX_PAYLOAD_SIZE || '10') * 1024, /* by default 10KB */

   CR_ACT_N: parseInt(process.env.CR_ACT_N || '1'),
   CR_TMP_DIR: process.env.CR_TMP_DIR || '/tmp',
   CR_QUEUE_MAX: parseInt(process.env.CR_QUEUE_MAX || '10'),
};

