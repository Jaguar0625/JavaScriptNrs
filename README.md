
JavaScriptNrs
=============
Curve 25519 JavaScript Implementation
-------------------------------------
[Curve25519](http://cr.yp.to/ecdh.html) is an elliptic curve,
developed by [Dan Bernstein](http://cr.yp.to/djb.html), for fast Diffie-Hellman key agreement.

* 2006/08/24 C implementation based on generic 64-bit integer implementation of Curve25519 ECDH
Written by Matthijs van Duin (http://cds.xs4all.nl:8081/ecdh/) (broken link)
* 2008/02/23 Ported from C to Java by Dmitry Skiba (http://code.google.com/p/curve25519-java/)

This implementation is a port of the Java code and the inclusion of fast 64-bit JavaScript math based on [curve255js](https://github.com/rev22/curve255js).
It is optimized for Chrome and uses newer JavaScript features like typed arrays.
It is not likely to run in older browsers.

Crypto Implementation
---------------------
A wrapper around the Curve25519 implementation that uses SHA256 hashing.
[JSSHA256](http://point-at-infinity.org/jssha256/) is used for SHA256 operations.
The crypto implementation supports:
* Public key generation
* Signing
* Signature verification

All inputs and outputs are expected to be hex strings.

### Examples

```javascript

    var message = '54686973206973206120736563726574206d6573736167652074686174206e6565647320746f206265207369676e6564';
    var secretPhrase = '54686973206973206d7920766572792073656372657420706872617365';

    var publicKey = nxtCrypto.getPublicKey(secretPhrase);
    console.log(publicKey); // 698168d8669c9310d68101dfcc974ed4
                            // ef454692da6f028f68114db5fdcc4f6a

    var signature = nxtCrypto.sign(message, secretPhrase);
    console.log(signature); // 94956bf3de7cfdedb2562a0eff698fed
                            // 7f3e54bbf4476fbb23a192ddea04040f
                            // 68efa5d03c3f9ebec4109401b50433f1
                            // df267299d8b1ad2c485046c45e6b38da

    var isVerified = nxtCrypto.verify(signature, message, publicKey)
    console.log(isVerified); // true

```

Project Layout
---------------------
The main project files are stored in the core directory.
A build script is provided that concatenates all of the core files and external dependencies into a single JavaScript file (crypto_browser.js).
This is the only file that needs be included from within an HTML page.

```shell
bash build/build.sh
```

A full suite of tests are provided that can be run in node.js.

```shell
node test.js
```

In addition, the browser_test folder contains timing tests that can be run in the browser by opening the html file.
In order to run the tests with a different implementation, the following should be changed to refer to the other implementation:
```javascript
    var c = {
        getPublicKey: nxtCrypto.getPublicKey,
        sign: nxtCrypto.sign,
        verify: nxtCrypto.verify
    };
```

License Information for External Code
-------------------------------------
* [curve25519-java](http://code.google.com/p/curve25519-java/): Apache License 2.0
* [JSSHA256](http://point-at-infinity.org/jssha256/): GNU GPL
* [curve255js](https://github.com/rev22/curve255js): MIT