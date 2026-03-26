# Utility Visibility Bands — Design Spec

**Date:** 2026-03-26
**Status:** Frozen
**Goal:** Add subtle visual substrate behind top utility cluster and bottom stats to prevent them from getting lost against the forest background.

## Core Principle

> These bands give floor, not frame. They are substrate, not bars.

---

## 1. Utility Band (Top — Zone A2)

| Token | Before | After |
|-------|--------|-------|
| Background | transparent | `linear-gradient(180deg, rgba(12,20,35,0.42) 0%, rgba(6,14,28,0.24) 100%)` |
| Border top | none | `1px solid rgba(255,255,255,0.03)` |
| Border bottom | none | `1px solid rgba(0,0,0,0.15)` |
| Lv label color | `text-purple-400/50` | `text-purple-400/60` |

## 2. Stats Band (Bottom — Footer Layer 1)

| Token | Before | After |
|-------|--------|-------|
| Container | plain flex | Add `rounded-[10px] mx-2` + inline bg |
| Background | transparent | `rgba(0,0,0,0.13)` |
| Border bottom | none | `1px solid rgba(255,255,255,0.03)` |
| Stats text | `text-white/35` | `text-white/40` |
| Stats icon opacity | `opacity-25` | `opacity-30` |
| Padding | `pt-2 pb-1.5` | `py-1.5 px-3` |

## Guardrail

These bands must give visual floor, not become dominant bars. If they compete with hero rail or CTA on device, reduce opacity before adding more structure.

## What This Spec Does NOT Change

- Layout, flex structure, or component hierarchy
- Hero rail, board, CTA, dock
- Any surface system tier
