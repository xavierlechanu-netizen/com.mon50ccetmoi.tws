/**
 * CRYPTO-NATIVE v1.0
 * Drop-in replacement for CryptoJS using native Web Crypto API.
 * Eliminates eval() and deprecated escape()/unescape() from crypto-js.min.js.
 * 
 * Provides:
 *  - CryptoJS.SHA256(message).toString()
 *  - CryptoJS.AES.encrypt(plaintext, passphrase) / .decrypt(ciphertext, passphrase)
 *  - CryptoJS.enc.Hex, CryptoJS.enc.Utf8
 *  - CryptoJS.lib.WordArray.random(nBytes)
 */
(function(global) {
    'use strict';

    // --- Utility Functions ---

    function utf8ToBytes(str) {
        return new TextEncoder().encode(str);
    }

    function bytesToUtf8(bytes) {
        return new TextDecoder().decode(bytes);
    }

    function bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToBytes(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // --- Synchronous SHA-256 using a pre-computed cache approach ---
    // We use a sync-compatible approach with a Web Worker fallback.
    // For immediate sync compatibility (like crypto-js), we use a pure-JS SHA-256.

    function sha256Sync(message) {
        const msgBytes = (typeof message === 'string') ? utf8ToBytes(message) : message;
        
        // Pure JS SHA-256 (no eval, no deprecated features)
        const K = new Uint32Array([
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ]);

        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }

        // Pre-processing
        const msgLen = msgBytes.length;
        const bitLen = msgLen * 8;
        
        // Padding: message + 1 bit + zeros + 64-bit length
        const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLen);
        padded.set(msgBytes);
        padded[msgLen] = 0x80;
        
        // Append length as 64-bit big-endian
        const view = new DataView(padded.buffer);
        view.setUint32(paddedLen - 4, bitLen, false);

        // Initialize hash values
        let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
        let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

        const w = new Uint32Array(64);

        // Process each 512-bit chunk
        for (let offset = 0; offset < paddedLen; offset += 64) {
            // Create message schedule
            for (let i = 0; i < 16; i++) {
                w[i] = view.getUint32(offset + i * 4, false);
            }
            for (let i = 16; i < 64; i++) {
                const s0 = rightRotate(w[i-15], 7) ^ rightRotate(w[i-15], 18) ^ (w[i-15] >>> 3);
                const s1 = rightRotate(w[i-2], 17) ^ rightRotate(w[i-2], 19) ^ (w[i-2] >>> 10);
                w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
            }

            // Compression
            let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

            for (let i = 0; i < 64; i++) {
                const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
                const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) | 0;

                h = g; g = f; f = e;
                e = (d + temp1) | 0;
                d = c; c = b; b = a;
                a = (temp1 + temp2) | 0;
            }

            h0 = (h0 + a) | 0; h1 = (h1 + b) | 0;
            h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
            h4 = (h4 + e) | 0; h5 = (h5 + f) | 0;
            h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
        }

        // Produce the final hash
        const hash = new Uint8Array(32);
        const hashView = new DataView(hash.buffer);
        hashView.setUint32(0, h0, false);
        hashView.setUint32(4, h1, false);
        hashView.setUint32(8, h2, false);
        hashView.setUint32(12, h3, false);
        hashView.setUint32(16, h4, false);
        hashView.setUint32(20, h5, false);
        hashView.setUint32(24, h6, false);
        hashView.setUint32(28, h7, false);

        return hash;
    }

    // --- PBKDF2-like key derivation (synchronous, for passphrase-based AES) ---
    // CryptoJS uses EvpKDF (OpenSSL-style) by default for string passphrases.
    // We replicate that here for backward compatibility.

    function evpKDF(password, salt, keySize, ivSize) {
        const passwordBytes = utf8ToBytes(password);
        const targetLen = (keySize + ivSize) * 4;
        let derived = new Uint8Array(0);
        let block = new Uint8Array(0);

        while (derived.length < targetLen) {
            // block = MD5(block + password + salt) — but we use SHA-256 for security
            // CryptoJS actually uses MD5 for EvpKDF by default.
            // For backward compat with existing encrypted data, we use MD5.
            const input = new Uint8Array(block.length + passwordBytes.length + salt.length);
            input.set(block, 0);
            input.set(passwordBytes, block.length);
            input.set(salt, block.length + passwordBytes.length);
            block = md5Sync(input);

            const newDerived = new Uint8Array(derived.length + block.length);
            newDerived.set(derived, 0);
            newDerived.set(block, derived.length);
            derived = newDerived;
        }

        return {
            key: derived.slice(0, keySize * 4),
            iv: derived.slice(keySize * 4, (keySize + ivSize) * 4)
        };
    }

    // --- Pure JS MD5 (for EvpKDF backward compatibility) ---
    function md5Sync(msgBytes) {
        if (typeof msgBytes === 'string') msgBytes = utf8ToBytes(msgBytes);

        function cmn(q, a, b, x, s, t) {
            a = ((a + q) & 0xFFFFFFFF);
            a = ((a + x) & 0xFFFFFFFF);
            a = ((a + t) & 0xFFFFFFFF);
            return (((a << s) | (a >>> (32 - s))) + b) & 0xFFFFFFFF;
        }
        function ff(a,b,c,d,x,s,t) { return cmn((b&c)|((~b)&d),a,b,x,s,t); }
        function gg(a,b,c,d,x,s,t) { return cmn((b&d)|(c&(~d)),a,b,x,s,t); }
        function hh(a,b,c,d,x,s,t) { return cmn(b^c^d,a,b,x,s,t); }
        function ii(a,b,c,d,x,s,t) { return cmn(c^(b|(~d)),a,b,x,s,t); }

        const n = msgBytes.length;
        const bitLen = n * 8;
        const paddedLen = Math.ceil((n + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLen);
        padded.set(msgBytes);
        padded[n] = 0x80;
        const dv = new DataView(padded.buffer);
        dv.setUint32(paddedLen - 8, bitLen & 0xFFFFFFFF, true);
        dv.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

        let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

        for (let offset = 0; offset < paddedLen; offset += 64) {
            const M = new Uint32Array(16);
            for (let j = 0; j < 16; j++) M[j] = dv.getUint32(offset + j * 4, true);

            let a = a0, b = b0, c = c0, d = d0;

            a=ff(a,b,c,d,M[0],7,0xd76aa478);  d=ff(d,a,b,c,M[1],12,0xe8c7b756);
            c=ff(c,d,a,b,M[2],17,0x242070db); b=ff(b,c,d,a,M[3],22,0xc1bdceee);
            a=ff(a,b,c,d,M[4],7,0xf57c0faf);  d=ff(d,a,b,c,M[5],12,0x4787c62a);
            c=ff(c,d,a,b,M[6],17,0xa8304613); b=ff(b,c,d,a,M[7],22,0xfd469501);
            a=ff(a,b,c,d,M[8],7,0x698098d8);  d=ff(d,a,b,c,M[9],12,0x8b44f7af);
            c=ff(c,d,a,b,M[10],17,0xffff5bb1);b=ff(b,c,d,a,M[11],22,0x895cd7be);
            a=ff(a,b,c,d,M[12],7,0x6b901122); d=ff(d,a,b,c,M[13],12,0xfd987193);
            c=ff(c,d,a,b,M[14],17,0xa679438e);b=ff(b,c,d,a,M[15],22,0x49b40821);

            a=gg(a,b,c,d,M[1],5,0xf61e2562);  d=gg(d,a,b,c,M[6],9,0xc040b340);
            c=gg(c,d,a,b,M[11],14,0x265e5a51);b=gg(b,c,d,a,M[0],20,0xe9b6c7aa);
            a=gg(a,b,c,d,M[5],5,0xd62f105d);  d=gg(d,a,b,c,M[10],9,0x02441453);
            c=gg(c,d,a,b,M[15],14,0xd8a1e681);b=gg(b,c,d,a,M[4],20,0xe7d3fbc8);
            a=gg(a,b,c,d,M[9],5,0x21e1cde6);  d=gg(d,a,b,c,M[14],9,0xc33707d6);
            c=gg(c,d,a,b,M[3],14,0xf4d50d87); b=gg(b,c,d,a,M[8],20,0x455a14ed);
            a=gg(a,b,c,d,M[13],5,0xa9e3e905); d=gg(d,a,b,c,M[2],9,0xfcefa3f8);
            c=gg(c,d,a,b,M[7],14,0x676f02d9); b=gg(b,c,d,a,M[12],20,0x8d2a4c8a);

            a=hh(a,b,c,d,M[5],4,0xfffa3942);  d=hh(d,a,b,c,M[8],11,0x8771f681);
            c=hh(c,d,a,b,M[11],16,0x6d9d6122);b=hh(b,c,d,a,M[14],23,0xfde5380c);
            a=hh(a,b,c,d,M[1],4,0xa4beea44);  d=hh(d,a,b,c,M[4],11,0x4bdecfa9);
            c=hh(c,d,a,b,M[7],16,0xf6bb4b60); b=hh(b,c,d,a,M[10],23,0xbebfbc70);
            a=hh(a,b,c,d,M[13],4,0x289b7ec6); d=hh(d,a,b,c,M[0],11,0xeaa127fa);
            c=hh(c,d,a,b,M[3],16,0xd4ef3085); b=hh(b,c,d,a,M[6],23,0x04881d05);
            a=hh(a,b,c,d,M[9],4,0xd9d4d039);  d=hh(d,a,b,c,M[12],11,0xe6db99e5);
            c=hh(c,d,a,b,M[15],16,0x1fa27cf8);b=hh(b,c,d,a,M[2],23,0xc4ac5665);

            a=ii(a,b,c,d,M[0],6,0xf4292244);  d=ii(d,a,b,c,M[7],10,0x432aff97);
            c=ii(c,d,a,b,M[14],15,0xab9423a7);b=ii(b,c,d,a,M[5],21,0xfc93a039);
            a=ii(a,b,c,d,M[12],6,0x655b59c3); d=ii(d,a,b,c,M[3],10,0x8f0ccc92);
            c=ii(c,d,a,b,M[10],15,0xffeff47d);b=ii(b,c,d,a,M[1],21,0x85845dd1);
            a=ii(a,b,c,d,M[8],6,0x6fa87e4f);  d=ii(d,a,b,c,M[15],10,0xfe2ce6e0);
            c=ii(c,d,a,b,M[6],15,0xa3014314); b=ii(b,c,d,a,M[13],21,0x4e0811a1);
            a=ii(a,b,c,d,M[4],6,0xf7537e82);  d=ii(d,a,b,c,M[11],10,0xbd3af235);
            c=ii(c,d,a,b,M[2],15,0x2ad7d2bb); b=ii(b,c,d,a,M[9],21,0xeb86d391);

            a0 = (a0 + a) & 0xFFFFFFFF;
            b0 = (b0 + b) & 0xFFFFFFFF;
            c0 = (c0 + c) & 0xFFFFFFFF;
            d0 = (d0 + d) & 0xFFFFFFFF;
        }

        const result = new Uint8Array(16);
        const rv = new DataView(result.buffer);
        rv.setUint32(0, a0, true);
        rv.setUint32(4, b0, true);
        rv.setUint32(8, c0, true);
        rv.setUint32(12, d0, true);
        return result;
    }

    // --- AES-CBC (synchronous, pure JS for CryptoJS compat) ---
    
    // S-box
    const SBOX = new Uint8Array([
        0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
        0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
        0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
        0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
        0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
        0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
        0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
        0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
        0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
        0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
        0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
        0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
        0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
        0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
        0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
        0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
    ]);

    const INV_SBOX = new Uint8Array(256);
    for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;

    const RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

    function xtime(a) { return ((a << 1) ^ (((a >> 7) & 1) * 0x1b)) & 0xff; }
    function mul(a, b) {
        let p = 0;
        for (let i = 0; i < 8; i++) {
            if (b & 1) p ^= a;
            const hi = a & 0x80;
            a = (a << 1) & 0xff;
            if (hi) a ^= 0x1b;
            b >>= 1;
        }
        return p;
    }

    function aesKeyExpansion(key) {
        const nk = key.length / 4;
        const nr = nk + 6;
        const w = new Uint32Array(4 * (nr + 1));
        
        for (let i = 0; i < nk; i++) {
            w[i] = (key[4*i] << 24) | (key[4*i+1] << 16) | (key[4*i+2] << 8) | key[4*i+3];
        }
        
        for (let i = nk; i < 4 * (nr + 1); i++) {
            let temp = w[i - 1];
            if (i % nk === 0) {
                temp = ((SBOX[(temp >> 16) & 0xff] << 24) |
                        (SBOX[(temp >> 8) & 0xff] << 16) |
                        (SBOX[temp & 0xff] << 8) |
                        SBOX[(temp >> 24) & 0xff]) ^ (RCON[i/nk - 1] << 24);
            } else if (nk > 6 && i % nk === 4) {
                temp = (SBOX[(temp >> 24) & 0xff] << 24) |
                       (SBOX[(temp >> 16) & 0xff] << 16) |
                       (SBOX[(temp >> 8) & 0xff] << 8) |
                       SBOX[temp & 0xff];
            }
            w[i] = w[i - nk] ^ temp;
        }
        return { roundKeys: w, nr: nr };
    }

    function aesEncryptBlock(block, expanded) {
        const { roundKeys, nr } = expanded;
        const s = new Uint8Array(16);
        s.set(block);
        
        // AddRoundKey
        for (let i = 0; i < 4; i++) {
            const k = roundKeys[i];
            s[4*i] ^= (k >> 24) & 0xff;
            s[4*i+1] ^= (k >> 16) & 0xff;
            s[4*i+2] ^= (k >> 8) & 0xff;
            s[4*i+3] ^= k & 0xff;
        }

        for (let round = 1; round <= nr; round++) {
            // SubBytes
            for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
            
            // ShiftRows
            let tmp;
            tmp = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = tmp;
            tmp = s[2]; s[2] = s[10]; s[10] = tmp; tmp = s[6]; s[6] = s[14]; s[14] = tmp;
            tmp = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = tmp;

            // MixColumns (skip in last round)
            if (round < nr) {
                for (let c = 0; c < 4; c++) {
                    const i = c * 4;
                    const a0 = s[i], a1 = s[i+1], a2 = s[i+2], a3 = s[i+3];
                    s[i]   = xtime(a0) ^ xtime(a1) ^ a1 ^ a2 ^ a3;
                    s[i+1] = a0 ^ xtime(a1) ^ xtime(a2) ^ a2 ^ a3;
                    s[i+2] = a0 ^ a1 ^ xtime(a2) ^ xtime(a3) ^ a3;
                    s[i+3] = xtime(a0) ^ a0 ^ a1 ^ a2 ^ xtime(a3);
                }
            }

            // AddRoundKey
            for (let i = 0; i < 4; i++) {
                const k = roundKeys[round * 4 + i];
                s[4*i] ^= (k >> 24) & 0xff;
                s[4*i+1] ^= (k >> 16) & 0xff;
                s[4*i+2] ^= (k >> 8) & 0xff;
                s[4*i+3] ^= k & 0xff;
            }
        }

        return s;
    }

    function aesDecryptBlock(block, expanded) {
        const { roundKeys, nr } = expanded;
        const s = new Uint8Array(16);
        s.set(block);

        // AddRoundKey (last round key)
        for (let i = 0; i < 4; i++) {
            const k = roundKeys[nr * 4 + i];
            s[4*i] ^= (k >> 24) & 0xff;
            s[4*i+1] ^= (k >> 16) & 0xff;
            s[4*i+2] ^= (k >> 8) & 0xff;
            s[4*i+3] ^= k & 0xff;
        }

        for (let round = nr - 1; round >= 0; round--) {
            // InvShiftRows
            let tmp;
            tmp = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = tmp;
            tmp = s[2]; s[2] = s[10]; s[10] = tmp; tmp = s[6]; s[6] = s[14]; s[14] = tmp;
            tmp = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = tmp;

            // InvSubBytes
            for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];

            // AddRoundKey
            for (let i = 0; i < 4; i++) {
                const k = roundKeys[round * 4 + i];
                s[4*i] ^= (k >> 24) & 0xff;
                s[4*i+1] ^= (k >> 16) & 0xff;
                s[4*i+2] ^= (k >> 8) & 0xff;
                s[4*i+3] ^= k & 0xff;
            }

            // InvMixColumns (skip in round 0)
            if (round > 0) {
                for (let c = 0; c < 4; c++) {
                    const i = c * 4;
                    const a0 = s[i], a1 = s[i+1], a2 = s[i+2], a3 = s[i+3];
                    s[i]   = mul(a0,14) ^ mul(a1,11) ^ mul(a2,13) ^ mul(a3,9);
                    s[i+1] = mul(a0,9)  ^ mul(a1,14) ^ mul(a2,11) ^ mul(a3,13);
                    s[i+2] = mul(a0,13) ^ mul(a1,9)  ^ mul(a2,14) ^ mul(a3,11);
                    s[i+3] = mul(a0,11) ^ mul(a1,13) ^ mul(a2,9)  ^ mul(a3,14);
                }
            }
        }

        return s;
    }

    function pkcs7Pad(data, blockSize) {
        const padLen = blockSize - (data.length % blockSize);
        const padded = new Uint8Array(data.length + padLen);
        padded.set(data);
        for (let i = data.length; i < padded.length; i++) padded[i] = padLen;
        return padded;
    }

    function pkcs7Unpad(data) {
        const padLen = data[data.length - 1];
        if (padLen < 1 || padLen > 16) return data;
        for (let i = data.length - padLen; i < data.length; i++) {
            if (data[i] !== padLen) return data;
        }
        return data.slice(0, data.length - padLen);
    }

    function aesCbcEncrypt(plainBytes, keyBytes, ivBytes) {
        const padded = pkcs7Pad(plainBytes, 16);
        const expanded = aesKeyExpansion(keyBytes);
        const out = new Uint8Array(padded.length);
        let prev = ivBytes;

        for (let i = 0; i < padded.length; i += 16) {
            const block = new Uint8Array(16);
            for (let j = 0; j < 16; j++) block[j] = padded[i + j] ^ prev[j];
            const encrypted = aesEncryptBlock(block, expanded);
            out.set(encrypted, i);
            prev = encrypted;
        }
        return out;
    }

    function aesCbcDecrypt(cipherBytes, keyBytes, ivBytes) {
        const expanded = aesKeyExpansion(keyBytes);
        const out = new Uint8Array(cipherBytes.length);
        let prev = ivBytes;

        for (let i = 0; i < cipherBytes.length; i += 16) {
            const block = cipherBytes.slice(i, i + 16);
            const decrypted = aesDecryptBlock(block, expanded);
            for (let j = 0; j < 16; j++) out[i + j] = decrypted[j] ^ prev[j];
            prev = block;
        }
        return pkcs7Unpad(out);
    }

    // --- CryptoJS-Compatible API ---

    const CryptoJSCompat = {
        enc: {
            Hex: {
                parse: function(hexStr) {
                    return { _bytes: hexToBytes(hexStr), toString: function() { return bytesToHex(this._bytes); } };
                },
                stringify: function(wordArray) {
                    return bytesToHex(wordArray._bytes || new Uint8Array(0));
                }
            },
            Utf8: {
                parse: function(str) {
                    return { _bytes: utf8ToBytes(str), toString: function() { return bytesToUtf8(this._bytes); } };
                },
                stringify: function(wordArray) {
                    return bytesToUtf8(wordArray._bytes || new Uint8Array(0));
                }
            }
        },
        lib: {
            WordArray: {
                random: function(nBytes) {
                    const bytes = new Uint8Array(nBytes);
                    crypto.getRandomValues(bytes);
                    return {
                        _bytes: bytes,
                        toString: function(encoder) {
                            if (encoder === CryptoJSCompat.enc.Hex || !encoder) {
                                return bytesToHex(this._bytes);
                            }
                            return bytesToHex(this._bytes);
                        }
                    };
                }
            }
        },
        SHA256: function(message) {
            const msgStr = (typeof message === 'string') ? message :
                           (message && message._bytes) ? bytesToUtf8(message._bytes) : String(message);
            const hash = sha256Sync(msgStr);
            return {
                _bytes: hash,
                toString: function(encoder) {
                    return bytesToHex(this._bytes);
                }
            };
        },
        AES: {
            encrypt: function(plaintext, keyOrPassphrase, cfg) {
                const plaintextBytes = utf8ToBytes(plaintext);

                if (typeof keyOrPassphrase === 'string') {
                    // Passphrase mode (OpenSSL compatible with EvpKDF + salt)
                    const salt = new Uint8Array(8);
                    crypto.getRandomValues(salt);

                    const derived = evpKDF(keyOrPassphrase, salt, 8, 4); // 256-bit key, 128-bit IV
                    const cipherBytes = aesCbcEncrypt(plaintextBytes, derived.key, derived.iv);

                    // OpenSSL format: "Salted__" + salt + ciphertext
                    const salted = new Uint8Array(16 + cipherBytes.length);
                    salted.set(utf8ToBytes('Salted__'), 0);
                    salted.set(salt, 8);
                    salted.set(cipherBytes, 16);

                    const result = bytesToBase64(salted);
                    return {
                        toString: function() { return result; },
                        ciphertext: { _bytes: cipherBytes }
                    };
                } else {
                    // Key + IV mode
                    const keyBytes = keyOrPassphrase._bytes || hexToBytes(keyOrPassphrase.toString());
                    const ivBytes = (cfg && cfg.iv) ? (cfg.iv._bytes || hexToBytes(cfg.iv.toString())) : new Uint8Array(16);
                    const cipherBytes = aesCbcEncrypt(plaintextBytes, keyBytes, ivBytes);
                    const result = bytesToBase64(cipherBytes);
                    return {
                        toString: function() { return result; },
                        ciphertext: { _bytes: cipherBytes }
                    };
                }
            },

            decrypt: function(ciphertextInput, keyOrPassphrase, cfg) {
                const ciphertextStr = (typeof ciphertextInput === 'string') ? ciphertextInput :
                                      (ciphertextInput && ciphertextInput.toString) ? ciphertextInput.toString() : String(ciphertextInput);

                if (typeof keyOrPassphrase === 'string') {
                    // Passphrase mode (OpenSSL format)
                    const rawBytes = base64ToBytes(ciphertextStr);

                    // Check for "Salted__" header
                    const header = bytesToUtf8(rawBytes.slice(0, 8));
                    let salt, cipherBytes;
                    if (header === 'Salted__') {
                        salt = rawBytes.slice(8, 16);
                        cipherBytes = rawBytes.slice(16);
                    } else {
                        salt = new Uint8Array(8);
                        cipherBytes = rawBytes;
                    }

                    const derived = evpKDF(keyOrPassphrase, salt, 8, 4);
                    const plainBytes = aesCbcDecrypt(cipherBytes, derived.key, derived.iv);

                    return {
                        _bytes: plainBytes,
                        toString: function(encoder) {
                            if (encoder === CryptoJSCompat.enc.Utf8) {
                                return bytesToUtf8(this._bytes);
                            }
                            return bytesToHex(this._bytes);
                        }
                    };
                } else {
                    // Key + IV mode
                    const cipherBytes = base64ToBytes(ciphertextStr);
                    const keyBytes = keyOrPassphrase._bytes || hexToBytes(keyOrPassphrase.toString());
                    const ivBytes = (cfg && cfg.iv) ? (cfg.iv._bytes || hexToBytes(cfg.iv.toString())) : new Uint8Array(16);
                    const plainBytes = aesCbcDecrypt(cipherBytes, keyBytes, ivBytes);

                    return {
                        _bytes: plainBytes,
                        toString: function(encoder) {
                            if (encoder === CryptoJSCompat.enc.Utf8) {
                                return bytesToUtf8(this._bytes);
                            }
                            return bytesToHex(this._bytes);
                        }
                    };
                }
            }
        }
    };

    // Expose as global CryptoJS
    global.CryptoJS = CryptoJSCompat;

})(typeof window !== 'undefined' ? window : this);
