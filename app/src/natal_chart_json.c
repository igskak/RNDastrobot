/*
 * natal_chart_json.c - Generate natal chart data in JSON format
 * 
 * This program calculates natal chart data and outputs it in JSON format
 * for easy integration with web applications and other software.
 * 
 * Input: Birth date, time, and geographic location
 * Output: Complete natal chart data in JSON format
 * 
 * Authors: Based on Swiss Ephemeris by Dieter Koch and Alois Treindl
 */

#include "swephexp.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAX_PLANETS 15

/* Zodiac sign names */
const char *zodiac_signs[] = {
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
};

/* Structure to hold birth data */
typedef struct {
    int year;
    int month;
    int day;
    double hour;
    double latitude;
    double longitude;
    char location[100];
    int house_system;
} BirthData;

/* Get zodiac sign and position within sign */
void get_zodiac_position(double longitude, int *sign, double *sign_pos) {
    *sign = (int)(longitude / 30.0);
    *sign_pos = longitude - (*sign * 30.0);
}

/* Determine which house a planet is in */
int get_house_position(double planet_lon, double *cusps, int num_houses) {
    int i;
    for (i = 1; i < num_houses; i++) {
        double cusp1 = cusps[i];
        double cusp2 = cusps[i + 1];
        
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
    return 12;
}

/* Escape string for JSON */
void json_escape_string(const char *input, char *output, int max_len) {
    int i = 0, j = 0;
    while (input[i] != '\0' && j < max_len - 2) {
        if (input[i] == '"' || input[i] == '\\') {
            output[j++] = '\\';
        }
        output[j++] = input[i++];
    }
    output[j] = '\0';
}

/* Main program */
int main(int argc, char *argv[]) {
    BirthData bd;
    double tjd_ut, tjd_et;
    double cusps[37], ascmc[10];
    char serr[AS_MAXCH];
    int i;
    
    // Set ephemeris path
    swe_set_ephe_path("./swisseph/ephe");
    
    // Default birth data
    bd.year = 1990;
    bd.month = 3;
    bd.day = 15;
    bd.hour = 14.5;
    bd.latitude = 40.7128;
    bd.longitude = -74.0060;
    strcpy(bd.location, "New York, NY, USA");
    bd.house_system = 'P';
    
    // Parse command line arguments
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
    
    // Calculate houses
    swe_houses(tjd_ut, bd.latitude, bd.longitude, bd.house_system, cusps, ascmc);
    
    // Start JSON output
    printf("{\n");
    
    // Birth data
    printf("  \"birth_data\": {\n");
    printf("    \"date\": \"%04d-%02d-%02d\",\n", bd.year, bd.month, bd.day);
    printf("    \"time_ut\": \"%.2f\",\n", bd.hour);
    printf("    \"location\": \"%s\",\n", bd.location);
    printf("    \"latitude\": %.6f,\n", bd.latitude);
    printf("    \"longitude\": %.6f,\n", bd.longitude);
    printf("    \"julian_day\": %.6f,\n", tjd_ut);
    printf("    \"house_system\": \"%c\"\n", bd.house_system);
    printf("  },\n");
    
    // Angles
    printf("  \"angles\": {\n");
    int sign;
    double sign_pos;
    get_zodiac_position(ascmc[0], &sign, &sign_pos);
    printf("    \"ascendant\": {\n");
    printf("      \"longitude\": %.6f,\n", ascmc[0]);
    printf("      \"sign\": \"%s\",\n", zodiac_signs[sign]);
    printf("      \"sign_position\": %.6f\n", sign_pos);
    printf("    },\n");
    
    get_zodiac_position(ascmc[1], &sign, &sign_pos);
    printf("    \"mc\": {\n");
    printf("      \"longitude\": %.6f,\n", ascmc[1]);
    printf("      \"sign\": \"%s\",\n", zodiac_signs[sign]);
    printf("      \"sign_position\": %.6f\n", sign_pos);
    printf("    },\n");
    
    get_zodiac_position(ascmc[2], &sign, &sign_pos);
    printf("    \"armc\": {\n");
    printf("      \"longitude\": %.6f,\n", ascmc[2]);
    printf("      \"sign\": \"%s\",\n", zodiac_signs[sign]);
    printf("      \"sign_position\": %.6f\n", sign_pos);
    printf("    },\n");
    
    get_zodiac_position(ascmc[3], &sign, &sign_pos);
    printf("    \"vertex\": {\n");
    printf("      \"longitude\": %.6f,\n", ascmc[3]);
    printf("      \"sign\": \"%s\",\n", zodiac_signs[sign]);
    printf("      \"sign_position\": %.6f\n", sign_pos);
    printf("    }\n");
    printf("  },\n");
    
    // Houses
    printf("  \"houses\": [\n");
    for (i = 1; i <= 12; i++) {
        get_zodiac_position(cusps[i], &sign, &sign_pos);
        printf("    {\n");
        printf("      \"house\": %d,\n", i);
        printf("      \"longitude\": %.6f,\n", cusps[i]);
        printf("      \"sign\": \"%s\",\n", zodiac_signs[sign]);
        printf("      \"sign_position\": %.6f\n", sign_pos);
        printf("    }%s\n", i < 12 ? "," : "");
    }
    printf("  ],\n");
    
    // Planets
    int planets_to_calc[] = {
        SE_SUN, SE_MOON, SE_MERCURY, SE_VENUS, SE_MARS,
        SE_JUPITER, SE_SATURN, SE_URANUS, SE_NEPTUNE, SE_PLUTO,
        SE_MEAN_NODE, SE_TRUE_NODE, SE_CHIRON
    };
    
    const char *planet_names[] = {
        "Sun", "Moon", "Mercury", "Venus", "Mars",
        "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
        "Mean Node", "True Node", "Chiron"
    };
    
    int num_planets = sizeof(planets_to_calc) / sizeof(planets_to_calc[0]);
    double xx[6];
    int32 iflag = SEFLG_SWIEPH | SEFLG_SPEED;
    
    printf("  \"planets\": [\n");
    
    for (i = 0; i < num_planets; i++) {
        int ipl = planets_to_calc[i];
        
        int32 iflgret = swe_calc(tjd_et, ipl, iflag, xx, serr);
        if (iflgret < 0) {
            continue;
        }
        
        get_zodiac_position(xx[0], &sign, &sign_pos);
        int house = get_house_position(xx[0], cusps, 12);
        AS_BOOL retrograde = (xx[3] < 0) ? TRUE : FALSE;
        
        printf("    {\n");
        printf("      \"name\": \"%s\",\n", planet_names[i]);
        printf("      \"longitude\": %.6f,\n", xx[0]);
        printf("      \"latitude\": %.6f,\n", xx[1]);
        printf("      \"distance\": %.6f,\n", xx[2]);
        printf("      \"speed\": %.6f,\n", xx[3]);
        printf("      \"sign\": \"%s\",\n", zodiac_signs[sign]);
        printf("      \"sign_position\": %.6f,\n", sign_pos);
        printf("      \"house\": %d,\n", house);
        printf("      \"retrograde\": %s\n", retrograde ? "true" : "false");
        printf("    }%s\n", i < num_planets - 1 ? "," : "");
    }
    
    printf("  ]\n");
    printf("}\n");
    
    // Clean up
    swe_close();
    
    return 0;
}

