#!/bin/bash
PIN=17

pinctrl set "$PIN" op dl

function blink() {
  pinctrl set "$PIN" op dh
  sleep 0.3
  pinctrl set "$PIN" op dl
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