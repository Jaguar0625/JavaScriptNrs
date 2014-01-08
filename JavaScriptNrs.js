
/* Ported to JavaScript from Java 07/01/14.
 *
 * Ported from C to Java by Dmitry Skiba [sahn0], 23/02/08.
 * Original: http://cds.xs4all.nl:8081/ecdh/
 */
/* Generic 64-bit integer implementation of Curve25519 ECDH
 * Written by Matthijs van Duin, 200608242056
 * Public domain.
 *
 * Based on work by Daniel J Bernstein, http://cr.yp.to/ecdh.html
 */

/* key size */
var KEY_SIZE = 32;

/* 0 */
var ZERO = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
];

/* the prime 2^255-19 */
var PRIME = [
    237, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 127
];

/* group order (a prime near 2^252+2^124) */
var ORDER = [
    237, 211, 245, 92,
    26,  99,  18,  88,
    214, 156, 247, 162,
    222, 249, 222, 20,
    0,   0,   0,   0,
    0,   0,   0,   0,
    0,   0,   0,   0,
    0,   0,   0,   16
];

/* smallest multiple of the order that's >= 2^255 */
var ORDER_TIMES_8 = [
    104, 159, 174, 231,
    210, 24,  147, 192,
    178, 230, 188, 23,
    245, 206, 247, 166,
    0,   0,   0,   0,
    0,   0,   0,   0,
    0,   0,   0,   0,
    0,   0,   0,   128
];

/*
 TODO: Java port isn't super clean and uses a long10 class instead of a raw array.
 TODO: Leaving it for now, but it's a bit awkward, and something that should probably be cleaned up.
*/

function long10(_0, _1, _2, _3, _4, _5, _6, _7, _8, _9) {
    return {
        _0: _0 || 0,
        _1: _1 || 0,
        _2: _2 || 0,
        _3: _3 || 0,
        _4: _4 || 0,
        _5: _5 || 0,
        _6: _6 || 0,
        _7: _7 || 0,
        _8: _8 || 0,
        _9: _9 || 0
    };
}

/* constants 2Gy and 1/(2Gy) */
var BASE_2Y = long10(
    39999547, 18689728, 59995525, 1648697, 57546132,
    24010086, 19059592, 5425144, 63499247, 16420658
);

var BASE_R2Y = long10(
    5744, 8160848, 4790893, 13779497, 35730846,
    12541209, 49101323, 30047407, 40071253, 6226132
);

/********* ARRAY HELPERS *********/

function createArray32() {
    return ZERO.slice(0);
}

function createZeroArray(length) {
    var a = [];
    for (var i = 0; i < length; ++i)
        a[i] = 0;

    return a;
}

/********* KEY AGREEMENT *********/

/* Private key clamping
 *   k [out] your private key for key agreement
 *   k  [in]  32 random bytes
 */
function clamp (k) {
    k[31] &= 0x7F;
    k[31] |= 0x40;
    k[ 0] &= 0xF8;
}

/********************* radix 2^8 math *********************/

function cpy32(d, s) {
    for (var i = 0; i < 32; i++)
        d[i] = s[i];
}

/* p[m..n+m-1] = q[m..n+m-1] + z * x */
/* n is the size of x */
/* n+m is the size of p and q */
function mula_small(p, q, m, x, n, z) {
    var v=0;
    for (var i=0;i<n;++i) {
        v+=(q[i+m] & 0xFF)+z*(x[i] & 0xFF);
        p[i+m]=v & 0xFF;
        v>>=8;
    }
    return v;
}

/* p += x * y * z  where z is a small integer
 * x is size 32, y is size t, p is size 32+t
 * y is allowed to overlap with p+32 if you don't care about the upper half  */
function mula32(p, x, y, t, z) {
    var n = 31;
    var w = 0;
    var i = 0;
    for (; i < t; i++) {
        var zy = z * (y[i] & 0xFF);
        w += mula_small(p, p, i, x, n, zy) +
            (p[i+n] & 0xFF) + zy * (x[n] & 0xFF);
        p[i+n] = w & 0xFF;
        w >>= 8;
    }
    p[i+n] = (w + (p[i+n] & 0xFF)) & 0xFF;
    return w >> 8;
}

/* divide r (size n) by d (size t), returning quotient q and remainder r
 * quotient is size n-t+1, remainder is size t
 * requires t > 0 && d[t-1] != 0
 * requires that r[-1] and d[-1] are valid memory locations
 * q may overlap with r+t */
function divmod(q, r, n, d, t) {
    var rn = 0;
    var dt = ((d[t-1] & 0xFF) << 8);
    if (t>1) {
        dt |= (d[t-2] & 0xFF);
    }
    while (n-- >= t) {
        var z = (rn << 16) | ((r[n] & 0xFF) << 8);
        if (n>0) {
            z |= (r[n-1] & 0xFF);
        }
        z/=dt;
        rn += mula_small(r,r, n-t+1, d, t, -z);
        q[n-t+1] = ((z + rn) & 0xFF); /* rn is 0 or -1 (underflow) */
        mula_small(r,r, n-t+1, d, t, -rn);
        rn = (r[n] & 0xFF);
        r[n] = 0;
    }
    r[t-1] = rn & 0xFF;
}

function numsize(x,n) {
    while (n--!=0 && x[n]==0)
        ;
    return n+1;
}

/* Returns x if a contains the gcd, y if b.
 * Also, the returned buffer contains the inverse of a mod b,
 * as 32-byte signed.
 * x and y must have 64 bytes space for temporary use.
 * requires that a[-1] and b[-1] are valid memory locations  */
function egcd32(x, y, a, b) {
    var an, bn = 32, qn, i;
    for (i = 0; i < 32; i++)
        x[i] = y[i] = 0;
    x[0] = 1;
    an = numsize(a, 32);
    if (an==0)
        return y;	/* division by zero */
    var temp=createArray32();
    while (true) {
        qn = bn - an + 1;
        divmod(temp, b, bn, a, an);
        bn = numsize(b, bn);
        if (bn==0)
            return x;
        mula32(y, x, temp, qn, -1);

        qn = an - bn + 1;
        divmod(temp, a, an, b, bn);
        an = numsize(a, an);
        if (an==0)
            return y;
        mula32(x, y, temp, qn, -1);
    }
}

/********************* radix 2^25.5 GF(2^255-19) math *********************/

var P25=33554431;	/* (1 << 25) - 1 */
var P26=67108863;	/* (1 << 26) - 1 */

/* Convert to internal format from little-endian byte format */
function unpack (x, m) {
    x._0 = ((m[0] & 0xFF))         | ((m[1] & 0xFF))<<8 |
        (m[2] & 0xFF)<<16      | ((m[3] & 0xFF)& 3)<<24;
    x._1 = ((m[3] & 0xFF)&~ 3)>>2  | (m[4] & 0xFF)<<6 |
        (m[5] & 0xFF)<<14 | ((m[6] & 0xFF)& 7)<<22;
    x._2 = ((m[6] & 0xFF)&~ 7)>>3  | (m[7] & 0xFF)<<5 |
        (m[8] & 0xFF)<<13 | ((m[9] & 0xFF)&31)<<21;
    x._3 = ((m[9] & 0xFF)&~31)>>5  | (m[10] & 0xFF)<<3 |
        (m[11] & 0xFF)<<11 | ((m[12] & 0xFF)&63)<<19;
    x._4 = ((m[12] & 0xFF)&~63)>>6 | (m[13] & 0xFF)<<2 |
        (m[14] & 0xFF)<<10 |  (m[15] & 0xFF)    <<18;
    x._5 =  (m[16] & 0xFF)         | (m[17] & 0xFF)<<8 |
        (m[18] & 0xFF)<<16 | ((m[19] & 0xFF)& 1)<<24;
    x._6 = ((m[19] & 0xFF)&~ 1)>>1 | (m[20] & 0xFF)<<7 |
        (m[21] & 0xFF)<<15 | ((m[22] & 0xFF)& 7)<<23;
    x._7 = ((m[22] & 0xFF)&~ 7)>>3 | (m[23] & 0xFF)<<5 |
        (m[24] & 0xFF)<<13 | ((m[25] & 0xFF)&15)<<21;
    x._8 = ((m[25] & 0xFF)&~15)>>4 | (m[26] & 0xFF)<<4 |
        (m[27] & 0xFF)<<12 | ((m[28] & 0xFF)&63)<<20;
    x._9 = ((m[28] & 0xFF)&~63)>>6 | (m[29] & 0xFF)<<2 |
        (m[30] & 0xFF)<<10 |  (m[31] & 0xFF)    <<18;
}

/* Check if reduced-form input >= 2^255-19 */
function is_overflow(x) {
    return (
        ((x._0 > P26-19)) &&
            ((x._1 & x._3 & x._5 & x._7 & x._9) == P25) &&
            ((x._2 & x._4 & x._6 & x._8) == P26)
        ) || (x._9 > P25);
}

/* Convert from internal format to little-endian byte format.  The
 * number must be in a reduced form which is output by the following ops:
 *     unpack, mul, sqr
 *     set --  if input in range 0 .. P25
 * If you're unsure if the number is reduced, first multiply it by 1.  */
function pack(x, m) {
    var ld = 0, ud = 0;
    var t;
    ld = (is_overflow(x)?1:0) - ((x._9 < 0)?1:0);
    ud = ld * -(P25+1);
    ld *= 19;
    t = ld + x._0 + (x._1 << 26);
    m[ 0] = t & 0xFF;
    m[ 1] = (t >> 8) & 0xFF;
    m[ 2] = (t >> 16) & 0xFF;
    m[ 3] = (t >> 24) & 0xFF;
    t = (t >> 32) + (x._2 << 19);
    m[ 4] = t & 0xFF;
    m[ 5] = (t >> 8) & 0xFF;
    m[ 6] = (t >> 16) & 0xFF;
    m[ 7] = (t >> 24) & 0xFF;
    t = (t >> 32) + (x._3 << 13);
    m[ 8] = t & 0xFF;
    m[ 9] = (t >> 8) & 0xFF;
    m[10] = (t >> 16) & 0xFF;
    m[11] = (t >> 24) & 0xFF;
    t = (t >> 32) + (x._4 <<  6);
    m[12] = t & 0xFF;
    m[13] = (t >> 8) & 0xFF;
    m[14] = (t >> 16) & 0xFF;
    m[15] = (t >> 24) & 0xFF;
    t = (t >> 32) + x._5 + (x._6 << 25);
    m[16] = t & 0xFF;
    m[17] = (t >> 8) & 0xFF;
    m[18] = (t >> 16) & 0xFF;
    m[19] = (t >> 24) & 0xFF;
    t = (t >> 32) + (x._7 << 19);
    m[20] = t & 0xFF;
    m[21] = (t >> 8) & 0xFF;
    m[22] = (t >> 16) & 0xFF;
    m[23] = (t >> 24) & 0xFF;
    t = (t >> 32) + (x._8 << 12);
    m[24] = t & 0xFF;
    m[25] = (t >> 8) & 0xFF;
    m[26] = (t >> 16) & 0xFF;
    m[27] = (t >> 24) & 0xFF;
    t = (t >> 32) + ((x._9 + ud) << 6);
    m[28] = t & 0xFF;
    m[29] = (t >> 8) & 0xFF;
    m[30] = (t >> 16) & 0xFF;
    m[31] = (t >> 24) & 0xFF;
}

/* Copy a number */
function cpy(l10_out, l10_in) {
    l10_out._0=l10_in._0;	l10_out._1=l10_in._1;
    l10_out._2=l10_in._2;	l10_out._3=l10_in._3;
    l10_out._4=l10_in._4;	l10_out._5=l10_in._5;
    l10_out._6=l10_in._6;	l10_out._7=l10_in._7;
    l10_out._8=l10_in._8;	l10_out._9=l10_in._9;
}

/* Set a number to value, which must be in range -185861411 .. 185861411 */
function set(l10_out, int_in) {
    l10_out._0=int_in;	l10_out._1=0;
    l10_out._2=0;	l10_out._3=0;
    l10_out._4=0;	l10_out._5=0;
    l10_out._6=0;	l10_out._7=0;
    l10_out._8=0;	l10_out._9=0;
}

/* Add/subtract two numbers.  The inputs must be in reduced form, and the
 * output isn't, so to do another addition or subtraction on the output,
 * first multiply it by one to reduce it. */
function add(xy, x, y) {
    xy._0 = x._0 + y._0;	xy._1 = x._1 + y._1;
    xy._2 = x._2 + y._2;	xy._3 = x._3 + y._3;
    xy._4 = x._4 + y._4;	xy._5 = x._5 + y._5;
    xy._6 = x._6 + y._6;	xy._7 = x._7 + y._7;
    xy._8 = x._8 + y._8;	xy._9 = x._9 + y._9;
}
function sub(xy, x, y) {
    xy._0 = x._0 - y._0;	xy._1 = x._1 - y._1;
    xy._2 = x._2 - y._2;	xy._3 = x._3 - y._3;
    xy._4 = x._4 - y._4;	xy._5 = x._5 - y._5;
    xy._6 = x._6 - y._6;	xy._7 = x._7 - y._7;
    xy._8 = x._8 - y._8;	xy._9 = x._9 - y._9;
}

/* Multiply a number by a small integer in range -185861411 .. 185861411.
 * The output is in reduced form, the input x need not be.  x and xy may point
 * to the same buffer. */
function mul_small(xy, x, y) {
    var t;
    t = (x._8*y);
    xy._8 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x._9*y);
    xy._9 = (t & ((1 << 25) - 1));
    t = 19 * (t >> 25) + (x._0*y);
    xy._0 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x._1*y);
    xy._1 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x._2*y);
    xy._2 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x._3*y);
    xy._3 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x._4*y);
    xy._4 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x._5*y);
    xy._5 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x._6*y);
    xy._6 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x._7*y);
    xy._7 = (t & ((1 << 25) - 1));
    t = (t >> 25) + xy._8;
    xy._8 = (t & ((1 << 26) - 1));
    xy._9 += (t >> 26);
    return xy;
}

/* Multiply two numbers.  The output is in reduced form, the inputs need not
 * be. */
function mul(xy, x, y) {
    /* sahn0:
     * Using local variables to avoid class access.
     * This seem to improve performance a bit...
     */
    var
    x_0=x._0,x_1=x._1,x_2=x._2,x_3=x._3,x_4=x._4,
        x_5=x._5,x_6=x._6,x_7=x._7,x_8=x._8,x_9=x._9;
    var
    y_0=y._0,y_1=y._1,y_2=y._2,y_3=y._3,y_4=y._4,
        y_5=y._5,y_6=y._6,y_7=y._7,y_8=y._8,y_9=y._9;
    var t;
    t = (x_0*y_8) + (x_2*y_6) + (x_4*y_4) + (x_6*y_2) +
        (x_8*y_0) + 2 * ((x_1*y_7) + (x_3*y_5) +
        (x_5*y_3) + (x_7*y_1)) + 38 *
        (x_9*y_9);
    xy._8 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x_0*y_9) + (x_1*y_8) + (x_2*y_7) +
        (x_3*y_6) + (x_4*y_5) + (x_5*y_4) +
        (x_6*y_3) + (x_7*y_2) + (x_8*y_1) +
        (x_9*y_0);
    xy._9 = (t & ((1 << 25) - 1));
    t = (x_0*y_0) + 19 * ((t >> 25) + (x_2*y_8) + (x_4*y_6)
        + (x_6*y_4) + (x_8*y_2)) + 38 *
        ((x_1*y_9) + (x_3*y_7) + (x_5*y_5) +
            (x_7*y_3) + (x_9*y_1));
    xy._0 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x_0*y_1) + (x_1*y_0) + 19 * ((x_2*y_9)
        + (x_3*y_8) + (x_4*y_7) + (x_5*y_6) +
        (x_6*y_5) + (x_7*y_4) + (x_8*y_3) +
        (x_9*y_2));
    xy._1 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x_0*y_2) + (x_2*y_0) + 19 * ((x_4*y_8)
        + (x_6*y_6) + (x_8*y_4)) + 2 * (x_1*y_1)
        + 38 * ((x_3*y_9) + (x_5*y_7) +
        (x_7*y_5) + (x_9*y_3));
    xy._2 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x_0*y_3) + (x_1*y_2) + (x_2*y_1) +
        (x_3*y_0) + 19 * ((x_4*y_9) + (x_5*y_8) +
        (x_6*y_7) + (x_7*y_6) +
        (x_8*y_5) + (x_9*y_4));
    xy._3 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x_0*y_4) + (x_2*y_2) + (x_4*y_0) + 19 *
        ((x_6*y_8) + (x_8*y_6)) + 2 * ((x_1*y_3) +
        (x_3*y_1)) + 38 *
        ((x_5*y_9) + (x_7*y_7) + (x_9*y_5));
    xy._4 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x_0*y_5) + (x_1*y_4) + (x_2*y_3) +
        (x_3*y_2) + (x_4*y_1) + (x_5*y_0) + 19 *
        ((x_6*y_9) + (x_7*y_8) + (x_8*y_7) +
            (x_9*y_6));
    xy._5 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x_0*y_6) + (x_2*y_4) + (x_4*y_2) +
        (x_6*y_0) + 19 * (x_8*y_8) + 2 * ((x_1*y_5) +
        (x_3*y_3) + (x_5*y_1)) + 38 *
        ((x_7*y_9) + (x_9*y_7));
    xy._6 = (t & ((1 << 26) - 1));
    t = (t >> 26) + (x_0*y_7) + (x_1*y_6) + (x_2*y_5) +
        (x_3*y_4) + (x_4*y_3) + (x_5*y_2) +
        (x_6*y_1) + (x_7*y_0) + 19 * ((x_8*y_9) +
        (x_9*y_8));
    xy._7 = (t & ((1 << 25) - 1));
    t = (t >> 25) + xy._8;
    xy._8 = (t & ((1 << 26) - 1));
    xy._9 += (t >> 26);
    return xy;
}

/* Square a number.  Optimization of  mul25519(x2, x, x)  */
function sqr(x2, x) {
    var
    x_0=x._0,x_1=x._1,x_2=x._2,x_3=x._3,x_4=x._4,
        x_5=x._5,x_6=x._6,x_7=x._7,x_8=x._8,x_9=x._9;
    var t;
    t = (x_4*x_4) + 2 * ((x_0*x_8) + (x_2*x_6)) + 38 *
        (x_9*x_9) + 4 * ((x_1*x_7) + (x_3*x_5));
    x2._8 = (t & ((1 << 26) - 1));
    t = (t >> 26) + 2 * ((x_0*x_9) + (x_1*x_8) + (x_2*x_7) +
        (x_3*x_6) + (x_4*x_5));
    x2._9 = (t & ((1 << 25) - 1));
    t = 19 * (t >> 25) + (x_0*x_0) + 38 * ((x_2*x_8) +
        (x_4*x_6) + (x_5*x_5)) + 76 * ((x_1*x_9)
        + (x_3*x_7));
    x2._0 = (t & ((1 << 26) - 1));
    t = (t >> 26) + 2 * (x_0*x_1) + 38 * ((x_2*x_9) +
        (x_3*x_8) + (x_4*x_7) + (x_5*x_6));
    x2._1 = (t & ((1 << 25) - 1));
    t = (t >> 25) + 19 * (x_6*x_6) + 2 * ((x_0*x_2) +
        (x_1*x_1)) + 38 * (x_4*x_8) + 76 *
        ((x_3*x_9) + (x_5*x_7));
    x2._2 = (t & ((1 << 26) - 1));
    t = (t >> 26) + 2 * ((x_0*x_3) + (x_1*x_2)) + 38 *
        ((x_4*x_9) + (x_5*x_8) + (x_6*x_7));
    x2._3 = (t & ((1 << 25) - 1));
    t = (t >> 25) + (x_2*x_2) + 2 * (x_0*x_4) + 38 *
        ((x_6*x_8) + (x_7*x_7)) + 4 * (x_1*x_3) + 76 *
        (x_5*x_9);
    x2._4 = (t & ((1 << 26) - 1));
    t = (t >> 26) + 2 * ((x_0*x_5) + (x_1*x_4) + (x_2*x_3))
        + 38 * ((x_6*x_9) + (x_7*x_8));
    x2._5 = (t & ((1 << 25) - 1));
    t = (t >> 25) + 19 * (x_8*x_8) + 2 * ((x_0*x_6) +
        (x_2*x_4) + (x_3*x_3)) + 4 * (x_1*x_5) +
        76 * (x_7*x_9);
    x2._6 = (t & ((1 << 26) - 1));
    t = (t >> 26) + 2 * ((x_0*x_7) + (x_1*x_6) + (x_2*x_5) +
        (x_3*x_4)) + 38 * (x_8*x_9);
    x2._7 = (t & ((1 << 25) - 1));
    t = (t >> 25) + x2._8;
    x2._8 = (t & ((1 << 26) - 1));
    x2._9 += (t >> 26);
    return x2;
}

/* Calculates a reciprocal.  The output is in reduced form, the inputs need not
 * be.  Simply calculates  y = x^(p-2)  so it's not too fast. */
/* When sqrtassist is true, it instead calculates y = x^((p-5)/8) */
function recip(y, x, sqrtassist) {
    var
    t0=long10(),
        t1=long10(),
        t2=long10(),
        t3=long10(),
        t4=long10();
    var i;
    /* the chain for x^(2^255-21) is straight from djb's implementation */
    sqr(t1, x);	/*  2 == 2 * 1	*/
    sqr(t2, t1);	/*  4 == 2 * 2	*/
    sqr(t0, t2);	/*  8 == 2 * 4	*/
    mul(t2, t0, x);	/*  9 == 8 + 1	*/
    mul(t0, t2, t1);	/* 11 == 9 + 2	*/
    sqr(t1, t0);	/* 22 == 2 * 11	*/
    mul(t3, t1, t2);	/* 31 == 22 + 9
     == 2^5   - 2^0	*/
    sqr(t1, t3);	/* 2^6   - 2^1	*/
    sqr(t2, t1);	/* 2^7   - 2^2	*/
    sqr(t1, t2);	/* 2^8   - 2^3	*/
    sqr(t2, t1);	/* 2^9   - 2^4	*/
    sqr(t1, t2);	/* 2^10  - 2^5	*/
    mul(t2, t1, t3);	/* 2^10  - 2^0	*/
    sqr(t1, t2);	/* 2^11  - 2^1	*/
    sqr(t3, t1);	/* 2^12  - 2^2	*/
    for (i = 1; i < 5; i++) {
        sqr(t1, t3);
        sqr(t3, t1);
    } /* t3 */		/* 2^20  - 2^10	*/
    mul(t1, t3, t2);	/* 2^20  - 2^0	*/
    sqr(t3, t1);	/* 2^21  - 2^1	*/
    sqr(t4, t3);	/* 2^22  - 2^2	*/
    for (i = 1; i < 10; i++) {
        sqr(t3, t4);
        sqr(t4, t3);
    } /* t4 */		/* 2^40  - 2^20	*/
    mul(t3, t4, t1);	/* 2^40  - 2^0	*/
    for (i = 0; i < 5; i++) {
        sqr(t1, t3);
        sqr(t3, t1);
    } /* t3 */		/* 2^50  - 2^10	*/
    mul(t1, t3, t2);	/* 2^50  - 2^0	*/
    sqr(t2, t1);	/* 2^51  - 2^1	*/
    sqr(t3, t2);	/* 2^52  - 2^2	*/
    for (i = 1; i < 25; i++) {
        sqr(t2, t3);
        sqr(t3, t2);
    } /* t3 */		/* 2^100 - 2^50 */
    mul(t2, t3, t1);	/* 2^100 - 2^0	*/
    sqr(t3, t2);	/* 2^101 - 2^1	*/
    sqr(t4, t3);	/* 2^102 - 2^2	*/
    for (i = 1; i < 50; i++) {
        sqr(t3, t4);
        sqr(t4, t3);
    } /* t4 */		/* 2^200 - 2^100 */
    mul(t3, t4, t2);	/* 2^200 - 2^0	*/
    for (i = 0; i < 25; i++) {
        sqr(t4, t3);
        sqr(t3, t4);
    } /* t3 */		/* 2^250 - 2^50	*/
    mul(t2, t3, t1);	/* 2^250 - 2^0	*/
    sqr(t1, t2);	/* 2^251 - 2^1	*/
    sqr(t2, t1);	/* 2^252 - 2^2	*/
    if (sqrtassist!=0) {
        mul(y, x, t2);	/* 2^252 - 3 */
    } else {
        sqr(t1, t2);	/* 2^253 - 2^3	*/
        sqr(t2, t1);	/* 2^254 - 2^4	*/
        sqr(t1, t2);	/* 2^255 - 2^5	*/
        mul(y, t1, t0);	/* 2^255 - 21	*/
    }
}

/* checks if x is "negative", requires reduced input */
function is_negative(x) {
    return (((is_overflow(x) || (x._9 < 0))?1:0) ^ (x._0 & 1)) & 0xFFFFFFFF;
}

/* a square root */
function sqrt(x, u) {
    var v=long10(), t1=long10(), t2=long10();
    add(t1, u, u);	/* t1 = 2u		*/
    recip(v, t1, 1);	/* v = (2u)^((p-5)/8)	*/
    sqr(x, v);		/* x = v^2		*/
    mul(t2, t1, x);	/* t2 = 2uv^2		*/
    t2._0--;		/* t2 = 2uv^2-1		*/
    mul(t1, v, t2);	/* t1 = v(2uv^2-1)	*/
    mul(x, u, t1);	/* x = uv(2uv^2-1)	*/
}

/********* DIGITAL SIGNATURES *********/

/* deterministic EC-KCDSA
 *
 *    s is the private key for signing
 *    P is the corresponding public key
 *    Z is the context data (signer public key or certificate, etc)
 *
 * signing:
 *
 *    m = hash(Z, message)
 *    x = hash(m, s)
 *    keygen25519(Y, NULL, x);
 *    r = hash(Y);
 *    h = m XOR r
 *    sign25519(v, h, x, s);
 *
 *    output (v,r) as the signature
 *
 * verification:
 *
 *    m = hash(Z, message);
 *    h = m XOR r
 *    verify25519(Y, v, h, P)
 *
 *    confirm  r == hash(Y)
 *
 * It would seem to me that it would be simpler to have the signer directly do
 * h = hash(m, Y) and send that to the recipient instead of r, who can verify
 * the signature by checking h == hash(m, Y).  If there are any problems with
 * such a scheme, please let me know.
 *
 * Also, EC-KCDSA (like most DS algorithms) picks x random, which is a waste of
 * perfectly good entropy, but does allow Y to be calculated in advance of (or
 * parallel to) hashing the message.
 */

/* Signature generation primitive, calculates (x-h)s mod q
 *   h  [in]  signature hash (of message, signature pub key, and context data)
 *   x  [in]  signature private key
 *   s  [in]  private key for signing
 * returns signature value on success, undefined on failure (use different x or h)
 */
 function sign(h, x, s) {
    /* v = (x - h) s  mod q  */
    var tmp1=createZeroArray(65);
    var tmp2=createZeroArray(33);
    var w;
    var i;

    var v = createArray32();

    mula_small(v, x, 0, h, 32, -1);
    mula_small(v, v, 0, ORDER, 32, (15-v[31])/16);
    mula32(tmp1, v, s, 32, 1);
    divmod(tmp2, tmp1, 64, ORDER, 32);
    for (w = 0, i = 0; i < 32; i++)
        w |= v[i] = tmp1[i];

    return w != 0 ? v : undefined;
}

exports.sign = function (h, s, x) {
    return sign(h, s, x);
};

exports.verify = function (signature) {
    console.log('todo...');
};
