// include closure long.js on the page
var goog = { provide: function () { }, math: { } };
var fs = require('fs');
eval(fs.readFileSync('external/long.js') + '');


// include the curve25519 library
eval(fs.readFileSync('core/curve25519.js') + '');

// export functions via node
exports.sign = curve25519.sign;
exports.verify = curve25519.verify;
exports.keygen = curve25519.keygen;