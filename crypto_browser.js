var goog = { provide: function () { }, math: { } };

// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */

goog.provide('goog.math.Long');



/**
 * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
 * values as *signed* integers.  See the from* functions below for more
 * convenient ways of constructing Longs.
 *
 * The internal representation of a long is the two given signed, 32-bit values.
 * We use 32-bit pieces because these are the size of integers on which
 * Javascript performs bit-operations.  For operations like addition and
 * multiplication, we split each number into 16-bit pieces, which can easily be
 * multiplied within Javascript's floating-point representation without overflow
 * or change in sign.
 *
 * In the algorithms below, we frequently reduce the negative case to the
 * positive case by negating the input(s) and then post-processing the result.
 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
 * a positive number, it overflows back into a negative).  Not handling this
 * case would often result in infinite recursion.
 *
 * @param {number} low  The low (signed) 32 bits of the long.
 * @param {number} high  The high (signed) 32 bits of the long.
 * @constructor
 * @final
 */
goog.math.Long = function(low, high) {
  /**
   * @type {number}
   * @private
   */
  this.low_ = low | 0;  // force into 32 signed bits.

  /**
   * @type {number}
   * @private
   */
  this.high_ = high | 0;  // force into 32 signed bits.
};


// NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
// from* methods on which they depend.


/**
 * A cache of the Long representations of small integer values.
 * @type {!Object}
 * @private
 */
goog.math.Long.IntCache_ = {};


/**
 * Returns a Long representing the given (32-bit) integer value.
 * @param {number} value The 32-bit integer in question.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromInt = function(value) {
  if (-128 <= value && value < 128) {
    var cachedObj = goog.math.Long.IntCache_[value];
    if (cachedObj) {
      return cachedObj;
    }
  }

  var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
  if (-128 <= value && value < 128) {
    goog.math.Long.IntCache_[value] = obj;
  }
  return obj;
};


/**
 * Returns a Long representing the given value, provided that it is a finite
 * number.  Otherwise, zero is returned.
 * @param {number} value The number in question.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromNumber = function(value) {
  if (isNaN(value) || !isFinite(value)) {
    return goog.math.Long.ZERO;
  } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
    return goog.math.Long.MIN_VALUE;
  } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
    return goog.math.Long.MAX_VALUE;
  } else if (value < 0) {
    return goog.math.Long.fromNumber(-value).negate();
  } else {
    return new goog.math.Long(
        (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
        (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
  }
};


/**
 * Returns a Long representing the 64-bit integer that comes by concatenating
 * the given high and low bits.  Each is assumed to use 32 bits.
 * @param {number} lowBits The low 32-bits.
 * @param {number} highBits The high 32-bits.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromBits = function(lowBits, highBits) {
  return new goog.math.Long(lowBits, highBits);
};


/**
 * Returns a Long representation of the given string, written using the given
 * radix.
 * @param {string} str The textual representation of the Long.
 * @param {number=} opt_radix The radix in which the text is written.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromString = function(str, opt_radix) {
  if (str.length == 0) {
    throw Error('number format error: empty string');
  }

  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (str.charAt(0) == '-') {
    return goog.math.Long.fromString(str.substring(1), radix).negate();
  } else if (str.indexOf('-') >= 0) {
    throw Error('number format error: interior "-" character: ' + str);
  }

  // Do several (8) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));

  var result = goog.math.Long.ZERO;
  for (var i = 0; i < str.length; i += 8) {
    var size = Math.min(8, str.length - i);
    var value = parseInt(str.substring(i, i + size), radix);
    if (size < 8) {
      var power = goog.math.Long.fromNumber(Math.pow(radix, size));
      result = result.multiply(power).add(goog.math.Long.fromNumber(value));
    } else {
      result = result.multiply(radixToPower);
      result = result.add(goog.math.Long.fromNumber(value));
    }
  }
  return result;
};


// NOTE: the compiler should inline these constant values below and then remove
// these variables, so there should be no runtime penalty for these.


/**
 * Number used repeated below in calculations.  This must appear before the
 * first call to any from* function below.
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_32_DBL_ =
    goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_31_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ / 2;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_48_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_64_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_63_DBL_ =
    goog.math.Long.TWO_PWR_64_DBL_ / 2;


/** @type {!goog.math.Long} */
goog.math.Long.ZERO = goog.math.Long.fromInt(0);


/** @type {!goog.math.Long} */
goog.math.Long.ONE = goog.math.Long.fromInt(1);


/** @type {!goog.math.Long} */
goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);


/** @type {!goog.math.Long} */
goog.math.Long.MAX_VALUE =
    goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);


/** @type {!goog.math.Long} */
goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);


/**
 * @type {!goog.math.Long}
 * @private
 */
goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);


/** @return {number} The value, assuming it is a 32-bit integer. */
goog.math.Long.prototype.toInt = function() {
  return this.low_;
};


/** @return {number} The closest floating-point representation to this value. */
goog.math.Long.prototype.toNumber = function() {
  return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
         this.getLowBitsUnsigned();
};


/**
 * @param {number=} opt_radix The radix in which the text should be written.
 * @return {string} The textual representation of this value.
 * @override
 */
goog.math.Long.prototype.toString = function(opt_radix) {
  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (this.isZero()) {
    return '0';
  }

  if (this.isNegative()) {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      // We need to change the Long value before it can be negated, so we remove
      // the bottom-most digit in this base and then recurse to do the rest.
      var radixLong = goog.math.Long.fromNumber(radix);
      var div = this.div(radixLong);
      var rem = div.multiply(radixLong).subtract(this);
      return div.toString(radix) + rem.toInt().toString(radix);
    } else {
      return '-' + this.negate().toString(radix);
    }
  }

  // Do several (6) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));

  var rem = this;
  var result = '';
  while (true) {
    var remDiv = rem.div(radixToPower);
    var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
    var digits = intval.toString(radix);

    rem = remDiv;
    if (rem.isZero()) {
      return digits + result;
    } else {
      while (digits.length < 6) {
        digits = '0' + digits;
      }
      result = '' + digits + result;
    }
  }
};


/** @return {number} The high 32-bits as a signed value. */
goog.math.Long.prototype.getHighBits = function() {
  return this.high_;
};


/** @return {number} The low 32-bits as a signed value. */
goog.math.Long.prototype.getLowBits = function() {
  return this.low_;
};


/** @return {number} The low 32-bits as an unsigned value. */
goog.math.Long.prototype.getLowBitsUnsigned = function() {
  return (this.low_ >= 0) ?
      this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
};


/**
 * @return {number} Returns the number of bits needed to represent the absolute
 *     value of this Long.
 */
goog.math.Long.prototype.getNumBitsAbs = function() {
  if (this.isNegative()) {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return 64;
    } else {
      return this.negate().getNumBitsAbs();
    }
  } else {
    var val = this.high_ != 0 ? this.high_ : this.low_;
    for (var bit = 31; bit > 0; bit--) {
      if ((val & (1 << bit)) != 0) {
        break;
      }
    }
    return this.high_ != 0 ? bit + 33 : bit + 1;
  }
};


/** @return {boolean} Whether this value is zero. */
goog.math.Long.prototype.isZero = function() {
  return this.high_ == 0 && this.low_ == 0;
};


/** @return {boolean} Whether this value is negative. */
goog.math.Long.prototype.isNegative = function() {
  return this.high_ < 0;
};


/** @return {boolean} Whether this value is odd. */
goog.math.Long.prototype.isOdd = function() {
  return (this.low_ & 1) == 1;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long equals the other.
 */
goog.math.Long.prototype.equals = function(other) {
  return (this.high_ == other.high_) && (this.low_ == other.low_);
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long does not equal the other.
 */
goog.math.Long.prototype.notEquals = function(other) {
  return (this.high_ != other.high_) || (this.low_ != other.low_);
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is less than the other.
 */
goog.math.Long.prototype.lessThan = function(other) {
  return this.compare(other) < 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is less than or equal to the other.
 */
goog.math.Long.prototype.lessThanOrEqual = function(other) {
  return this.compare(other) <= 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is greater than the other.
 */
goog.math.Long.prototype.greaterThan = function(other) {
  return this.compare(other) > 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is greater than or equal to the other.
 */
goog.math.Long.prototype.greaterThanOrEqual = function(other) {
  return this.compare(other) >= 0;
};


/**
 * Compares this Long with the given one.
 * @param {goog.math.Long} other Long to compare against.
 * @return {number} 0 if they are the same, 1 if the this is greater, and -1
 *     if the given one is greater.
 */
goog.math.Long.prototype.compare = function(other) {
  if (this.equals(other)) {
    return 0;
  }

  var thisNeg = this.isNegative();
  var otherNeg = other.isNegative();
  if (thisNeg && !otherNeg) {
    return -1;
  }
  if (!thisNeg && otherNeg) {
    return 1;
  }

  // at this point, the signs are the same, so subtraction will not overflow
  if (this.subtract(other).isNegative()) {
    return -1;
  } else {
    return 1;
  }
};


/** @return {!goog.math.Long} The negation of this value. */
goog.math.Long.prototype.negate = function() {
  if (this.equals(goog.math.Long.MIN_VALUE)) {
    return goog.math.Long.MIN_VALUE;
  } else {
    return this.not().add(goog.math.Long.ONE);
  }
};


/**
 * Returns the sum of this and the given Long.
 * @param {goog.math.Long} other Long to add to this one.
 * @return {!goog.math.Long} The sum of this and the given Long.
 */
goog.math.Long.prototype.add = function(other) {
  // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 + b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 + b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 + b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 + b48;
  c48 &= 0xFFFF;
  return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};


/**
 * Returns the difference of this and the given Long.
 * @param {goog.math.Long} other Long to subtract from this.
 * @return {!goog.math.Long} The difference of this and the given Long.
 */
goog.math.Long.prototype.subtract = function(other) {
  return this.add(other.negate());
};


/**
 * Returns the product of this and the given long.
 * @param {goog.math.Long} other Long to multiply with this.
 * @return {!goog.math.Long} The product of this and the other.
 */
goog.math.Long.prototype.multiply = function(other) {
  if (this.isZero()) {
    return goog.math.Long.ZERO;
  } else if (other.isZero()) {
    return goog.math.Long.ZERO;
  }

  if (this.equals(goog.math.Long.MIN_VALUE)) {
    return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
  } else if (other.equals(goog.math.Long.MIN_VALUE)) {
    return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().multiply(other.negate());
    } else {
      return this.negate().multiply(other).negate();
    }
  } else if (other.isNegative()) {
    return this.multiply(other.negate()).negate();
  }

  // If both longs are small, use float multiplication
  if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
      other.lessThan(goog.math.Long.TWO_PWR_24_)) {
    return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
  }

  // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
  // We can skip products that would overflow.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 * b00;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a00 * b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  c48 &= 0xFFFF;
  return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};


/**
 * Returns this Long divided by the given one.
 * @param {goog.math.Long} other Long by which to divide.
 * @return {!goog.math.Long} This Long divided by the given one.
 */
goog.math.Long.prototype.div = function(other) {
  if (other.isZero()) {
    throw Error('division by zero');
  } else if (this.isZero()) {
    return goog.math.Long.ZERO;
  }

  if (this.equals(goog.math.Long.MIN_VALUE)) {
    if (other.equals(goog.math.Long.ONE) ||
        other.equals(goog.math.Long.NEG_ONE)) {
      return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.ONE;
    } else {
      // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
      var halfThis = this.shiftRight(1);
      var approx = halfThis.div(other).shiftLeft(1);
      if (approx.equals(goog.math.Long.ZERO)) {
        return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
      } else {
        var rem = this.subtract(other.multiply(approx));
        var result = approx.add(rem.div(other));
        return result;
      }
    }
  } else if (other.equals(goog.math.Long.MIN_VALUE)) {
    return goog.math.Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().div(other.negate());
    } else {
      return this.negate().div(other).negate();
    }
  } else if (other.isNegative()) {
    return this.div(other.negate()).negate();
  }

  // Repeat the following until the remainder is less than other:  find a
  // floating-point that approximates remainder / other *from below*, add this
  // into the result, and subtract it from the remainder.  It is critical that
  // the approximate value is less than or equal to the real value so that the
  // remainder never becomes negative.
  var res = goog.math.Long.ZERO;
  var rem = this;
  while (rem.greaterThanOrEqual(other)) {
    // Approximate the result of division. This may be a little greater or
    // smaller than the actual value.
    var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

    // We will tweak the approximate result by changing it in the 48-th digit or
    // the smallest non-fractional digit, whichever is larger.
    var log2 = Math.ceil(Math.log(approx) / Math.LN2);
    var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

    // Decrease the approximation until it is smaller than the remainder.  Note
    // that if it is too large, the product overflows and is negative.
    var approxRes = goog.math.Long.fromNumber(approx);
    var approxRem = approxRes.multiply(other);
    while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
      approx -= delta;
      approxRes = goog.math.Long.fromNumber(approx);
      approxRem = approxRes.multiply(other);
    }

    // We know the answer can't be zero... and actually, zero would cause
    // infinite recursion since we would make no progress.
    if (approxRes.isZero()) {
      approxRes = goog.math.Long.ONE;
    }

    res = res.add(approxRes);
    rem = rem.subtract(approxRem);
  }
  return res;
};


/**
 * Returns this Long modulo the given one.
 * @param {goog.math.Long} other Long by which to mod.
 * @return {!goog.math.Long} This Long modulo the given one.
 */
goog.math.Long.prototype.modulo = function(other) {
  return this.subtract(this.div(other).multiply(other));
};


/** @return {!goog.math.Long} The bitwise-NOT of this value. */
goog.math.Long.prototype.not = function() {
  return goog.math.Long.fromBits(~this.low_, ~this.high_);
};


/**
 * Returns the bitwise-AND of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to AND.
 * @return {!goog.math.Long} The bitwise-AND of this and the other.
 */
goog.math.Long.prototype.and = function(other) {
  return goog.math.Long.fromBits(this.low_ & other.low_,
                                 this.high_ & other.high_);
};


/**
 * Returns the bitwise-OR of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to OR.
 * @return {!goog.math.Long} The bitwise-OR of this and the other.
 */
goog.math.Long.prototype.or = function(other) {
  return goog.math.Long.fromBits(this.low_ | other.low_,
                                 this.high_ | other.high_);
};


/**
 * Returns the bitwise-XOR of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to XOR.
 * @return {!goog.math.Long} The bitwise-XOR of this and the other.
 */
goog.math.Long.prototype.xor = function(other) {
  return goog.math.Long.fromBits(this.low_ ^ other.low_,
                                 this.high_ ^ other.high_);
};


/**
 * Returns this Long with bits shifted to the left by the given amount.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the left by the given amount.
 */
goog.math.Long.prototype.shiftLeft = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var low = this.low_;
    if (numBits < 32) {
      var high = this.high_;
      return goog.math.Long.fromBits(
          low << numBits,
          (high << numBits) | (low >>> (32 - numBits)));
    } else {
      return goog.math.Long.fromBits(0, low << (numBits - 32));
    }
  }
};


/**
 * Returns this Long with bits shifted to the right by the given amount.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the right by the given amount.
 */
goog.math.Long.prototype.shiftRight = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return goog.math.Long.fromBits(
          (low >>> numBits) | (high << (32 - numBits)),
          high >> numBits);
    } else {
      return goog.math.Long.fromBits(
          high >> (numBits - 32),
          high >= 0 ? 0 : -1);
    }
  }
};


/**
 * Returns this Long with bits shifted to the right by the given amount, with
 * zeros placed into the new leading bits.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the right by the given amount, with
 *     zeros placed into the new leading bits.
 */
goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return goog.math.Long.fromBits(
          (low >>> numBits) | (high << (32 - numBits)),
          high >>> numBits);
    } else if (numBits == 32) {
      return goog.math.Long.fromBits(high, 0);
    } else {
      return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
    }
  }
};

/*
 *  jssha256 version 0.1  -  Copyright 2006 B. Poettering
 *
 *  This program is free software; you can redistribute it and/or
 *  modify it under the terms of the GNU General Public License as
 *  published by the Free Software Foundation; either version 2 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA
 *  02111-1307 USA
 */

/*
 * http://point-at-infinity.org/jssha256/
 *
 * This is a JavaScript implementation of the SHA256 secure hash function
 * and the HMAC-SHA256 message authentication code (MAC).
 *
 * The routines' well-functioning has been verified with the test vectors 
 * given in FIPS-180-2, Appendix B and IETF RFC 4231. The HMAC algorithm 
 * conforms to IETF RFC 2104. 
 *
 * The following code example computes the hash value of the string "abc".
 *
 *    SHA256_init();
 *    SHA256_write("abc");
 *    digest = SHA256_finalize();  
 *    digest_hex = array_to_hex_string(digest);
 * 
 * Get the same result by calling the shortcut function SHA256_hash:
 * 
 *    digest_hex = SHA256_hash("abc");
 * 
 * In the following example the calculation of the HMAC of the string "abc" 
 * using the key "secret key" is shown:
 * 
 *    HMAC_SHA256_init("secret key");
 *    HMAC_SHA256_write("abc");
 *    mac = HMAC_SHA256_finalize();
 *    mac_hex = array_to_hex_string(mac);
 *
 * Again, the same can be done more conveniently:
 * 
 *    mac_hex = HMAC_SHA256_MAC("secret key", "abc");
 *
 * Note that the internal state of the hash function is held in global
 * variables. Therefore one hash value calculation has to be completed 
 * before the next is begun. The same applies the the HMAC routines.
 *
 * Report bugs to: jssha256 AT point-at-infinity.org
 *
 */

/******************************************************************************/

/* Two all purpose helper functions follow */

/* string_to_array: convert a string to a character (byte) array */

function string_to_array(str) {
  var len = str.length;
  var res = new Array(len);
  for(var i = 0; i < len; i++)
    res[i] = str.charCodeAt(i);
  return res;
}

/* array_to_hex_string: convert a byte array to a hexadecimal string */

function array_to_hex_string(ary) {
  var res = "";
  for(var i = 0; i < ary.length; i++)
    res += SHA256_hexchars[ary[i] >> 4] + SHA256_hexchars[ary[i] & 0x0f];
  return res;
}

/******************************************************************************/

/* The following are the SHA256 routines */

/* 
   SHA256_init: initialize the internal state of the hash function. Call this
   function before calling the SHA256_write function.
*/

function SHA256_init() {
  SHA256_H = new Array(0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19);
  SHA256_buf = new Array();
  SHA256_len = 0;
}

/*
   SHA256_write: add a message fragment to the hash function's internal state. 
   'msg' may be given as string or as byte array and may have arbitrary length.

*/

function SHA256_write(msg) {
  if (typeof(msg) == "string")
    SHA256_buf = SHA256_buf.concat(string_to_array(msg));
  else
    SHA256_buf = SHA256_buf.concat(msg);
  for(var i = 0; i + 64 <= SHA256_buf.length; i += 64)
    SHA256_Hash_Byte_Block(SHA256_H, SHA256_buf.slice(i, i + 64));
  SHA256_buf = SHA256_buf.slice(i);
  SHA256_len += msg.length;
}

/*
   SHA256_finalize: finalize the hash value calculation. Call this function
   after the last call to SHA256_write. An array of 32 bytes (= 256 bits) 
   is returned.
*/

function SHA256_finalize() {
  SHA256_buf[SHA256_buf.length] = 0x80;

  if (SHA256_buf.length > 64 - 8) {
    for(var i = SHA256_buf.length; i < 64; i++)
      SHA256_buf[i] = 0;
    SHA256_Hash_Byte_Block(SHA256_H, SHA256_buf);
    SHA256_buf.length = 0;
  }

  for(var i = SHA256_buf.length; i < 64 - 5; i++)
    SHA256_buf[i] = 0;
  SHA256_buf[59] = (SHA256_len >>> 29) & 0xff;
  SHA256_buf[60] = (SHA256_len >>> 21) & 0xff;
  SHA256_buf[61] = (SHA256_len >>> 13) & 0xff;
  SHA256_buf[62] = (SHA256_len >>> 5) & 0xff;
  SHA256_buf[63] = (SHA256_len << 3) & 0xff;
  SHA256_Hash_Byte_Block(SHA256_H, SHA256_buf);

  var res = new Array(32);
  for(var i = 0; i < 8; i++) {
    res[4 * i + 0] = SHA256_H[i] >>> 24;
    res[4 * i + 1] = (SHA256_H[i] >> 16) & 0xff;
    res[4 * i + 2] = (SHA256_H[i] >> 8) & 0xff;
    res[4 * i + 3] = SHA256_H[i] & 0xff;
  }

  delete SHA256_H;
  delete SHA256_buf;
  delete SHA256_len;
  return res;
}

/*
   SHA256_hash: calculate the hash value of the string or byte array 'msg' 
   and return it as hexadecimal string. This shortcut function may be more 
   convenient than calling SHA256_init, SHA256_write, SHA256_finalize 
   and array_to_hex_string explicitly.
*/

function SHA256_hash(msg) {
  var res;
  SHA256_init();
  SHA256_write(msg);
  res = SHA256_finalize();
  return array_to_hex_string(res);
}

/******************************************************************************/

/* The following are the HMAC-SHA256 routines */

/*
   HMAC_SHA256_init: initialize the MAC's internal state. The MAC key 'key'
   may be given as string or as byte array and may have arbitrary length.
*/

function HMAC_SHA256_init(key) {
  if (typeof(key) == "string")
    HMAC_SHA256_key = string_to_array(key);
  else
    HMAC_SHA256_key = new Array().concat(key);

  if (HMAC_SHA256_key.length > 64) {
    SHA256_init();
    SHA256_write(HMAC_SHA256_key);
    HMAC_SHA256_key = SHA256_finalize();
  }

  for(var i = HMAC_SHA256_key.length; i < 64; i++)
    HMAC_SHA256_key[i] = 0;
  for(var i = 0; i < 64; i++)
    HMAC_SHA256_key[i] ^=  0x36;
  SHA256_init();
  SHA256_write(HMAC_SHA256_key);
}

/*
   HMAC_SHA256_write: process a message fragment. 'msg' may be given as 
   string or as byte array and may have arbitrary length.
*/

function HMAC_SHA256_write(msg) {
  SHA256_write(msg);
}

/*
   HMAC_SHA256_finalize: finalize the HMAC calculation. An array of 32 bytes
   (= 256 bits) is returned.
*/

function HMAC_SHA256_finalize() {
  var md = SHA256_finalize();
  for(var i = 0; i < 64; i++)
    HMAC_SHA256_key[i] ^= 0x36 ^ 0x5c;
  SHA256_init();
  SHA256_write(HMAC_SHA256_key);
  SHA256_write(md);
  for(var i = 0; i < 64; i++)
    HMAC_SHA256_key[i] = 0;
  delete HMAC_SHA256_key;
  return SHA256_finalize();
}

/*
   HMAC_SHA256_MAC: calculate the HMAC value of message 'msg' under key 'key'
   (both may be of type string or byte array); return the MAC as hexadecimal 
   string. This shortcut function may be more convenient than calling 
   HMAC_SHA256_init, HMAC_SHA256_write, HMAC_SHA256_finalize and 
   array_to_hex_string explicitly.
*/

function HMAC_SHA256_MAC(key, msg) {
  var res;
  HMAC_SHA256_init(key);
  HMAC_SHA256_write(msg);
  res = HMAC_SHA256_finalize();
  return array_to_hex_string(res);
}

/******************************************************************************/

/* The following lookup tables and functions are for internal use only! */

SHA256_hexchars = new Array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
  'a', 'b', 'c', 'd', 'e', 'f');

SHA256_K = new Array(
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2 
);

function SHA256_sigma0(x) {
  return ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
}

function SHA256_sigma1(x) {
  return ((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10);
}

function SHA256_Sigma0(x) {
  return ((x >>> 2) | (x << 30)) ^ ((x >>> 13) | (x << 19)) ^ 
    ((x >>> 22) | (x << 10));
}

function SHA256_Sigma1(x) {
  return ((x >>> 6) | (x << 26)) ^ ((x >>> 11) | (x << 21)) ^ 
    ((x >>> 25) | (x << 7));
}

function SHA256_Ch(x, y, z) {
  return z ^ (x & (y ^ z));
}

function SHA256_Maj(x, y, z) {
  return (x & y) ^ (z & (x ^ y));
}

function SHA256_Hash_Word_Block(H, W) {
  for(var i = 16; i < 64; i++)
    W[i] = (SHA256_sigma1(W[i - 2]) +  W[i - 7] + 
      SHA256_sigma0(W[i - 15]) + W[i - 16]) & 0xffffffff;
  var state = new Array().concat(H);
  for(var i = 0; i < 64; i++) {
    var T1 = state[7] + SHA256_Sigma1(state[4]) + 
      SHA256_Ch(state[4], state[5], state[6]) + SHA256_K[i] + W[i];
    var T2 = SHA256_Sigma0(state[0]) + SHA256_Maj(state[0], state[1], state[2]);
    state.pop();
    state.unshift((T1 + T2) & 0xffffffff);
    state[4] = (state[4] + T1) & 0xffffffff;
  }
  for(var i = 0; i < 8; i++)
    H[i] = (H[i] + state[i]) & 0xffffffff;
}

function SHA256_Hash_Byte_Block(H, w) {
  var W = new Array(16);
  for(var i = 0; i < 16; i++)
    W[i] = w[4 * i + 0] << 24 | w[4 * i + 1] << 16 | 
      w[4 * i + 2] << 8 | w[4 * i + 3];
  SHA256_Hash_Word_Block(H, W);
}

// Copyright (c) 2007, 2013 Michele Bini
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished
// to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var c255lbase32chars = "abcdefghijklmnopqrstuvwxyz234567";
var c255lbase32values = {"a":0, "b":1, "c":2, "d":3, "e":4, "f":5, "g":6, "h":7, "i":8, "j":9, "k":10, "l":11, "m":12, "n":13, "o":14, "p":15, "q":16, "r":17, "s":18, "t":19, "u":20, "v":21, "w":22, "x":23, "y":24, "z":25, "2":26, "3":27, "4":28, "5":29, "6":30, "7":31 };
function c255lbase32encode(n, x) {
  var c;
  var r = "";
  for (c = 0; c < 255; c+=5) {
    r = c255lbase32chars.substr(c255lgetbit(n, c) + c255lgetbit(n, c+1)*2 + c255lgetbit(n, c+2)*4 + c255lgetbit(n, c+3)*8 + c255lgetbit(n, c+4)*16, 1) + r;
  }
  return r;
}
function c255lbase32decode(n, x) {
  var c = 0;
  var r = c255lzero();
  var l = n.length;
  for (c = 0; (l > 0) && (c < 255); c+=5) {
    l--;
    var v = c255lbase32values[n.substr(l, 1)];
    c255lsetbit(r, c,    v%2); v = v >> 1;
    c255lsetbit(r, c+1,  v%2); v = v >> 1;
    c255lsetbit(r, c+2,  v%2); v = v >> 1;
    c255lsetbit(r, c+3,  v%2); v = v >> 1;
    c255lsetbit(r, c+4,  v%2);
  }
  return r;
}
var c255lhexchars = "0123456789abcdef";
var c255lhexvalues = {"0":0, "1":1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7,  "8":8, "9":9, "a":10, "b":11, "c":12, "d":13, "e":14, "f":15 };
function c255lhexencode(n, x) {
  var c;
  var r = "";
  for (c = 0; c < 255; c+=4) {
    r = c255lhexchars.substr(c255lgetbit(n, c) + c255lgetbit(n, c+1)*2 + c255lgetbit(n, c+2)*4 + c255lgetbit(n, c+3)*8, 1) + r;
  }
  return r;
}
function c255lhexdecode(n, x) {
  var c = 0;
  var r = c255lzero();
  var l = n.length;
  for (c = 0; (l > 0) && (c < 255); c+=4) {
    l--;
    var v = c255lhexvalues[n.substr(l, 1)];
    c255lsetbit(r, c,    v%2); v = v >> 1;
    c255lsetbit(r, c+1,  v%2); v = v >> 1;
    c255lsetbit(r, c+2,  v%2); v = v >> 1;
    c255lsetbit(r, c+3,  v%2);
  }
  return r;
}
var c255lprime = [0xffff-18, 0xffff, 0xffff, 0xffff,  0xffff, 0xffff, 0xffff, 0xffff,  0xffff, 0xffff, 0xffff, 0xffff,  0xffff, 0xffff, 0xffff, 0x7fff];
function c255lsetbit(n, c, v) {
  var i = Math.floor(c / 16);
  var a = n[i];
  a = a + Math.pow(2, c % 16) * v;
  n[i] = a;
}
function c255lgetbit(n, c) {
  return Math.floor(n[Math.floor(c / 16)] / Math.pow(2, c % 16)) % 2;
}
function c255lzero() {
  return [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}
function c255lone() {
  return [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}
function c255lbase() { // Basepoint
  return [9,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}
// return -1, 0, +1 when a is less than, equal, or greater than b
function c255lbigintcmp(a, b) {
 // The following code is a bit tricky to avoid code branching
  var c;
  var r = 0;
  for (c = 15; c >= 0; c--) {
    var x = a[c];
    var y = b[c];
    r = r + (x - y)*(1 - r*r);
    r = Math.round(2 * r / (Math.abs(r) + 1));
  }
  r = Math.round(2 * r / (Math.abs(r) + 1));
  return r;
}
function c255lbigintadd(a, b) {
  var r = [];
  var v;
  r[0] = (v = a[0] + b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1] + b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2] + b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3] + b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4] + b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5] + b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6] + b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7] + b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8] + b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9] + b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10] + b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11] + b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12] + b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13] + b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14] + b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15] + b[15];
  return r;
}
function c255lbigintsub(a, b) {
  var r = [];
  var v;
  r[0] = (v = 0x80000 + a[0] - b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[1] - b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[2] - b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[3] - b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[4] - b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[5] - b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[6] - b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[7] - b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[8] - b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[9] - b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[10] - b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[11] - b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[12] - b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[13] - b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[14] - b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) - 8 + a[15] - b[15];
  return r;
}

function c255lsqr8h(a7, a6, a5, a4, a3, a2, a1, a0) {
  var r = [];
  var v;
  r[0] = (v = a0*a0) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 2*a0*a1) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 2*a0*a2 + a1*a1) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 2*a0*a3 + 2*a1*a2) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 2*a0*a4 + 2*a1*a3 + a2*a2) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 2*a0*a5 + 2*a1*a4 + 2*a2*a3) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 2*a0*a6 + 2*a1*a5 + 2*a2*a4 + a3*a3) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 2*a0*a7 + 2*a1*a6 + 2*a2*a5 + 2*a3*a4) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 2*a1*a7 + 2*a2*a6 + 2*a3*a5 + a4*a4) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 2*a2*a7 + 2*a3*a6 + 2*a4*a5) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 2*a3*a7 + 2*a4*a6 + a5*a5) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 2*a4*a7 + 2*a5*a6) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 2*a5*a7 + a6*a6) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 2*a6*a7) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a7*a7) % 0x10000;
  r[15] = Math.floor(v / 0x10000);
  return r;
}

function c255lsqrmodp(a) {
  var x = c255lsqr8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8]);
  var z = c255lsqr8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0]);
  var y = c255lsqr8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0]);
  var r = [];
  var v;
  r[0] = (v = 0x800000 + z[0] + (y[8] -x[8] -z[8] + x[0] -0x80) * 38) % 0x10000;
  r[1] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[1] + (y[9] -x[9] -z[9] + x[1]) * 38) % 0x10000;
  r[2] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[2] + (y[10] -x[10] -z[10] + x[2]) * 38) % 0x10000;
  r[3] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[3] + (y[11] -x[11] -z[11] + x[3]) * 38) % 0x10000;
  r[4] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[4] + (y[12] -x[12] -z[12] + x[4]) * 38) % 0x10000;
  r[5] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[5] + (y[13] -x[13] -z[13] + x[5]) * 38) % 0x10000;
  r[6] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[6] + (y[14] -x[14] -z[14] + x[6]) * 38) % 0x10000;
  r[7] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[7] + (y[15] -x[15] -z[15] + x[7]) * 38) % 0x10000;
  r[8] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[8] + y[0] -x[0] -z[0] + x[8] * 38) % 0x10000;
  r[9] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[9] + y[1] -x[1] -z[1] + x[9] * 38) % 0x10000;
  r[10] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[10] + y[2] -x[2] -z[2] + x[10] * 38) % 0x10000;
  r[11] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[11] + y[3] -x[3] -z[3] + x[11] * 38) % 0x10000;
  r[12] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[12] + y[4] -x[4] -z[4] + x[12] * 38) % 0x10000;
  r[13] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[13] + y[5] -x[5] -z[5] + x[13] * 38) % 0x10000;
  r[14] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[14] + y[6] -x[6] -z[6] + x[14] * 38) % 0x10000;
  r[15] = 0x7fff80 + Math.floor(v / 0x10000) + z[15] + y[7] -x[7] -z[7] + x[15] * 38;
  c255lreduce(r);
  return r;
}

function c255lmul8h(a7, a6, a5, a4, a3, a2, a1, a0, b7, b6, b5, b4, b3, b2, b1, b0) {
  var r = [];
  var v;
  r[0] = (v = a0*b0) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a0*b1 + a1*b0) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a0*b2 + a1*b1 + a2*b0) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a0*b3 + a1*b2 + a2*b1 + a3*b0) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a0*b4 + a1*b3 + a2*b2 + a3*b1 + a4*b0) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a0*b5 + a1*b4 + a2*b3 + a3*b2 + a4*b1 + a5*b0) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a0*b6 + a1*b5 + a2*b4 + a3*b3 + a4*b2 + a5*b1 + a6*b0) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a0*b7 + a1*b6 + a2*b5 + a3*b4 + a4*b3 + a5*b2 + a6*b1 + a7*b0) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a1*b7 + a2*b6 + a3*b5 + a4*b4 + a5*b3 + a6*b2 + a7*b1) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a2*b7 + a3*b6 + a4*b5 + a5*b4 + a6*b3 + a7*b2) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a3*b7 + a4*b6 + a5*b5 + a6*b4 + a7*b3) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a4*b7 + a5*b6 + a6*b5 + a7*b4) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a5*b7 + a6*b6 + a7*b5) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a6*b7 + a7*b6) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a7*b7) % 0x10000;
  r[15] = Math.floor(v / 0x10000);
  return r;
}

function
c255lmulmodp(a, b) {
  // Karatsuba multiplication scheme: x*y = (b^2+b)*x1*y1 - b*(x1-x0)*(y1-y0) + (b+1)*x0*y0
  var x = c255lmul8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8], b[15], b[14], b[13], b[12], b[11], b[10], b[9], b[8]);
  var z = c255lmul8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0], b[7], b[6], b[5], b[4], b[3], b[2], b[1], b[0]);
  var y = c255lmul8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0],
  			b[15] + b[7], b[14] + b[6], b[13] + b[5], b[12] + b[4], b[11] + b[3], b[10] + b[2], b[9] + b[1], b[8] + b[0]);
  var r = [];
  var v;
  r[0] = (v = 0x800000 + z[0] + (y[8] -x[8] -z[8] + x[0] -0x80) * 38) % 0x10000;
  r[1] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[1] + (y[9] -x[9] -z[9] + x[1]) * 38) % 0x10000;
  r[2] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[2] + (y[10] -x[10] -z[10] + x[2]) * 38) % 0x10000;
  r[3] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[3] + (y[11] -x[11] -z[11] + x[3]) * 38) % 0x10000;
  r[4] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[4] + (y[12] -x[12] -z[12] + x[4]) * 38) % 0x10000;
  r[5] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[5] + (y[13] -x[13] -z[13] + x[5]) * 38) % 0x10000;
  r[6] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[6] + (y[14] -x[14] -z[14] + x[6]) * 38) % 0x10000;
  r[7] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[7] + (y[15] -x[15] -z[15] + x[7]) * 38) % 0x10000;
  r[8] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[8] + y[0] -x[0] -z[0] + x[8] * 38) % 0x10000;
  r[9] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[9] + y[1] -x[1] -z[1] + x[9] * 38) % 0x10000;
  r[10] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[10] + y[2] -x[2] -z[2] + x[10] * 38) % 0x10000;
  r[11] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[11] + y[3] -x[3] -z[3] + x[11] * 38) % 0x10000;
  r[12] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[12] + y[4] -x[4] -z[4] + x[12] * 38) % 0x10000;
  r[13] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[13] + y[5] -x[5] -z[5] + x[13] * 38) % 0x10000;
  r[14] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[14] + y[6] -x[6] -z[6] + x[14] * 38) % 0x10000;
  r[15] = 0x7fff80 + Math.floor(v / 0x10000) + z[15] + y[7] -x[7] -z[7] + x[15] * 38;
  c255lreduce(r);
  return r;
}

function c255lreduce(a) {
  var v = a[15];
  a[15] = v % 0x8000;
  v = Math.floor(v / 0x8000) * 19;
  a[0] = (v += a[0]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[1] = (v += a[1]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[2] = (v += a[2]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[3] = (v += a[3]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[4] = (v += a[4]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[5] = (v += a[5]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[6] = (v += a[6]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[7] = (v += a[7]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[8] = (v += a[8]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[9] = (v += a[9]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[10] = (v += a[10]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[11] = (v += a[11]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[12] = (v += a[12]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[13] = (v += a[13]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[14] = (v += a[14]) % 0x10000;
  v = Math.floor(v / 0x10000);
  a[15] += v;
}

function c255laddmodp(a, b) {
  var r = [];
  var v;
  r[0] = (v = (Math.floor(a[15] / 0x8000) + Math.floor(b[15] / 0x8000)) * 19 + a[0] + b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1] + b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2] + b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3] + b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4] + b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5] + b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6] + b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7] + b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8] + b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9] + b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10] + b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11] + b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12] + b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13] + b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14] + b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15] % 0x8000 + b[15] % 0x8000;
  return r;
}

function c255lsubmodp(a, b) {
  var r = [];
  var v;
  r[0] = (v = 0x80000 + (Math.floor(a[15] / 0x8000) - Math.floor(b[15] / 0x8000) - 1) * 19 + a[0] - b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[1] - b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[2] - b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[3] - b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[4] - b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[5] - b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[6] - b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[7] - b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[8] - b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[9] - b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[10] - b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[11] - b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[12] - b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[13] - b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[14] - b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + 0x7ff8 + a[15]%0x8000 - b[15]%0x8000;
  return r;
}

function
c255linvmodp(a) {
  var c = a;
  var i = 250;
  while (--i) {
    a = c255lsqrmodp(a);
    //if (i > 240) { tracev("invmodp a", a); }
    a = c255lmulmodp(a, c);
    //if (i > 240) { tracev("invmodp a 2", a); }
  }
  a = c255lsqrmodp(a);
  a = c255lsqrmodp(a); a = c255lmulmodp(a, c);
  a = c255lsqrmodp(a);
  a = c255lsqrmodp(a); a = c255lmulmodp(a, c);
  a = c255lsqrmodp(a); a = c255lmulmodp(a, c);
  return a;
}

function c255lmulasmall(a) {
  var m = 121665;
  var r = [];
  var v;
  r[0] = (v = a[0] * m) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1]*m) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2]*m) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3]*m) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4]*m) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5]*m) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6]*m) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7]*m) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8]*m) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9]*m) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10]*m) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11]*m) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12]*m) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13]*m) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14]*m) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15]*m;
  c255lreduce(r);
  return r;
}

function c255ldbl(x, z) {
  var x_2, z_2, m, n, o;
  ///tracev("dbl x", x);
  ///tracev("dbl z", z);
  m = c255lsqrmodp(c255laddmodp(x, z));
  //tracev("dbl m", c255laddmodp(x, z));
  n = c255lsqrmodp(c255lsubmodp(x, z));
  ///tracev("dbl n", n);
  o = c255lsubmodp(m, n);
  ///tracev("dbl o", o);
  x_2 = c255lmulmodp(n, m);
  //tracev("dbl x_2", x_2);
  z_2 = c255lmulmodp(c255laddmodp(c255lmulasmall(o), m), o);
  //tracev("dbl z_2", z_2);
  return [x_2, z_2];
}

function c255lsum(x, z, x_p, z_p, x_1) {
  var x_3, z_3, k, l, p, q;
  //tracev("sum x", x);
  //tracev("sum z", z);
  p = c255lmulmodp(c255lsubmodp(x, z), c255laddmodp(x_p, z_p));
  q = c255lmulmodp(c255laddmodp(x, z), c255lsubmodp(x_p, z_p));
  //tracev("sum p", p);
  //tracev("sum q", q);
  x_3 = c255lsqrmodp(c255laddmodp(p, q));
  z_3 = c255lmulmodp(c255lsqrmodp(c255lsubmodp(p, q)), x_1);
  return [x_3, z_3];
}


function curve25519_raw(f, c) {
  var a, x_1, q;

  x_1 = c;
  //tracev("c", c);
  //tracev("x_1", x_1);
  a = c255ldbl(x_1, c255lone());
  //tracev("x_a", a[0]);
  //tracev("z_a", a[1]);
  q = [ x_1, c255lone() ];

  var n = 255;

  while (c255lgetbit(f, n) == 0) {
    n--;
    // For correct constant-time operation, bit 255 should always be set to 1 so the following 'while' loop is never entered
    if (n < 0) {
      return c255lzero();
    }
  }
  n--;

  var aq = [ a, q ];
    
  while (n >= 0) {
    var r, s;
    var b = c255lgetbit(f, n);
    r = c255lsum(aq[0][0], aq[0][1], aq[1][0], aq[1][1], x_1);
    s = c255ldbl(aq[1-b][0], aq[1-b][1]);
    aq[1-b]  = s;
    aq[b]    = r;
    n--;
  }
  q = aq[1];

  //tracev("x", q[0]);
  //tracev("z", q[1]);
  q[1] = c255linvmodp(q[1]);
  //tracev("1/z", q[1]);
  q[0] = c255lmulmodp(q[0], q[1]);
  c255lreduce(q[0]);
  return q[0];
}

function curve25519b32(a, b) {
  return c255lbase32encode(curve25519(c255lbase32decode(a), c255lbase32decode(b)));
}

function curve25519_fast(f, c) {
    if (!c) { c = c255lbase(); }
    f[0]   &= 0xFFF8;
    f[15]   = (f[15] & 0x7FFF) | 0x4000;
    return curve25519_raw(f, c);
}

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

var hash = {
    init: SHA256_init,
    update: SHA256_write,
    getBytes: SHA256_finalize
};

var nxtCrypto = function (curve25519, hash) {

    function simpleHash (message) {
        hash.init();
        hash.update(message);
        return hash.getBytes();
    }

    function areByteArraysEqual(bytes1, bytes2) {
        if (bytes1.length !== bytes2.length)
            return false;

        for (var i = 0; i < bytes1.length; ++i) {
            if (bytes1[i] !== bytes2[i])
                return false;
        }

        return true;
    }

    function byteArrayToShortArray (bytes) {
        if (0 != (bytes.length % 2))
            throw 'unexpected digest length';

        var shorts = [];
        for (var i = 0; i < bytes.length; i += 2)
            shorts.push(bytes[i + 1] << 8 | bytes[i]);

        return shorts;
    }

    function shortArrayToByteArray (shorts) {
        var bytes = [];
        for (var i = 0; i < shorts.length; ++i) {
            bytes.push(shorts[i] & 0xFF);
            bytes.push(shorts[i] >> 8);
        }

        return bytes;
    }

    function byteArrayToHexString (bytes) {
        return array_to_hex_string(bytes);
    }

    function hexStringToByteArray (str) {
        var bytes = [];
        for (var i = 0; i < str.length; i += 2)
            bytes.push(parseInt('0x' + str.charAt(i) + str.charAt(i + 1)));

        return bytes;
    }

    function publicKeySlow (secretPhrase) {
        var digest = simpleHash(secretPhrase);
        return curve25519.keygen(digest).p;
    };

    function publicKey (secretPhrase) {
        var digest = simpleHash(secretPhrase);
        var shorts = byteArrayToShortArray(digest);
        return byteArrayToHexString(shortArrayToByteArray(curve25519_fast(shorts)));
    };

    function sign (message, secretPhrase) {
        var digest = simpleHash(secretPhrase);
        var result = curve25519.keygen(digest);
        var s = result.s;

        var m = simpleHash(message);;

        hash.init();
        hash.update(m);
        hash.update(s);
        var x = hash.getBytes();

        var result = curve25519.keygen(x);
        var y = result.p;

        hash.init();
        hash.update(m);
        hash.update(y);
        var h = hash.getBytes();

        var v = curve25519.sign(h, x, s);

        return byteArrayToHexString(v.concat(h));
    }

    function verify (signature, message, publicKey) {
        var signature = hexStringToByteArray(signature);
        var publicKey = hexStringToByteArray(publicKey);
        var v = signature.slice(0, 32);
        var h = signature.slice(32);
        var y = curve25519.verify(v, h, publicKey);

        var m = simpleHash(message);

        hash.init();
        hash.update(m);
        hash.update(y);
        var h2 = hash.getBytes();

        return areByteArraysEqual(h, h2);
    }

    return {
        publicKey: publicKey,
        publicKeySlow: publicKeySlow,
        sign: sign,
        verify: verify
    };

}(curve25519, hash);
