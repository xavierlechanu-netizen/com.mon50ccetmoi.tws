#ifndef _MATH_H_STUB
#define _MATH_H_STUB

#ifdef __cplusplus
extern "C" {
#endif

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#ifndef PI
#define PI 3.14159265358979323846
#endif

double sqrt(double x);
float sqrtf(float x);
double atan2(double y, double x);
float atan2f(float y, float x);
double fabs(double x);
float fabsf(float x);
double fmod(double x, double y);
float fmodf(float x, float y);
double sin(double x);
double cos(double x);

#ifdef __cplusplus
}
#endif

#endif
