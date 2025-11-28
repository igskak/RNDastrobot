# Swiss Ephemeris Project

This project combines the Swiss Ephemeris astronomical calculation library with custom natal chart calculation applications.

## Project Structure

```
swisseph/                    # Root project directory
├── swisseph/               # Swiss Ephemeris library
│   ├── src/               # Swiss Ephemeris C source files
│   ├── include/           # Swiss Ephemeris headers
│   ├── ephe/              # Ephemeris data files
│   ├── doc/               # Swiss Ephemeris documentation
│   ├── contrib/           # Contributed code
│   ├── setest/            # Swiss Ephemeris tests
│   ├── windows/           # Windows-specific files
│   ├── bin/               # Compiled Swiss Ephemeris tools
│   └── README.md          # Swiss Ephemeris documentation
├── app/                    # Natal chart applications
│   ├── src/               # Application source code
│   ├── bin/               # Compiled applications
│   └── README.md          # Application documentation
├── Makefile               # Root build system
└── README.md              # This file
```

## Quick Start

```bash
# Build everything
make all

# Run natal chart calculator (text output)
./app/bin/natal_chart

# Run natal chart calculator (JSON output)
./app/bin/natal_chart_json

# With custom birth data
./app/bin/natal_chart 15 3 1990 14.5 40.7128 -74.0060 "New York" P
```

## Building

```bash
# Build everything (library + applications)
make all

# Build only the Swiss Ephemeris library
make swisseph

# Build only the applications
make app

# Run tests
make test

# Clean all build artifacts
make clean

# Show help
make help
```

## Components

### Swiss Ephemeris Library
High-precision astronomical calculation library developed by Dieter Koch and Alois Treindl.
- Planetary positions with JPL precision
- House calculations
- Fixed stars
- Eclipses and planetary phenomena
- See `swisseph/README.md` for detailed documentation

### Natal Chart Applications
Custom applications for astrological natal chart calculations:
- **natal_chart** - Human-readable text output
- **natal_chart_json** - JSON format for integration
- See `app/README.md` for usage details

## Requirements

- C compiler (gcc, clang, or compatible)
- Make build system
- Ephemeris data files (included in `swisseph/ephe/`)

## License

- **Swiss Ephemeris**: AGPL-3.0 (see `swisseph/LICENSE.TXT`)
- **Applications**: See `LICENSE`

## Documentation

- Swiss Ephemeris documentation: `swisseph/doc/`
- Application documentation: `app/README.md`
- Swiss Ephemeris website: https://www.astro.com/swisseph

## Support

For Swiss Ephemeris support:
- Mailing list: https://groups.io/g/swisseph
- Email: swisseph@groups.io

## Credits

- **Swiss Ephemeris**: Dieter Koch and Alois Treindl (Astrodienst AG)
- **Natal Chart Applications**: Built on Swiss Ephemeris

