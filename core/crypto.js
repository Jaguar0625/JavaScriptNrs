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

    function areByteArraysEqual (bytes1, bytes2) {
        if (bytes1.length !== bytes2.length)
            return false;

        for (var i = 0; i < bytes1.length; ++i) {
            if (bytes1[i] !== bytes2[i])
                return false;
        }

        return true;
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

    function publicKey (secretPhrase) {
        var digest = simpleHash(secretPhrase);
        return byteArrayToHexString(curve25519.keygen(digest).p);
    }

    function sign (message, secretPhrase) {
        var digest = simpleHash(secretPhrase);
        var s = curve25519.keygen(digest).s;

        var m = simpleHash(message);

        hash.init();
        hash.update(m);
        hash.update(s);
        var x = hash.getBytes();

        var y = curve25519.keygen(x).p;

        hash.init();
        hash.update(m);
        hash.update(y);
        var h = hash.getBytes();

        var v = curve25519.sign(h, x, s);

        return byteArrayToHexString(v.concat(h));
    }

    function verify (signature, message, publicKey) {
        var signatureBytes = hexStringToByteArray(signature);
        var publicKeyBytes = hexStringToByteArray(publicKey);
        var v = signatureBytes.slice(0, 32);
        var h = signatureBytes.slice(32);
        var y = curve25519.verify(v, h, publicKeyBytes);

        var m = simpleHash(message);

        hash.init();
        hash.update(m);
        hash.update(y);
        var h2 = hash.getBytes();

        return areByteArraysEqual(h, h2);
    }

    return {
        publicKey: publicKey,
        sign: sign,
        verify: verify
    };

}(curve25519, hash);
