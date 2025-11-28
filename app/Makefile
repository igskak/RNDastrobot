################################################################################
# Natal Chart Application Makefile
#
# This Makefile builds the natal chart calculation applications.
#
# Targets:
#    all              - Build all applications
#    natal_chart      - Build the text output version
#    natal_chart_json - Build the JSON output version
#    clean            - Remove all generated files
################################################################################

# Detect OS type via uname
OS := $(shell uname)

ifeq ($(OS), Darwin)
  # macOS settings
  CC     = cc
  CFLAGS = -g -Wall -fPIC
  LIBS   = -lm
else
  # Assume Linux settings
  CC     = cc
  CFLAGS = -g -Wall -fPIC
  LIBS   = -lm -ldl
endif

# Directories
SRC_DIR = src
BIN_DIR = bin
SWISSEPH_DIR = ../swisseph
SWISSEPH_SRC = $(SWISSEPH_DIR)/src
SWISSEPH_LIB = $(SWISSEPH_DIR)/libswe.a

# Targets
all: $(BIN_DIR)/natal_chart $(BIN_DIR)/natal_chart_json

# Ensure Swiss Ephemeris library is built
$(SWISSEPH_LIB):
	cd $(SWISSEPH_DIR) && $(MAKE) libswe.a

# Compile .c files to .o files
$(SRC_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) $(CFLAGS) -I$(SWISSEPH_SRC) -c $< -o $@

# Build natal_chart
$(BIN_DIR)/natal_chart: $(SRC_DIR)/natal_chart.o $(SWISSEPH_LIB)
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $(BIN_DIR)/natal_chart $(SRC_DIR)/natal_chart.o -L$(SWISSEPH_DIR) -lswe $(LIBS)

# Build natal_chart_json
$(BIN_DIR)/natal_chart_json: $(SRC_DIR)/natal_chart_json.o $(SWISSEPH_LIB)
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $(BIN_DIR)/natal_chart_json $(SRC_DIR)/natal_chart_json.o -L$(SWISSEPH_DIR) -lswe $(LIBS)

# Clean up build artifacts
clean:
	rm -f $(SRC_DIR)/*.o $(BIN_DIR)/*

# Dependency rules
$(SRC_DIR)/natal_chart.o: $(SWISSEPH_SRC)/swephexp.h $(SWISSEPH_SRC)/sweodef.h $(SWISSEPH_SRC)/swedll.h
$(SRC_DIR)/natal_chart_json.o: $(SWISSEPH_SRC)/swephexp.h $(SWISSEPH_SRC)/sweodef.h $(SWISSEPH_SRC)/swedll.h

.PHONY: all clean

