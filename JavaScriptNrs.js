
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
