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

var curve25519 = function (glong) {
    /* long constants */
    var g1sl26sub1 = glong.fromInt((1 << 26) - 1);
    var g1sl25sub1 = glong.fromInt((1 << 25) - 1);
    var g1 = glong.fromInt(1);
    var g2 = glong.fromInt(2);
    var g4 = glong.fromInt(4);
    var g9 = glong.fromInt(9);
    var g19 = glong.fromInt(19);
    var g38 = glong.fromInt(38);
    var g76 = glong.fromInt(76);
    var g121665 = glong.fromInt(121665);
    var g486662 = glong.fromInt(486662);
    var g39420360 = glong.fromInt(39420360);

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

    function long10(_0, _1, _2, _3, _4, _5, _6, _7, _8, _9) {
        function valueOrDefault(val) {
            return glong.fromInt(val || 0);
        }

        return {
            _0: valueOrDefault(_0),
            _1: valueOrDefault(_1),
            _2: valueOrDefault(_2),
            _3: valueOrDefault(_3),
            _4: valueOrDefault(_4),
            _5: valueOrDefault(_5),
            _6: valueOrDefault(_6),
            _7: valueOrDefault(_7),
            _8: valueOrDefault(_8),
            _9: valueOrDefault(_9)
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
        m = m | 0;
        n = n | 0;
        z = z | 0;

        var v=0;
        for (var i=0;i<n;++i) {
            v+=(q[i+m] & 0xFF)+z*(x[i] & 0xFF);
            p[i+m]=(v & 0xFF);
            v>>=8;
        }
        return v;
    }

    /* p += x * y * z  where z is a small integer
     * x is size 32, y is size t, p is size 32+t
     * y is allowed to overlap with p+32 if you don't care about the upper half  */
    function mula32(p, x, y, t, z) {
        t = t | 0;
        z = z | 0;

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
        n = n | 0;
        t = t | 0;

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
        x._0 = glong.fromInt(
            ((m[0] & 0xFF))         | ((m[1] & 0xFF))<<8 |
                (m[2] & 0xFF)<<16      | ((m[3] & 0xFF)& 3)<<24);
        x._1 = glong.fromInt(
            ((m[3] & 0xFF)&~ 3)>>2  | (m[4] & 0xFF)<<6 |
                (m[5] & 0xFF)<<14 | ((m[6] & 0xFF)& 7)<<22);
        x._2 = glong.fromInt(
            ((m[6] & 0xFF)&~ 7)>>3  | (m[7] & 0xFF)<<5 |
                (m[8] & 0xFF)<<13 | ((m[9] & 0xFF)&31)<<21);
        x._3 = glong.fromInt(
            ((m[9] & 0xFF)&~31)>>5  | (m[10] & 0xFF)<<3 |
                (m[11] & 0xFF)<<11 | ((m[12] & 0xFF)&63)<<19);
        x._4 = glong.fromInt(
            ((m[12] & 0xFF)&~63)>>6 | (m[13] & 0xFF)<<2 |
                (m[14] & 0xFF)<<10 |  (m[15] & 0xFF)    <<18);
        x._5 =  glong.fromInt(
            (m[16] & 0xFF)         | (m[17] & 0xFF)<<8 |
                (m[18] & 0xFF)<<16 | ((m[19] & 0xFF)& 1)<<24);
        x._6 = glong.fromInt(
            ((m[19] & 0xFF)&~ 1)>>1 | (m[20] & 0xFF)<<7 |
                (m[21] & 0xFF)<<15 | ((m[22] & 0xFF)& 7)<<23);
        x._7 = glong.fromInt(
            ((m[22] & 0xFF)&~ 7)>>3 | (m[23] & 0xFF)<<5 |
                (m[24] & 0xFF)<<13 | ((m[25] & 0xFF)&15)<<21);
        x._8 = glong.fromInt(
            ((m[25] & 0xFF)&~15)>>4 | (m[26] & 0xFF)<<4 |
                (m[27] & 0xFF)<<12 | ((m[28] & 0xFF)&63)<<20);
        x._9 = glong.fromInt(
            ((m[28] & 0xFF)&~63)>>6 | (m[29] & 0xFF)<<2 |
                (m[30] & 0xFF)<<10 |  (m[31] & 0xFF)    <<18);
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
        var ld = 0, ud = 0, t;
        var tlong;
        ld = (is_overflow(x)?1:0) - ((x._9 < 0)?1:0);
        ud = ld * -(P25+1);
        ld *= 19;
        tlong = glong.fromInt(ld).add(x._0).add(x._1.shiftLeft(26));
        t = tlong.getLowBits();
        m[ 0] = t & 0xFF;
        m[ 1] = (t >> 8) & 0xFF;
        m[ 2] = (t >> 16) & 0xFF;
        m[ 3] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add(x._2.shiftLeft(19));
        t = tlong.getLowBits();
        m[ 4] = t & 0xFF;
        m[ 5] = (t >> 8) & 0xFF;
        m[ 6] = (t >> 16) & 0xFF;
        m[ 7] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add(x._3.shiftLeft(13));
        t = tlong.getLowBits();
        m[ 8] = t & 0xFF;
        m[ 9] = (t >> 8) & 0xFF;
        m[10] = (t >> 16) & 0xFF;
        m[11] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add(x._4.shiftLeft(6));
        t = tlong.getLowBits();
        m[12] = t & 0xFF;
        m[13] = (t >> 8) & 0xFF;
        m[14] = (t >> 16) & 0xFF;
        m[15] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add(x._5).add(x._6.shiftLeft(25));
        t = tlong.getLowBits();
        m[16] = t & 0xFF;
        m[17] = (t >> 8) & 0xFF;
        m[18] = (t >> 16) & 0xFF;
        m[19] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add(x._7.shiftLeft(19));
        t = tlong.getLowBits();
        m[20] = t & 0xFF;
        m[21] = (t >> 8) & 0xFF;
        m[22] = (t >> 16) & 0xFF;
        m[23] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add(x._8.shiftLeft(12));
        t = tlong.getLowBits();
        m[24] = t & 0xFF;
        m[25] = (t >> 8) & 0xFF;
        m[26] = (t >> 16) & 0xFF;
        m[27] = (t >> 24) & 0xFF;
        tlong = tlong.shiftRight(32).add((x._9.add(glong.fromInt(ud))).shiftLeft(6));
        t = tlong.getLowBits();
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
        l10_out._0=glong.fromInt(int_in);
        l10_out._1=glong.fromInt(0);
        l10_out._2=glong.fromInt(0);
        l10_out._3=glong.fromInt(0);
        l10_out._4=glong.fromInt(0);
        l10_out._5=glong.fromInt(0);
        l10_out._6=glong.fromInt(0);
        l10_out._7=glong.fromInt(0);
        l10_out._8=glong.fromInt(0);
        l10_out._9=glong.fromInt(0);;
    }

    /* Add/subtract two numbers.  The inputs must be in reduced form, and the
     * output isn't, so to do another addition or subtraction on the output,
     * first multiply it by one to reduce it. */
    function add(xy, x, y) {
        xy._0 = x._0.add(y._0);
        xy._1 = x._1.add(y._1);
        xy._2 = x._2.add(y._2);
        xy._3 = x._3.add(y._3);
        xy._4 = x._4.add(y._4);
        xy._5 = x._5.add(y._5);
        xy._6 = x._6.add(y._6);
        xy._7 = x._7.add(y._7);
        xy._8 = x._8.add(y._8);
        xy._9 = x._9.add(y._9);
    }
    function sub(xy, x, y) {
        xy._0 = x._0.subtract(y._0);
        xy._1 = x._1.subtract(y._1);
        xy._2 = x._2.subtract(y._2);
        xy._3 = x._3.subtract(y._3);
        xy._4 = x._4.subtract(y._4);
        xy._5 = x._5.subtract(y._5);
        xy._6 = x._6.subtract(y._6);
        xy._7 = x._7.subtract(y._7);
        xy._8 = x._8.subtract(y._8);
        xy._9 = x._9.subtract(y._9);
    }

    /* Multiply a number by a small integer in range -185861411 .. 185861411.
     * The output is in reduced form, the input x need not be.  x and xy may point
     * to the same buffer. */
    function mul_small(xy, x, y) {
        var t;
        t = x._8.multiply(y);
        xy._8 = t.and(g1sl26sub1)
        t = t.shiftRight(26).add(x._9.multiply(y));
        xy._9 = t.and(g1sl25sub1);
        t = g19.multiply(t.shiftRight(25)).add(x._0.multiply(y));
        xy._0 = t.and(g1sl26sub1);
        t = t.shiftRight(26).add(x._1.multiply(y));
        xy._1 = t.and(g1sl25sub1);
        t = t.shiftRight(25).add(x._2.multiply(y));
        xy._2 = t.and(g1sl26sub1);
        t = t.shiftRight(26).add(x._3.multiply(y));
        xy._3 = t.and(g1sl25sub1);
        t = t.shiftRight(25).add(x._4.multiply(y));
        xy._4 = t.and(g1sl26sub1);
        t = t.shiftRight(26).add(x._5.multiply(y));
        xy._5 = t.and(g1sl25sub1);
        t = t.shiftRight(25).add(x._6.multiply(y));
        xy._6 = t.and(g1sl26sub1);
        t = t.shiftRight(26).add(x._7.multiply(y));
        xy._7 = t.and(g1sl25sub1);
        t = t.shiftRight(25).add(xy._8);
        xy._8 = t.and(g1sl26sub1);
        xy._9 = xy._9.add(t.shiftRight(26));
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
        t = x_0.multiply(y_8)
            .add(x_2.multiply(y_6))
            .add(x_4.multiply(y_4))
            .add(x_6.multiply(y_2))
            .add(x_8.multiply(y_0))
            .add(g2.multiply(
                x_1.multiply(y_7)
                    .add(x_3.multiply(y_5))
                    .add(x_5.multiply(y_3))
                    .add(x_7.multiply(y_1))))
            .add(g38.multiply(x_9).multiply(y_9));
        xy._8 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(x_0.multiply(y_9))
            .add(x_1.multiply(y_8))
            .add(x_2.multiply(y_7))
            .add(x_3.multiply(y_6))
            .add(x_4.multiply(y_5))
            .add(x_5.multiply(y_4))
            .add(x_6.multiply(y_3))
            .add(x_7.multiply(y_2))
            .add(x_8.multiply(y_1))
            .add(x_9.multiply(y_0));
        xy._9 = t.and(g1sl25sub1);
        t = x_0.multiply(y_0)
            .add(g19.multiply(t.shiftRight(25)
                .add(x_2.multiply(y_8))
                .add(x_4.multiply(y_6))
                .add(x_6.multiply(y_4))
                .add(x_8.multiply(y_2))))
            .add(g38.multiply(
                x_1.multiply(y_9)
                    .add(x_3.multiply(y_7))
                    .add(x_5.multiply(y_5))
                    .add(x_7.multiply(y_3))
                    .add(x_9.multiply(y_1))));
        xy._0 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(x_0.multiply(y_1))
            .add(x_1.multiply(y_0))
            .add(g19.multiply(
                x_2.multiply(y_9)
                    .add(x_3.multiply(y_8))
                    .add(x_4.multiply(y_7))
                    .add(x_5.multiply(y_6))
                    .add(x_6.multiply(y_5))
                    .add(x_7.multiply(y_4))
                    .add(x_8.multiply(y_3))
                    .add(x_9.multiply(y_2))));
        xy._1 = t.and(g1sl25sub1);
        t = t.shiftRight(25)
            .add(x_0.multiply(y_2))
            .add(x_2.multiply(y_0))
            .add(g19.multiply(
                x_4.multiply(y_8)
                    .add(x_6.multiply(y_6))
                    .add(x_8.multiply(y_4))))
            .add(g2.multiply(x_1).multiply(y_1))
            .add(g38.multiply(
                x_3.multiply(y_9)
                    .add(x_5.multiply(y_7))
                    .add(x_7.multiply(y_5))
                    .add(x_9.multiply(y_3))));
        xy._2 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(x_0.multiply(y_3))
            .add(x_1.multiply(y_2))
            .add(x_2.multiply(y_1))
            .add(x_3.multiply(y_0))
            .add(g19.multiply(
                x_4.multiply(y_9)
                    .add(x_5.multiply(y_8))
                    .add(x_6.multiply(y_7))
                    .add(x_7.multiply(y_6))
                    .add(x_8.multiply(y_5))
                    .add(x_9.multiply(y_4))));
        xy._3 = t.and(g1sl25sub1);
        t = t.shiftRight(25)
            .add(x_0.multiply(y_4))
            .add(x_2.multiply(y_2))
            .add(x_4.multiply(y_0))
            .add(g19.multiply(
                x_6.multiply(y_8)
                    .add(x_8.multiply(y_6))))
            .add(g2.multiply(
                x_1.multiply(y_3)
                    .add(x_3.multiply(y_1))))
            .add(g38.multiply(
                x_5.multiply(y_9)
                    .add(x_7.multiply(y_7))
                    .add(x_9.multiply(y_5))));
        xy._4 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(x_0.multiply(y_5))
            .add(x_1.multiply(y_4))
            .add(x_2.multiply(y_3))
            .add(x_3.multiply(y_2))
            .add(x_4.multiply(y_1))
            .add(x_5.multiply(y_0))
            .add(g19.multiply(
                x_6.multiply(y_9)
                    .add(x_7.multiply(y_8))
                    .add(x_8.multiply(y_7))
                    .add(x_9.multiply(y_6))));
        xy._5 = t.and(g1sl25sub1);
        t = t.shiftRight(25)
            .add(x_0.multiply(y_6))
            .add(x_2.multiply(y_4))
            .add(x_4.multiply(y_2))
            .add(x_6.multiply(y_0))
            .add(g19.multiply(x_8).multiply(y_8))
            .add(g2.multiply(
                x_1.multiply(y_5)
                    .add(x_3.multiply(y_3))
                    .add(x_5.multiply(y_1))))
            .add(g38.multiply(
                x_7.multiply(y_9)
                    .add(x_9.multiply(y_7))));
        xy._6 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(x_0.multiply(y_7))
            .add(x_1.multiply(y_6))
            .add(x_2.multiply(y_5))
            .add(x_3.multiply(y_4))
            .add(x_4.multiply(y_3))
            .add(x_5.multiply(y_2))
            .add(x_6.multiply(y_1))
            .add(x_7.multiply(y_0))
            .add(g19.multiply(
                x_8.multiply(y_9)
                    .add(x_9.multiply(y_8))));
        xy._7 = t.and(g1sl25sub1);
        t = t.shiftRight(25).add(xy._8);
        xy._8 = t.and(g1sl26sub1);
        xy._9 = xy._9.add(t.shiftRight(26));
        return xy;
    }

    /* Square a number.  Optimization of  mul25519(x2, x, x)  */
    function sqr(x2, x) {
        var
            x_0=x._0,x_1=x._1,x_2=x._2,x_3=x._3,x_4=x._4,
            x_5=x._5,x_6=x._6,x_7=x._7,x_8=x._8,x_9=x._9;
        var t;
        t = x_4.multiply(x_4)
            .add(g2.multiply(
                x_0.multiply(x_8)
                    .add(x_2.multiply(x_6))))
            .add(g38.multiply(x_9).multiply(x_9))
            .add(g4.multiply(
                x_1.multiply(x_7)
                    .add(x_3.multiply(x_5))));
        x2._8 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(g2.multiply(
                x_0.multiply(x_9)
                    .add(x_1.multiply(x_8))
                    .add(x_2.multiply(x_7))
                    .add(x_3.multiply(x_6))
                    .add(x_4.multiply(x_5))));
        x2._9 = t.and(g1sl25sub1);
        t = g19.multiply(t.shiftRight(25))
            .add(x_0.multiply(x_0))
            .add(g38.multiply(
                x_2.multiply(x_8)
                    .add(x_4.multiply(x_6))
                    .add(x_5.multiply(x_5))))
            .add(g76.multiply(
                x_1.multiply(x_9)
                    .add(x_3.multiply(x_7))));
        x2._0 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(g2.multiply(x_0).multiply(x_1))
            .add(g38.multiply(
                x_2.multiply(x_9)
                    .add(x_3.multiply(x_8))
                    .add(x_4.multiply(x_7))
                    .add(x_5.multiply(x_6))));
        x2._1 = t.and(g1sl25sub1);
        t = t.shiftRight(25)
            .add(g19.multiply(x_6).multiply(x_6))
            .add(g2.multiply(
                x_0.multiply(x_2)
                    .add(x_1.multiply(x_1))))
            .add(g38.multiply(x_4).multiply(x_8))
            .add(g76.multiply(
                x_3.multiply(x_9)
                    .add(x_5.multiply(x_7))));
        x2._2 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(g2.multiply(
                x_0.multiply(x_3)
                    .add(x_1.multiply(x_2))))
            .add(g38.multiply(
                x_4.multiply(x_9)
                    .add(x_5.multiply(x_8))
                    .add(x_6.multiply(x_7))));
        x2._3 = t.and(g1sl25sub1);
        t = t.shiftRight(25)
            .add(x_2.multiply(x_2))
            .add(g2.multiply(x_0).multiply(x_4))
            .add(g38.multiply(
                x_6.multiply(x_8)
                    .add(x_7.multiply(x_7))))
            .add(g4.multiply(x_1).multiply(x_3))
            .add(g76.multiply(x_5).multiply(x_9));
        x2._4 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(g2.multiply(
                x_0.multiply(x_5)
                    .add(x_1.multiply(x_4))
                    .add(x_2.multiply(x_3))))
            .add(g38.multiply(
                x_6.multiply(x_9)
                    .add(x_7.multiply(x_8))));
        x2._5 = t.and(g1sl25sub1);
        t = t.shiftRight(25)
            .add(g19.multiply(x_8).multiply(x_8))
            .add(g2.multiply(
                x_0.multiply(x_6)
                    .add(x_2.multiply(x_4))
                    .add(x_3.multiply(x_3))))
            .add(g4.multiply(x_1).multiply(x_5))
            .add(g76.multiply(x_7).multiply(x_9));
        x2._6 = t.and(g1sl26sub1);
        t = t.shiftRight(26)
            .add(g2.multiply(
                x_0.multiply(x_7)
                    .add(x_1.multiply(x_6))
                    .add(x_2.multiply(x_5))
                    .add(x_3.multiply(x_4))))
            .add(g38.multiply(x_8).multiply(x_9));
        x2._7 = t.and(g1sl25sub1);
        t = t.shiftRight(25).add(x2._8);
        x2._8 = t.and(g1sl26sub1);
        x2._9 = x2._9.add(t.shiftRight(26));
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
        var isOverflowOrNegative = is_overflow(x) || x._9.isNegative();
        var leastSignificantBit = x._0.getLowBits() & 1;
        return ((isOverflowOrNegative?1:0) ^ leastSignificantBit) & 0xFFFFFFFF;
    }

    /* a square root */
    function sqrt(x, u) {
        var v=long10(), t1=long10(), t2=long10();
        add(t1, u, u);	/* t1 = 2u		*/
        recip(v, t1, 1);	/* v = (2u)^((p-5)/8)	*/
        sqr(x, v);		/* x = v^2		*/
        mul(t2, t1, x);	/* t2 = 2uv^2		*/
        t2._0 = t2._0.subtract(g1);		/* t2 = 2uv^2-1		*/
        mul(t1, v, t2);	/* t1 = v(2uv^2-1)	*/
        mul(x, u, t1);	/* x = uv(2uv^2-1)	*/
    }

    /********************* Elliptic curve *********************/

    /* y^2 = x^3 + 486662 x^2 + x  over GF(2^255-19) */

    /* t1 = ax + az
     * t2 = ax - az  */
    function mont_prep(t1, t2, ax, az) {
        add(t1, ax, az);
        sub(t2, ax, az);
    }

    /* A = P + Q   where
     *  X(A) = ax/az
     *  X(P) = (t1+t2)/(t1-t2)
     *  X(Q) = (t3+t4)/(t3-t4)
     *  X(P-Q) = dx
     * clobbers t1 and t2, preserves t3 and t4  */
    function mont_add(t1, t2, t3, t4, ax, az, dx) {
        mul(ax, t2, t3);
        mul(az, t1, t4);
        add(t1, ax, az);
        sub(t2, ax, az);
        sqr(ax, t1);
        sqr(t1, t2);
        mul(az, t1, dx);
    }

    /* B = 2 * Q   where
     *  X(B) = bx/bz
     *  X(Q) = (t3+t4)/(t3-t4)
     * clobbers t1 and t2, preserves t3 and t4  */
    function mont_dbl(t1, t2, t3, t4, bx, bz) {
        sqr(t1, t3);
        sqr(t2, t4);
        mul(bx, t1, t2);
        sub(t2, t1, t2);
        mul_small(bz, t2, g121665);
        add(t1, t1, bz);
        mul(bz, t1, t2);
    }

    /* Y^2 = X^3 + 486662 X^2 + X
     * t is a temporary  */
    function x_to_y2(t, y2, x) {
        sqr(t, x);
        mul_small(y2, x, g486662);
        add(t, t, y2);
        t._0 = t._0.add(g1);
        mul(y2, t, x);
    }

    /* P = kG   and  s = sign(P)/k  */
    function core(Px, s, k, Gx) {
        var
            dx=long10(),
            t1=long10(),
            t2=long10(),
            t3=long10(),
            t4=long10();
        var
            x=[long10(), long10()],
            z=[long10(), long10()];
        var i, j;

        /* unpack the base */
        if (Gx!=null)
            unpack(dx, Gx);
        else
            set(dx, 9);

        /* 0G = point-at-infinity */
        set(x[0], 1);
        set(z[0], 0);

        /* 1G = G */
        cpy(x[1], dx);
        set(z[1], 1);

        var zi = 0;
        for (i = 32; i--!=0; ) {
            if (i==0) {
                i=0;
            }
            for (j = 8; j--!=0; ) {
                /* swap arguments depending on bit */
                var bit1 = (k[i] & 0xFF) >> j & 1;
                var bit0 = ~(k[i] & 0xFF) >> j & 1;
                var ax = x[bit0];
                var az = z[bit0];
                var bx = x[bit1];
                var bz = z[bit1];

                /* a' = a + b	*/
                /* b' = 2 b	*/
                mont_prep(t1, t2, ax, az);
                mont_prep(t3, t4, bx, bz);
                mont_add(t1, t2, t3, t4, ax, az, dx);
                mont_dbl(t1, t2, t3, t4, bx, bz);
            }
        }

        recip(t1, z[0], 0);
        mul(dx, x[0], t1);

        pack(dx, Px);

        /* calculate s such that s abs(P) = G  .. assumes G is std base point */
        if (s!=null) {
            x_to_y2(t2, t1, dx);	/* t1 = Py^2  */
            recip(t3, z[1], 0);	/* where Q=P+G ... */
            mul(t2, x[1], t3);	/* t2 = Qx  */
            add(t2, t2, dx);	/* t2 = Qx + Px  */
            t2._0 = t2._0.add(g9).add(g486662);	/* t2 = Qx + Px + Gx + 486662  */
            dx._0 = dx._0.subtract(g9);		/* dx = Px - Gx  */
            sqr(t3, dx);	/* t3 = (Px - Gx)^2  */
            mul(dx, t2, t3);	/* dx = t2 (Px - Gx)^2  */
            sub(dx, dx, t1);	/* dx = t2 (Px - Gx)^2 - Py^2  */
            dx._0 = dx._0.subtract(g39420360);	/* dx = t2 (Px - Gx)^2 - Py^2 - Gy^2  */
            mul(t1, dx, BASE_R2Y);	/* t1 = -Py  */

            if (is_negative(t1)!=0)	/* sign is 1, so just copy  */
                cpy32(s, k);
            else			/* sign is -1, so negate  */
                mula_small(s, ORDER_TIMES_8, 0, k, 32, -1);

            /* reduce s mod q
             * (is this needed?  do it just in case, it's fast anyway) */
            //divmod((dstptr) t1, s, 32, order25519, 32);

            /* take reciprocal of s mod q */
            var temp1=createArray32();
            var temp2=createZeroArray(64);
            var temp3=createZeroArray(64);
            cpy32(temp1, ORDER);
            cpy32(s, egcd32(temp2, temp3, s, temp1));
            if ((s[31] & 0x80)!=0)
                mula_small(s, s, 0, ORDER, 32, 1);

        }
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

        var v31 = v[31];
        if (0 != (v31 & 0x80))
            v31 |= 0xFFFFFF00;

        mula_small(v, v, 0, ORDER, 32, (15-v31)/16);

        mula32(tmp1, v, s, 32, 1);

        divmod(tmp2, tmp1, 64, ORDER, 32);

        for (w = 0, i = 0; i < 32; i++)
            w |= v[i] = tmp1[i];

        return w != 0 ? v : undefined;
    }

    /* Signature verification primitive, calculates Y = vP + hG
     *   v  [in]  signature value
     *   h  [in]  signature hash
     *   P  [in]  public key
     *   Returns signature public key
     */
    function verify(v, h, P) {
        /* Y = v abs(P) + h G  */
        var d=createArray32();
        var
            p=[long10(), long10()],
            s=[long10(), long10()],
            yx=[long10(), long10(), long10()],
            yz=[long10(), long10(), long10()],
            t1=[long10(), long10(), long10()],
            t2=[long10(), long10(), long10()];

        var vi = 0, hi = 0, di = 0, nvh=0, i, j, k;

        /* set p[0] to G and p[1] to P  */

        set(p[0], 9);
        unpack(p[1], P);

        /* set s[0] to P+G and s[1] to P-G  */

        /* s[0] = (Py^2 + Gy^2 - 2 Py Gy)/(Px - Gx)^2 - Px - Gx - 486662  */
        /* s[1] = (Py^2 + Gy^2 + 2 Py Gy)/(Px - Gx)^2 - Px - Gx - 486662  */

        x_to_y2(t1[0], t2[0], p[1]);	/* t2[0] = Py^2  */
        sqrt(t1[0], t2[0]);	/* t1[0] = Py or -Py  */
        j = is_negative(t1[0]);		/*      ... check which  */
        t2[0]._0 = t2[0]._0.add(g39420360);		/* t2[0] = Py^2 + Gy^2  */
        mul(t2[1], BASE_2Y, t1[0]);/* t2[1] = 2 Py Gy or -2 Py Gy  */
        sub(t1[j], t2[0], t2[1]);	/* t1[0] = Py^2 + Gy^2 - 2 Py Gy  */
        add(t1[1-j], t2[0], t2[1]);/* t1[1] = Py^2 + Gy^2 + 2 Py Gy  */
        cpy(t2[0], p[1]);		/* t2[0] = Px  */
        t2[0]._0 = t2[0]._0.subtract(g9);			/* t2[0] = Px - Gx  */
        sqr(t2[1], t2[0]);		/* t2[1] = (Px - Gx)^2  */
        recip(t2[0], t2[1], 0);	/* t2[0] = 1/(Px - Gx)^2  */
        mul(s[0], t1[0], t2[0]);	/* s[0] = t1[0]/(Px - Gx)^2  */
        sub(s[0], s[0], p[1]);	/* s[0] = t1[0]/(Px - Gx)^2 - Px  */
        s[0]._0 = s[0]._0.subtract(g9).subtract(g486662);		/* s[0] = X(P+G)  */
        mul(s[1], t1[1], t2[0]);	/* s[1] = t1[1]/(Px - Gx)^2  */
        sub(s[1], s[1], p[1]);	/* s[1] = t1[1]/(Px - Gx)^2 - Px  */
        s[1]._0 = s[1]._0.subtract(g9).subtract(g486662);		/* s[1] = X(P-G)  */
        mul_small(s[0], s[0], g1);	/* reduce s[0] */
        mul_small(s[1], s[1], g1);	/* reduce s[1] */

        /* prepare the chain  */
        for (i = 0; i < 32; i++) {
            vi = (vi >> 8) ^ (v[i] & 0xFF) ^ ((v[i] & 0xFF) << 1);
            hi = (hi >> 8) ^ (h[i] & 0xFF) ^ ((h[i] & 0xFF) << 1);
            nvh = ~(vi ^ hi);
            di = (nvh & (di & 0x80) >> 7) ^ vi;
            di ^= nvh & (di & 0x01) << 1;
            di ^= nvh & (di & 0x02) << 1;
            di ^= nvh & (di & 0x04) << 1;
            di ^= nvh & (di & 0x08) << 1;
            di ^= nvh & (di & 0x10) << 1;
            di ^= nvh & (di & 0x20) << 1;
            di ^= nvh & (di & 0x40) << 1;
            d[i] = di & 0xFF;
        }

        di = ((nvh & (di & 0x80) << 1) ^ vi) >> 8;

        /* initialize state */
        set(yx[0], 1);
        cpy(yx[1], p[di]);
        cpy(yx[2], s[0]);
        set(yz[0], 0);
        set(yz[1], 1);
        set(yz[2], 1);

        /* y[0] is (even)P + (even)G
         * y[1] is (even)P + (odd)G  if current d-bit is 0
         * y[1] is (odd)P + (even)G  if current d-bit is 1
         * y[2] is (odd)P + (odd)G
         */

        vi = 0;
        hi = 0;

        /* and go for it! */
        for (i = 32; i--!=0; ) {
            vi = (vi << 8) | (v[i] & 0xFF);
            hi = (hi << 8) | (h[i] & 0xFF);
            di = (di << 8) | (d[i] & 0xFF);

            for (j = 8; j--!=0; ) {
                mont_prep(t1[0], t2[0], yx[0], yz[0]);
                mont_prep(t1[1], t2[1], yx[1], yz[1]);
                mont_prep(t1[2], t2[2], yx[2], yz[2]);

                k = ((vi ^ vi >> 1) >> j & 1)
                    + ((hi ^ hi >> 1) >> j & 1);
                mont_dbl(yx[2], yz[2], t1[k], t2[k], yx[0], yz[0]);

                k = (di >> j & 2) ^ ((di >> j & 1) << 1);
                mont_add(t1[1], t2[1], t1[k], t2[k], yx[1], yz[1],
                    p[di >> j & 1]);

                mont_add(t1[2], t2[2], t1[0], t2[0], yx[2], yz[2],
                    s[((vi ^ hi) >> j & 2) >> 1]);
            }
        }

        k = (vi & 1) + (hi & 1);
        recip(t1[0], yz[k], 0);
        mul(t1[1], yx[k], t1[0]);

        var Y = []
        pack(t1[1], Y);
        return Y;
    }

    /* Key-pair generation
     *   P  [out] your public key
     *   s  [out] your private key for signing
     *   k  [out] your private key for key agreement
     *   k  [in]  32 random bytes
     * s may be NULL if you don't care
     *
     * WARNING: if s is not NULL, this function has data-dependent timing */
    function keygen(k) {
        var P = [];
        var s = [];
        var k = k || [];
        clamp(k);
        core(P, s, k, null);

        return { p: P, s: s, k: k };
    }

    return {
        sign: sign,
        verify: verify,
        keygen: keygen
    };
}(goog.math.Long);
