JavaScript code that signs and verifies signatures using the NRS algorithm.
This code is mostly a port of existing Java code in the public domain.

[Curve25519](http://cr.yp.to/ecdh.html) is an elliptic curve,
developed by [Dan Bernstein](http://cr.yp.to/djb.html), for fast Diffie-Hellman key agreement.

Ported from C to Java by Dmitry Skiba [sahn0], 23/02/08.
Original: http://code.google.com/p/curve25519-java/

C implementation based on generic 64-bit integer implementation of Curve25519 ECDH
Written by Matthijs van Duin, 200608242056
Original: http://cds.xs4all.nl:8081/ecdh/ (broken link)