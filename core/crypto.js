var hash = {
    init: SHA256_init,
    update: SHA256_write,
    getBytes: SHA256_finalize
};

var nxtCrypto = function (curve25519, hash, converters) {

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

    function getPublicKey (secretPhrase) {
        var secretPhraseBytes = converters.hexStringToByteArray(secretPhrase);
        var digest = simpleHash(secretPhraseBytes);
        return converters.byteArrayToHexString(curve25519.keygen(digest).p);
    }

    function sign (message, secretPhrase) {
        var messageBytes = converters.hexStringToByteArray(message);
        var secretPhraseBytes = converters.hexStringToByteArray(secretPhrase);

        var digest = simpleHash(secretPhraseBytes);
        var s = curve25519.keygen(digest).s;

        var m = simpleHash(messageBytes);

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

        return converters.byteArrayToHexString(v.concat(h));
    }

    function verify (signature, message, publicKey) {
        var signatureBytes = converters.hexStringToByteArray(signature);
        var messageBytes = converters.hexStringToByteArray(message);
        var publicKeyBytes = converters.hexStringToByteArray(publicKey);
        var v = signatureBytes.slice(0, 32);
        var h = signatureBytes.slice(32);
        var y = curve25519.verify(v, h, publicKeyBytes);

        var m = simpleHash(messageBytes);

        hash.init();
        hash.update(m);
        hash.update(y);
        var h2 = hash.getBytes();

        return areByteArraysEqual(h, h2);
    }

    return {
        getPublicKey: getPublicKey,
        sign: sign,
        verify: verify
    };

}(curve25519, hash, converters);
