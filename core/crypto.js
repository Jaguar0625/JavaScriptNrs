var hash = {
    init: SHA256_init,
    update: SHA256_write,
    getBytes: SHA256_finalize
};

var crypto = function (curve25519, hash) {

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

    function publicKey (secretPhrase) {
        var digest = simpleHash(secretPhrase);
        return curve25519.keygen(digest).p;
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

        return v.concat(h);
    }

    function verify (signature, message, publicKey) {
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
        sign: sign,
        verify: verify
    };

}(curve25519, hash);
