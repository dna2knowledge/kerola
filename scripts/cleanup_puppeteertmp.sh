#!/bin/bash

SELF=$(cd `dirname $0`/..; pwd)
mkdir -p $SELF/local/cleanup
cd $SELF/local/cleanup

ls /tmp | grep puppeteer | sort > clcur
while true; do

   if [ -f exit.sig ];
      rm exit.sig
      exit 0
   then

   echo 'cleanup ...'
   sleep 120
   ls /tmp | grep puppeteer | sort > clnext
   diff -Nur clcur clnext | grep -v -E '^-' | grep -v -E '^[+]' | grep -v -E '^@@' | grep -o -E '[^ ].+$' > cldiff
   mapfile -t items < cldiff
   for item in "${items[@]}"; do
      echo "- ${item} ..."
      rm -r /tmp/${item}
   done
   mv clnext clcur
done
