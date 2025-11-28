/*
 * natal_chart.c - Generate natal chart data based on birth information
 * 
 * This program calculates:
 * - Planetary positions (Sun through Pluto, plus Chiron and Lunar Nodes)
 * - House cusps (12 houses)
 * - Ascendant, MC, and other important angles
 * - Aspects between planets (optional)
 * 
 * Input: Birth date, time, and geographic location
 * Output: Complete natal chart data
 * 
 * Authors: Based on Swiss Ephemeris by Dieter Koch and Alois Treindl
 */

#include "swephexp.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAX_PLANETS 15

/* Planet names for output */
const char *planet_names[] = {
    "Sun", "Moon", "Mercury", "Venus", "Mars",
    "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
    "Mean Node", "True Node", "Chiron", "Lilith", "Ascendant"
};

/* Zodiac sign names */
const char *zodiac_signs[] = {
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
};

/* House system names */
const char *house_systems[] = {
    "P - Placidus",
    "K - Koch",
    "O - Porphyrius",
    "R - Regiomontanus",
    "C - Campanus",
    "E - Equal (from Asc)",
    "W - Whole Sign"
};

/* Structure to hold birth data */
typedef struct {
    int year;
    int month;
    int day;
    double hour;
    double latitude;
    double longitude;
    char timezone[10];
    char location[100];
    int house_system;  // 'P', 'K', 'O', 'R', 'C', 'E', 'W'
} BirthData;

/* Structure to hold planet data */
typedef struct {
    int planet_id;
    const char *name;
    double longitude;
    double latitude;
    double distance;
    double speed_lon;
    int sign;
    double sign_pos;
    int house;
    AS_BOOL retrograde;
} PlanetData;

/* Convert decimal degrees to degrees, minutes, seconds */
void deg_to_dms(double deg, int *d, int *m, int *s) {
    *d = (int)deg;
    double remainder = (deg - *d) * 60.0;
    *m = (int)remainder;
    *s = (int)((remainder - *m) * 60.0);
}

/* Get zodiac sign and position within sign */
void get_zodiac_position(double longitude, int *sign, double *sign_pos) {
    *sign = (int)(longitude / 30.0);
    *sign_pos = longitude - (*sign * 30.0);
}

/* Format longitude as zodiac notation */
void format_zodiac(double longitude, char *output) {
    int sign;
    double sign_pos;
    int deg, min, sec;
    
    get_zodiac_position(longitude, &sign, &sign_pos);
    deg_to_dms(sign_pos, &deg, &min, &sec);
    
    sprintf(output, "%2d°%02d'%02d\" %s", deg, min, sec, zodiac_signs[sign]);
}

/* Determine which house a planet is in */
int get_house_position(double planet_lon, double *cusps, int num_houses) {
    int i;
    for (i = 1; i < num_houses; i++) {
        double cusp1 = cusps[i];
        double cusp2 = cusps[i + 1];
        
        // Handle wrap-around at 360/0 degrees
        if (cusp2 < cusp1) {
            if (planet_lon >= cusp1 || planet_lon < cusp2) {
                return i;
            }
        } else {
            if (planet_lon >= cusp1 && planet_lon < cusp2) {
                return i;
            }
        }
    }
    return 12; // Last house
}

/* Print birth data summary */
void print_birth_data(BirthData *bd, double tjd_ut) {
    printf("\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("                    NATAL CHART DATA                          \n");
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("\n");
    printf("Birth Date:     %02d/%02d/%04d\n", bd->day, bd->month, bd->year);
    printf("Birth Time:     %02d:%02d (UT)\n", (int)bd->hour, (int)((bd->hour - (int)bd->hour) * 60));
    printf("Location:       %s\n", bd->location);
    printf("Coordinates:    %.4f°%s, %.4f°%s\n", 
           fabs(bd->latitude), bd->latitude >= 0 ? "N" : "S",
           fabs(bd->longitude), bd->longitude >= 0 ? "E" : "W");
    printf("Julian Day:     %.6f\n", tjd_ut);
    printf("\n");
}

/* Calculate and print planetary positions */
void calculate_planets(double tjd_et, double tjd_ut, double *cusps, PlanetData *planets, int *planet_count) {
    int planets_to_calc[] = {
        SE_SUN, SE_MOON, SE_MERCURY, SE_VENUS, SE_MARS,
        SE_JUPITER, SE_SATURN, SE_URANUS, SE_NEPTUNE, SE_PLUTO,
        SE_MEAN_NODE, SE_TRUE_NODE, SE_CHIRON
    };
    
    int num_planets = sizeof(planets_to_calc) / sizeof(planets_to_calc[0]);
    double xx[6];
    char serr[AS_MAXCH];
    int32 iflag = SEFLG_SWIEPH | SEFLG_SPEED;
    int i;
    
    printf("───────────────────────────────────────────────────────────────\n");
    printf("                    PLANETARY POSITIONS                        \n");
    printf("───────────────────────────────────────────────────────────────\n");
    printf("%-12s %15s %10s %8s %6s\n", "Planet", "Position", "Longitude", "House", "Speed");
    printf("───────────────────────────────────────────────────────────────\n");
    
    *planet_count = 0;
    for (i = 0; i < num_planets; i++) {
        int ipl = planets_to_calc[i];
        char snam[40];
        char zodiac_str[40];
        
        swe_get_planet_name(ipl, snam);
        
        int32 iflgret = swe_calc(tjd_et, ipl, iflag, xx, serr);
        if (iflgret < 0) {
            printf("%-12s ERROR: %s\n", snam, serr);
            continue;
        }
        
        // Store planet data
        planets[*planet_count].planet_id = ipl;
        planets[*planet_count].name = planet_names[i];
        planets[*planet_count].longitude = xx[0];
        planets[*planet_count].latitude = xx[1];
        planets[*planet_count].distance = xx[2];
        planets[*planet_count].speed_lon = xx[3];
        get_zodiac_position(xx[0], &planets[*planet_count].sign, &planets[*planet_count].sign_pos);
        planets[*planet_count].house = get_house_position(xx[0], cusps, 12);
        planets[*planet_count].retrograde = (xx[3] < 0) ? TRUE : FALSE;
        
        format_zodiac(xx[0], zodiac_str);
        
        printf("%-12s %15s %10.4f° %5d %7.4f%s\n",
               snam,
               zodiac_str,
               xx[0],
               planets[*planet_count].house,
               xx[3],
               planets[*planet_count].retrograde ? " R" : "");
        
        (*planet_count)++;
    }
    printf("\n");
}

/* Calculate and print house cusps */
void calculate_houses(double tjd_ut, BirthData *bd, double *cusps, double *ascmc) {
    char serr[AS_MAXCH];
    int hsys = bd->house_system;
    
    int retc = swe_houses(tjd_ut, bd->latitude, bd->longitude, hsys, cusps, ascmc);
    
    printf("───────────────────────────────────────────────────────────────\n");
    printf("                    HOUSE CUSPS (%c)                           \n", hsys);
    printf("───────────────────────────────────────────────────────────────\n");
    
    int i;
    for (i = 1; i <= 12; i++) {
        char zodiac_str[40];
        format_zodiac(cusps[i], zodiac_str);
        printf("House %2d:  %15s  (%10.4f°)\n", i, zodiac_str, cusps[i]);
    }
    printf("\n");
    
    printf("───────────────────────────────────────────────────────────────\n");
    printf("                    ANGLES & POINTS                            \n");
    printf("───────────────────────────────────────────────────────────────\n");
    
    char zodiac_str[40];
    
    format_zodiac(ascmc[0], zodiac_str);
    printf("Ascendant:   %15s  (%10.4f°)\n", zodiac_str, ascmc[0]);
    
    format_zodiac(ascmc[1], zodiac_str);
    printf("MC:          %15s  (%10.4f°)\n", zodiac_str, ascmc[1]);
    
    format_zodiac(ascmc[2], zodiac_str);
    printf("ARMC:        %15s  (%10.4f°)\n", zodiac_str, ascmc[2]);
    
    format_zodiac(ascmc[3], zodiac_str);
    printf("Vertex:      %15s  (%10.4f°)\n", zodiac_str, ascmc[3]);
    
    printf("\n");
}

/* Main program */
int main(int argc, char *argv[]) {
    BirthData bd;
    double tjd_ut, tjd_et;
    double cusps[37], ascmc[10];
    PlanetData planets[MAX_PLANETS];
    int planet_count;
    char serr[AS_MAXCH];
    
    // Set ephemeris path
    swe_set_ephe_path("./swisseph/ephe");
    
    // Example birth data - can be modified or read from input
    bd.year = 1990;
    bd.month = 3;
    bd.day = 15;
    bd.hour = 14.5;  // 14:30 UT
    bd.latitude = 40.7128;   // New York
    bd.longitude = -74.0060;
    strcpy(bd.location, "New York, NY, USA");
    bd.house_system = 'P';  // Placidus
    
    // If command line arguments provided, use them
    if (argc >= 7) {
        bd.day = atoi(argv[1]);
        bd.month = atoi(argv[2]);
        bd.year = atoi(argv[3]);
        bd.hour = atof(argv[4]);
        bd.latitude = atof(argv[5]);
        bd.longitude = atof(argv[6]);
        if (argc >= 8) {
            strncpy(bd.location, argv[7], sizeof(bd.location) - 1);
        }
        if (argc >= 9) {
            bd.house_system = argv[8][0];
        }
    }
    
    // Calculate Julian Day
    tjd_ut = swe_julday(bd.year, bd.month, bd.day, bd.hour, SE_GREG_CAL);
    tjd_et = tjd_ut + swe_deltat(tjd_ut);
    
    // Print birth data
    print_birth_data(&bd, tjd_ut);
    
    // Calculate houses first (needed for planet house positions)
    calculate_houses(tjd_ut, &bd, cusps, ascmc);
    
    // Calculate planetary positions
    calculate_planets(tjd_et, tjd_ut, cusps, planets, &planet_count);
    
    printf("═══════════════════════════════════════════════════════════════\n");
    printf("Calculation complete. Use -edir./ephe if ephemeris files needed.\n");
    printf("═══════════════════════════════════════════════════════════════\n");
    
    // Clean up
    swe_close();
    
    return 0;
}

