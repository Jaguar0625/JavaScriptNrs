// simple function for outputting elapsed time
function measureActionTime(action, note) {
    var start = process.hrtime();

    action();

    var diff = process.hrtime(start);
    var elapsed = diff[0] * 1e3 + diff[1] / 1e6;
    console.log(elapsed.toFixed(3) + 'ms ' +  note);
}

function testBigNumber() {
    // for a quick test (and without property modularizing big number), just include BigNumber directly
    var fs = require('fs');
    eval(fs.readFileSync('lib/bignumber.js').toString());

    var a = new BigNumber('5845231144569872');
    var b = new BigNumber('24019124658254694');
    var c = new BigNumber('0');

    for (var i = 0; i < 10000; ++i) {
        c.add(a);
        c.subtract(b);
        c.multiply(c);
        c.divide(b);
    }
}

function testLong() {
    // for a quick test (and without property modularizing big number), just include long directly and stub out goog
    var goog = { provide: function () { }, math: { } };
    var fs = require('fs');
    eval(fs.readFileSync('lib/long.js').toString());

    var a = goog.math.Long.fromBits(0x44569872, 0x58452311);
    var b = goog.math.Long.fromBits(0x41123366, 0x555544);
    var c = goog.math.Long.fromBits(0, 0);

    for (var i = 0; i < 10000; ++i) {
        c.add(a);
        c.subtract(b);
        c.multiply(c);
        c.div(b);
    }
}

function testInt() {
    var a = 0x44569872;
    var b = 0x41123366;
    var c = 0;

    for (var i = 0; i < 10000; ++i) {
        c += a;
        c -= b;
        c *= c;
        c /= b;
    }
}

measureActionTime(testBigNumber, 'BigNumber');
measureActionTime(testLong, 'Long');
measureActionTime(testInt, 'Int');