# Changelog

## v1.0.0 — 2026-09-22

First working version, installed and running in Home Assistant.

- `custom:dwc-control-center-card`, served from `/local/dwc/` and shown on a full-screen panel view.
- Live values for gauges, buckets, equipment, reservoir, valves, dosing bottles, environment and totals.
- Animation: rising bubbles that follow the live water surface, moving bucket water and level bars,
  pipe flow while the pump runs, feed-line flow while a bucket fills, pulsing dosing pumps.
- 24-hour trend chart from HA history; alerts computed from the configured limits.
- Entities, quick-action scripts and limits all settable in the card's YAML.
- Defaults point at the `demo_*` test helpers until the ESPHome controller is wired up.
