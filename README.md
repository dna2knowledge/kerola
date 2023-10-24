# kerola
Crawler System in JS

```
npm install
cp .env-sample .env
vim .env
node scripts/init_es.js
pm2 start --name kerola-be index.js
```

### APIs

- POST `/api/login` `{"user":"<user>","pass":"<password>"}` -> `{"token":"<token>"}`
  - login
- POST `/api/crawler/req` `{"user":"<user>","token":"<token>","q":"<url>","pr":"<optional.priority>","memo":"<optional.comment>","nest":"<optional.recursive_crawling>"}` e.g. `url=bingcn://1 USD = ? CNY` `url=https://www.baidu.com`
  - send request so that crawler can work to fetch html documents
  - higher priority (pr), easier to get job in queue
  - memo is used to take notes
  - nest is used to tell crawler to fetch all related html documents under the same host
- POST `/api/raw/get` `/api/raw/uet` `{"user":"<user>","token":"<token>","url":"<url>"}` -> `{"url":"<url>","dom":"<html>","ts":<timestamp>,"ok":<stat>}`
  - get html contents by url
  - `es` adapter: uet is a little faster than get, for it reads data from level db directly, no check request stat from ElasticSearch
  - uet can accept `extracted` flag so that DOM contents will be parsed into url objects `"extracted":[{"name":"<name>","href":"<url>"}, ...]`
- POST `/api/raw/search` `{"user":"<user>","token":"<token>","q":"<query>"}` -> `{"total":{"value":<number>,"relation":"eq"},"items":[{"id":"<id>","dom":"<html>","ok":"<stat>","pr":"<priority>","ts":<timestamp>,"url":"<url>"}, ...]}`
  - search for requests
- POST `/api/cooked/search` `{"user":"<user>","token":"<token>","q":"<query>"}` -> `{"total":{"value":<number>,"relation":"eq"},"items":[{"id":"<id>","name":"<name>","type":"<type>","attr":{...},"tag":[...]}, ...]}`
  - search for cooked data
- POST `/api/cooked/get` `{"user":"<user>","token":"<token>","id":"<id>"}` -> `{"truth": {...}, "ref": { "source1":{...}, ... }}`
  - get cooked data by id
- POST `/api/cooked/update` `{"user":"<user>","token":"<token>","obj": { "id", "name", "type", "attr", "tag"... }}`
  - create/update cooked data with id, name, type, attr, tag
- POST `/api/cooked/updateRef` `{"user":"<user>","token":"<token>","obj": { "source1": { "<key>":"<val>", ... }, ... }}`
  - create/patch reference by source name
  - for example, cooked data we have `{"key":"val0"}`, we can set different references like `{ "source1": { "key": "val1" } }`, `{ "source2": { "key": "val0" } }`, ...
