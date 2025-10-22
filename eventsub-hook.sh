#!/bin/bash
# This script will be executed when any of your subscriptions fire.
# This is an implementation I have for some stuff on my raspberry pi,
# so you will almost certainly need to change this script.

TYPE=$1

if [[ "$TYPE" = "channel.update" ]]; then
  TYPE="5"
elif [[ "$TYPE" = "stream.online" ]]; then
  TYPE="8"
fi

SER=23
SRCLR=22
SRCLK=27
RCLK=17

pulse() {
  pinctrl set $1 op dl
  sleep 0.01
  pinctrl set $1 op dh
}

clear-reg() {
  pinctrl set $SRCLR op dl
  pulse $RCLK
  sleep 0.01
  pinctrl set $SRCLR op dh
}

set-val() {
  local BITS bit val
  BITS=($(python bits.py "$1"))
  for bit in ${BITS[@]}; do
    [[ "$bit" = "1" ]] && val="dh" || val="dl"
    pinctrl set $SER op $val
    sleep 0.01
    pulse $SRCLK
  done
  
  pulse $RCLK
}

for i in {1..3}; do
  for j in {1..4}; do
    set-val "$TYPE"
    sleep 0.15
    clear-reg
  done
  sleep 0.3
done