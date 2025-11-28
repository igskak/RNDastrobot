# Swiss Ephemeris Files - Quick Reference for Astrobot

## ✅ Current Installation Status

**Total Size:** 525 MB  
**Status:** ✅ **PRODUCTION READY** - All essential files installed

---

## File Categories Summary

### ⭐⭐⭐⭐⭐ CRITICAL (Installed)

| File Type | Count | Size | Coverage | Status |
|-----------|-------|------|----------|--------|
| Planet files (sepl_*.se1) | 50 | ~10 MB | 1500 BCE - 3000 CE | ✅ |
| Moon files (semo_*.se1) | 50 | ~10 MB | 1500 BCE - 3000 CE | ✅ |
| Main asteroids (seas_*.se1) | 50 | ~10 MB | 1500 BCE - 3000 CE | ✅ |

**What you can do:**
- Calculate all natal charts for any date in 4500-year range
- All 10 planets (Sun through Pluto)
- Moon with high precision
- Chiron, Ceres, Pallas, Juno, Vesta

---

### ⭐⭐⭐⭐ HIGHLY RECOMMENDED (Installed)

| File Type | Size | Coverage | Status |
|-----------|------|----------|--------|
| JPL DE406 | 190 MB | -3000 to +3000 | ✅ |
| Fixed Stars | 133 KB | All eras | ✅ |
| Asteroid Names | 15 MB | 25,000+ asteroids | ✅ |

**What you can do:**
- Maximum precision calculations (NASA JPL quality)
- Fixed star conjunctions (Regulus, Aldebaran, etc.)
- Identify asteroids by name

---

### ⭐⭐⭐ USEFUL (Installed)

| File Type | Count | Size | Coverage | Status |
|-----------|-------|------|----------|--------|
| EP4 Fast Files | 70 | ~300 MB | 1960-2265 | ✅ |
| Satellite Files | 30 | ~5 MB | 1994-2099 | ✅ |
| Fictitious Bodies | 1 | 5.9 KB | All eras | ✅ |

**What you can do:**
- Fast calculations for modern dates
- Planetary moons (Jupiter, Saturn, etc.)
- Uranian astrology (Hamburg School)

---

### ⭐⭐ OPTIONAL (Not Installed)

| File Type | Size | When to Download |
|-----------|------|------------------|
| Common Asteroids (ast0-ast5) | 150 MB | User requests specific asteroids |
| Extended Asteroids (all) | 29 GB | Specialized asteroid astrology |

**Download on demand:**
```bash
# For asteroids 1-999
cd swisseph/ephe
mkdir -p ast0
# Download from Dropbox or GitHub
```

---

### ⭐ RARELY NEEDED (Not Installed)

| File Type | Size | Why Not Needed |
|-----------|------|----------------|
| JPL DE431 | 2.6 GB | DE406 covers 99% of use cases |
| JPL DE441 | 2.6 GB | Redundant with DE406 |
| Long-range Asteroids | 11 GB | Rarely used historical asteroid data |
| JPL DE200 | 41 MB | Inferior to DE406 |

---

## Astrobot Feature Coverage

### ✅ Fully Supported Features

| Feature | Required Files | Status |
|---------|---------------|--------|
| **Natal Chart Calculation** | sepl_*.se1, semo_*.se1 | ✅ |
| **ASC/MC/IC/DSC** | sepl_*.se1 | ✅ |
| **Planets in Signs** | sepl_*.se1 | ✅ |
| **Planets in Houses** | sepl_*.se1 | ✅ |
| **Lunar Nodes** | semo_*.se1 | ✅ |
| **Chiron** | seas_*.se1 | ✅ |
| **Main Asteroids** | seas_*.se1 | ✅ |
| **Aspects** | sepl_*.se1 | ✅ |
| **Aspect Configurations** | sepl_*.se1 | ✅ |
| **Stelliums** | sepl_*.se1 | ✅ |
| **Cosmogram Patterns** | sepl_*.se1 | ✅ |
| **Element/Mode Balances** | sepl_*.se1 | ✅ |
| **Dignity Calculations** | sepl_*.se1 | ✅ |
| **Psychological Profile** | sepl_*.se1, semo_*.se1 | ✅ |
| **Karmic Analysis** | sepl_*.se1, semo_*.se1 | ✅ |
| **Thematic Analysis** | sepl_*.se1 | ✅ |
| **Fixed Star Conjunctions** | sefstars.txt | ✅ |
| **High Precision** | de406.eph | ✅ |

### ⚠️ Partially Supported (Optional)

| Feature | Required Files | Status |
|---------|---------------|--------|
| **Extended Asteroids** | ast0-ast623 folders | ❌ Download on demand |
| **Ancient Charts (<-3000)** | de431.eph | ❌ Optional |
| **Far Future (>+3000)** | de431.eph | ❌ Optional |

---

## Quick Decision Guide

### Do I need to download more files?

**NO, if you need:**
- ✅ Standard natal chart calculations
- ✅ All planets Sun through Pluto
- ✅ Moon, Chiron, main asteroids
- ✅ Dates between -3000 and +3000
- ✅ Professional-grade precision
- ✅ Fixed star conjunctions
- ✅ All Astrobot features

**YES, only if you need:**
- ❌ Specific numbered asteroids beyond the main 5
- ❌ Charts before year -3000
- ❌ Charts after year +3000
- ❌ Specialized asteroid astrology

---

## File Naming Conventions

### SE1 Files
```
sepl_XX.se1  - Planets (XX = century start)
semo_XX.se1  - Moon
seas_XX.se1  - Main asteroids
```

Examples:
- `sepl_00.se1` - Planets for years 0-599 CE
- `sepl_18.se1` - Planets for years 1800-2399 CE
- `seplm06.se1` - Planets for years 600-1 BCE

### Asteroid Files
```
astN/seXXXXX.se1  - Asteroid number XXXXX in folder N
```

Examples:
- `ast0/se00433.se1` - Asteroid 433 (Eros)
- `ast1/se01221.se1` - Asteroid 1221 (Amor)

### JPL Files
```
deXXX.eph  - JPL Development Ephemeris number XXX
```

Examples:
- `de406.eph` - JPL DE406 (installed)
- `de431.eph` - JPL DE431 (not installed)

---

## Performance Notes

### File Access Speed

| File Type | Speed | Use Case |
|-----------|-------|----------|
| EP4 Files | ⚡⚡⚡ Fastest | Modern dates (1960-2265) |
| SE1 Files | ⚡⚡ Fast | All dates, standard precision |
| JPL Files | ⚡ Slower | Maximum precision needed |

**Recommendation:** Use SE1 files for standard calculations, JPL for maximum precision.

---

## Disk Space Planning

### Current Usage
```
Essential SE1:     30 MB
JPL DE406:        190 MB
EP4 Fast:         300 MB
Other:              5 MB
─────────────────────────
Total:            525 MB ✅
```

### If You Add Common Asteroids
```
Current:          525 MB
ast0-ast5:        150 MB
─────────────────────────
Total:            675 MB
```

### Maximum Possible
```
Current:          525 MB
All Asteroids:  29,000 MB
Long Asteroids: 11,000 MB
DE431:           2,600 MB
DE441:           2,600 MB
─────────────────────────
Total:          45,725 MB (45 GB)
```

**Recommendation:** Stay at 525 MB (current) or max 700 MB (with common asteroids)

---

## Summary

✅ **Your installation is COMPLETE and OPTIMAL**

- All Astrobot features fully supported
- 6000-year time range coverage
- Professional-grade precision
- Fast performance
- Minimal disk space (525 MB)

**No additional downloads required for production use.**

---

For detailed analysis, see `EPHEMERIS_FILES_ANALYSIS.md`

