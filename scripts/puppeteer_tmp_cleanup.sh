#!/bin/bash

ls /tmp | grep puppeteer | sort > clcur
while true; do
echo 'cleanup ...'
sleep 600
ls /tmp | grep -E 'puppeteer|[.]out' | sort > clnext
diff -Nur clcur clnext | grep -v -E '^-' | grep -v -E '^[+]' | grep -v -E '^@@' | grep -o -E '[^ ].+$' > cldiff
mapfile -t items < cldiff
for item in "${items[@]}"; do
   echo "- ${item} ..."
   rm -r /tmp/${item}
done
mv clnext clcur
done
