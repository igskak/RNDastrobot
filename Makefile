################################################################################
# Root Makefile for Swiss Ephemeris Project
#
# This Makefile coordinates building both the Swiss Ephemeris library
# and the natal chart applications.
#
# Targets:
#    all       - Build everything (library and applications)
#    swisseph  - Build only the Swiss Ephemeris library
#    app       - Build only the natal chart applications
#    test      - Run Swiss Ephemeris tests
#    clean     - Clean all build artifacts
################################################################################

.PHONY: all swisseph app test clean help

all: swisseph app

swisseph:
	cd swisseph && $(MAKE)

app: swisseph
	cd app && $(MAKE)

test:
	cd swisseph && $(MAKE) test

clean:
	cd swisseph && $(MAKE) clean
	cd app && $(MAKE) clean

help:
	@echo "Swiss Ephemeris Project Build System"
	@echo "====================================="
	@echo ""
	@echo "Targets:"
	@echo "  all       - Build everything (library and applications)"
	@echo "  swisseph  - Build only the Swiss Ephemeris library"
	@echo "  app       - Build only the natal chart applications"
	@echo "  test      - Run Swiss Ephemeris tests"
	@echo "  clean     - Clean all build artifacts"
	@echo ""
	@echo "Quick Start:"
	@echo "  make all                    # Build everything"
	@echo "  ./app/bin/natal_chart       # Run natal chart calculator"
	@echo "  ./app/bin/natal_chart_json  # Run JSON version"

