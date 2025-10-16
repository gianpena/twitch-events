#!/bin/bash
pinctrl set 17 op dl

function blink() {
  pinctrl set 17 op dh
  sleep 0.3
  pinctrl set 17 op dl
  sleep 0.2
}

function three_blinks() {
  for i in {1..3}; do
    blink
  done
}

three_blinks
sleep 0.5
three_blinks