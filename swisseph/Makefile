################################################################################
# Swiss Ephemeris Library Makefile
#
# This Makefile builds the Swiss Ephemeris library and tools.
#
# Targets:
#    all         - Build library and all executables
#    libswe.a    - Create the static library
#    libswe.$(DYLIB_EXT) - Create the shared library
#    swetest     - Build the swetest executable
#    swevents    - Build the swevents executable
#    swemini     - Build the swemini executable
#    test        - Run tests from the setest directory
#    clean       - Remove all generated files
################################################################################

# Detect OS type via uname
OS := $(shell uname)

ifeq ($(OS), Darwin)
  # macOS settings
  CC               = cc
  CFLAGS           = -g -Wall -fPIC
  LIBS             = -lm
  DYLIB_FLAG       = -dynamiclib
  DYLIB_EXT        = dylib
  STATIC_SUPPORTED = false
else
  # Assume Linux settings
  CC               = cc
  CFLAGS           = -g -Wall -fPIC
  LIBS             = -lm -ldl
  DYLIB_FLAG       = -shared
  DYLIB_EXT        = so
  STATIC_SUPPORTED = true
  STATIC_LINK_FLAGS= -Wl,-Bstatic
  DYNAMIC_LINK_FLAGS= -Wl,-Bdynamic
endif

# Directories
SRC_DIR = src
BIN_DIR = bin
EPHE_DIR = ephe

# Object files for the Swiss Ephemeris library
SWEOBJ = $(SRC_DIR)/swedate.o $(SRC_DIR)/swehouse.o $(SRC_DIR)/swejpl.o \
         $(SRC_DIR)/swemmoon.o $(SRC_DIR)/swemplan.o $(SRC_DIR)/sweph.o \
         $(SRC_DIR)/swephlib.o $(SRC_DIR)/swecl.o $(SRC_DIR)/swehel.o

# Define overall targets
ifeq ($(STATIC_SUPPORTED),true)
ALL_TARGETS = libswe.a $(BIN_DIR)/swetest $(BIN_DIR)/swetests $(BIN_DIR)/swevents $(BIN_DIR)/swemini
else
ALL_TARGETS = libswe.a $(BIN_DIR)/swetest $(BIN_DIR)/swevents $(BIN_DIR)/swemini
endif

all: $(ALL_TARGETS)

# Compile .c files to .o files
$(SRC_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) $(CFLAGS) -I$(SRC_DIR) -c $< -o $@

# Create a static library from the object files
libswe.a: $(SWEOBJ)
	ar r libswe.a $(SWEOBJ)

# Create a shared library
libswe.$(DYLIB_EXT): $(SWEOBJ)
	$(CC) $(DYLIB_FLAG) -o libswe.$(DYLIB_EXT) $(SWEOBJ)

# Build swetest: link swetest.o with the static library libswe.a
$(BIN_DIR)/swetest: $(SRC_DIR)/swetest.o libswe.a
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $(BIN_DIR)/swetest $(SRC_DIR)/swetest.o -L. -lswe $(LIBS)

# Build swetests: fully statically linked version (Linux only)
ifeq ($(STATIC_SUPPORTED),true)
$(BIN_DIR)/swetests: $(SRC_DIR)/swetest.o $(SWEOBJ)
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) $(STATIC_LINK_FLAGS) -o $(BIN_DIR)/swetests $(SRC_DIR)/swetest.o $(SWEOBJ) $(DYNAMIC_LINK_FLAGS) $(LIBS)
endif

# Build swevents
$(BIN_DIR)/swevents: $(SRC_DIR)/swevents.o $(SWEOBJ)
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $(BIN_DIR)/swevents $(SRC_DIR)/swevents.o $(SWEOBJ) $(LIBS)

# Build swemini
$(BIN_DIR)/swemini: $(SRC_DIR)/swemini.o libswe.a
	@mkdir -p $(BIN_DIR)
	$(CC) $(CFLAGS) -o $(BIN_DIR)/swemini $(SRC_DIR)/swemini.o -L. -lswe $(LIBS)

# Test targets
test:
	cd setest && $(MAKE) && ./setest t

test.exp:
	cd setest && $(MAKE) && ./setest -g t

# Clean up build artifacts
clean:
	rm -f $(SRC_DIR)/*.o libswe.* $(BIN_DIR)/*
	cd setest && $(MAKE) clean

# Dependency rules
$(SRC_DIR)/swecl.o: $(SRC_DIR)/swejpl.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swephexp.h $(SRC_DIR)/swedll.h $(SRC_DIR)/sweph.h $(SRC_DIR)/swephlib.h
$(SRC_DIR)/swedate.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h
$(SRC_DIR)/swehel.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h
$(SRC_DIR)/swehouse.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h $(SRC_DIR)/swephlib.h $(SRC_DIR)/swehouse.h
$(SRC_DIR)/swejpl.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h $(SRC_DIR)/sweph.h $(SRC_DIR)/swejpl.h
$(SRC_DIR)/swemini.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h
$(SRC_DIR)/swemmoon.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h $(SRC_DIR)/sweph.h $(SRC_DIR)/swephlib.h
$(SRC_DIR)/swemplan.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h $(SRC_DIR)/sweph.h $(SRC_DIR)/swephlib.h $(SRC_DIR)/swemptab.h
$(SRC_DIR)/sweph.o: $(SRC_DIR)/swejpl.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swephexp.h $(SRC_DIR)/swedll.h $(SRC_DIR)/sweph.h $(SRC_DIR)/swephlib.h
$(SRC_DIR)/swephlib.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h $(SRC_DIR)/sweph.h $(SRC_DIR)/swephlib.h
$(SRC_DIR)/swetest.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h
$(SRC_DIR)/swevents.o: $(SRC_DIR)/swephexp.h $(SRC_DIR)/sweodef.h $(SRC_DIR)/swedll.h

.PHONY: all test test.exp clean

