// include closure long.js on the page
var goog = { provide: function () { }, math: { } };
var fs = require('fs');
eval(fs.readFileSync('external/long.js') + '');

// include sha256.js on the page
eval(fs.readFileSync('external/jssha256.js') + '');

// include the (external) curve25519 library
eval(fs.readFileSync('external/curve255.js') + '');

// include the curve25519 library
eval(fs.readFileSync('core/curve25519.js') + '');

// include the crypto library
eval(fs.readFileSync('core/crypto.js') + '');

// export functions via node
exports.curve25519 = curve25519;
exports.crypto = nxtCrypto;